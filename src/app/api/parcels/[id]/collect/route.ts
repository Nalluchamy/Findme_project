import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { validateStateTransition } from '@/lib/stateMachine';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const session = getSession(req);
  if (!session || (session.role !== 'DELIVERY_AGENT' && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Resolve params for compatibility
  const resolvedParams = await params;
  const id = resolvedParams.id;
  
  const { amount, photoUrl, gpsCoords } = await req.json();

  if (amount === undefined) {
    return NextResponse.json({ error: 'Amount is required' }, { status: 400 });
  }

  try {
    const result = await db.$transaction(async (tx: any) => {
      const parcel = await tx.parcel.findUnique({
        where: { id },
      });

      if (!parcel) {
        throw new Error('Parcel not found');
      }

      const validation = validateStateTransition(parcel.currentState, 'COD_COLLECTED');
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const expected = Number(parcel.codAmount);
      const confirmed = Number(amount);

      if (expected !== confirmed) {
        // Discrepancy mismatch immediately
        await tx.ledgerEvent.create({
          data: {
            parcelId: id,
            eventType: 'COD_COLLECTED',
            fromPartyId: session.id,
            expectedAmount: expected,
            confirmedAmount: confirmed,
            confirmedByFrom: true,
            confirmedByTo: true,
            photoUrl,
            gpsCoords,
            discrepancyNote: `Doorstep collection mismatch: Expected ₹${expected}, Agent collected ₹${confirmed}`,
          },
        });

        await tx.ledgerEvent.create({
          data: {
            parcelId: id,
            eventType: 'DISCREPANCY_FLAGGED',
            expectedAmount: expected,
            confirmedAmount: confirmed,
            discrepancyNote: `Doorstep collection mismatch: Expected ₹${expected}, Agent collected ₹${confirmed}`,
          },
        });

        await tx.parcel.update({
          where: { id },
          data: { currentState: 'DISCREPANCY_FLAGGED' },
        });

        return { success: true, flagged: true, message: 'Discrepancy flagged due to amount mismatch.' };
      } else {
        // Success collection
        await tx.ledgerEvent.create({
          data: {
            parcelId: id,
            eventType: 'COD_COLLECTED',
            fromPartyId: session.id,
            expectedAmount: expected,
            confirmedAmount: confirmed,
            confirmedByFrom: true,
            confirmedByTo: true,
            photoUrl,
            gpsCoords,
          },
        });

        await tx.parcel.update({
          where: { id },
          data: { currentState: 'COD_COLLECTED' },
        });

        return { success: true, flagged: false };
      }
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Collection error:', error);
    if (error.message === 'Parcel not found') return NextResponse.json({ error: error.message }, { status: 404 });
    if (error.message.includes('Invalid transition')) return NextResponse.json({ error: error.message }, { status: 409 });
    
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
