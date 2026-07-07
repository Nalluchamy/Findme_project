import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { validateStateTransition } from '@/lib/stateMachine';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const session = getSession(req);
  if (!session || (session.role !== 'FINANCE_OFFICER' && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const resolvedParams = await params;
  const id = resolvedParams.id;
  const { referenceId } = await req.json();

  if (!referenceId) {
    return NextResponse.json({ error: 'Payout Reference ID is required' }, { status: 400 });
  }

  try {
    const parcel = await db.parcel.findUnique({
      where: { id },
    });

    if (!parcel) {
      return NextResponse.json({ error: 'Parcel not found' }, { status: 404 });
    }

    const validation = validateStateTransition(parcel.currentState, 'SETTLED_TO_SELLER');
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    await db.$transaction(async (tx) => {
      await tx.ledgerEvent.create({
        data: {
          parcelId: id,
          eventType: 'SETTLED_TO_SELLER',
          fromPartyId: session.id,
          toPartyId: parcel.sellerId,
          expectedAmount: parcel.codAmount,
          confirmedAmount: parcel.codAmount,
          confirmedByFrom: true,
          confirmedByTo: true,
          discrepancyNote: `Payout Completed. Ref ID: ${referenceId}`,
        },
      });

      await tx.parcel.update({
        where: { id },
        data: {
          currentState: 'SETTLED_TO_SELLER',
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Payout error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
