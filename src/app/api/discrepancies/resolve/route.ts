import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session || (session.role !== 'FINANCE_OFFICER' && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { parcelId, targetState, resolvedAmount, note } = await req.json();

    if (!parcelId || !targetState || resolvedAmount === undefined) {
      return NextResponse.json({ error: 'parcelId, targetState, and resolvedAmount are required' }, { status: 400 });
    }

    const parcel = await db.parcel.findUnique({
      where: { id: parcelId },
    });

    if (!parcel) {
      return NextResponse.json({ error: 'Parcel not found' }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      await tx.ledgerEvent.create({
        data: {
          parcelId,
          eventType: targetState,
          fromPartyId: session.id,
          toPartyId: session.id,
          expectedAmount: resolvedAmount,
          confirmedAmount: resolvedAmount,
          confirmedByFrom: true,
          confirmedByTo: true,
          discrepancyNote: `Finance Resolution: ${note}. Settled amount to ₹${resolvedAmount}.`,
        },
      });

      await tx.parcel.update({
        where: { id: parcelId },
        data: {
          currentState: targetState,
          codAmount: resolvedAmount,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Resolve discrepancy error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
