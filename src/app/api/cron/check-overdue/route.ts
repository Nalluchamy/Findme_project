import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const seconds = url.searchParams.get('seconds');
    const thresholdMs = seconds ? Number(seconds) * 1000 : 48 * 60 * 60 * 1000;

    const now = new Date();
    const cutOffDate = new Date(now.getTime() - thresholdMs);

    const activeParcels = await db.parcel.findMany({
      where: {
        NOT: [
          { currentState: 'SETTLED_TO_SELLER' },
          { currentState: 'DISCREPANCY_FLAGGED' },
          { currentState: 'CREATED' },
        ],
      },
      include: {
        ledgerEvents: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });

    const flaggedParcels: string[] = [];

    for (const parcel of activeParcels) {
      const latestEvent = parcel.ledgerEvents[0];
      if (latestEvent && latestEvent.timestamp < cutOffDate) {
        await db.$transaction(async (tx: any) => {
          await tx.ledgerEvent.create({
            data: {
              parcelId: parcel.id,
              eventType: 'DISCREPANCY_FLAGGED',
              expectedAmount: parcel.codAmount,
              discrepancyNote: `Overdue Handover SLA: Last activity exceeded the limit of ${seconds ? seconds + 's' : '48 hours'}.`,
            },
          });

          await tx.parcel.update({
            where: { id: parcel.id },
            data: { currentState: 'DISCREPANCY_FLAGGED' },
          });
        });
        flaggedParcels.push(parcel.id);
      }
    }

    return NextResponse.json({
      success: true,
      checkedCount: activeParcels.length,
      flaggedCount: flaggedParcels.length,
      flaggedParcels,
    });
  } catch (error: any) {
    console.error('Overdue cron error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
