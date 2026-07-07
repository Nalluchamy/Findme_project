import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { validateStateTransition } from '@/lib/stateMachine';
import { LedgerEventType } from '@prisma/client';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resolvedParams = await params;
  const id = resolvedParams.id;

  try {
    const pendingEvent = await db.ledgerEvent.findFirst({
      where: {
        parcelId: id,
        confirmedByTo: false,
      },
      include: {
        fromParty: true,
        toParty: true,
      },
    });

    return NextResponse.json({ pendingEvent });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resolvedParams = await params;
  const id = resolvedParams.id;

  try {
    const result = await db.$transaction(async (tx: any) => {
      const parcel = await tx.parcel.findUnique({
        where: { id },
      });

      if (!parcel) {
        throw new Error('Parcel not found');
      }

      // Check if there is an unconfirmed event for this parcel
      const pendingEvent = await tx.ledgerEvent.findFirst({
        where: {
          parcelId: id,
          confirmedByTo: false,
        },
      });

      if (pendingEvent) {
        // --- PARTY B CONFIRMATION FLOW ---
        const { amount } = await req.json();

        if (amount === undefined) {
          throw new Error('Confirmed amount is required for confirmation');
        }

        const expected = Number(pendingEvent.expectedAmount);
        const confirmed = Number(amount);

        // Concurrency check: Ensure we are the ones confirming it
        const updateResult = await tx.ledgerEvent.updateMany({
          where: { id: pendingEvent.id, confirmedByTo: false },
          data: {
            confirmedAmount: confirmed,
            confirmedByTo: true,
            toPartyId: session.id,
            discrepancyNote: expected !== confirmed ? `Mismatch: Sender expected ₹${expected}, Recipient confirmed ₹${confirmed}` : null,
          },
        });

        if (updateResult.count === 0) {
          throw new Error('Handover was already confirmed by another request');
        }

        if (expected !== confirmed) {
          // Mismatch triggers discrepancy
          await tx.ledgerEvent.create({
            data: {
              parcelId: id,
              eventType: 'DISCREPANCY_FLAGGED',
              expectedAmount: expected,
              confirmedAmount: confirmed,
              fromPartyId: pendingEvent.fromPartyId,
              toPartyId: session.id,
              discrepancyNote: `Handover mismatch at ${pendingEvent.eventType}: Sender expected ₹${expected}, Recipient confirmed ₹${confirmed}`,
            },
          });

          await tx.parcel.update({
            where: { id },
            data: { currentState: 'DISCREPANCY_FLAGGED' },
          });

          return { success: true, flagged: true, message: 'Handover flagged due to amount mismatch.' };
        } else {
          // Match! Finalize event and transition state
          await tx.parcel.update({
            where: { id },
            data: { currentState: pendingEvent.eventType as any },
          });

          return { success: true, flagged: false };
        }
      } else {
        // --- PARTY A INITIATION FLOW ---
        const { eventType, expectedAmount, toPartyId, photoUrl, gpsCoords } = await req.json();

        if (!eventType || expectedAmount === undefined || !toPartyId) {
          throw new Error('eventType, expectedAmount, and toPartyId are required');
        }

        // Check state transition validation
        const validation = validateStateTransition(parcel.currentState, eventType as LedgerEventType);
        if (!validation.valid) {
          throw new Error(validation.error);
        }

        // Create new unconfirmed event
        const event = await tx.ledgerEvent.create({
          data: {
            parcelId: id,
            eventType: eventType as LedgerEventType,
            fromPartyId: session.id,
            toPartyId,
            expectedAmount: parseFloat(expectedAmount),
            confirmedByFrom: true,
            confirmedByTo: false,
            photoUrl,
            gpsCoords,
          },
        });

        return { success: true, event };
      }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Handover API error:', error);
    if (error.message === 'Parcel not found') return NextResponse.json({ error: error.message }, { status: 404 });
    if (error.message === 'Confirmed amount is required for confirmation' || error.message.includes('are required')) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error.message === 'Handover was already confirmed by another request' || error.message.includes('Invalid transition')) return NextResponse.json({ error: error.message }, { status: 409 });
    
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
