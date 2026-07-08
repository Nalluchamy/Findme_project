import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalParcels,
      todayParcels,
      pendingSettlements,
      discrepancies,
      settledToday,
      activeAgents,
      allParcels,
      recentEvents,
    ] = await Promise.all([
      // Total parcels ever
      db.parcel.count(),

      // Parcels created today
      db.parcel.count({ where: { createdAt: { gte: today } } }),

      // Pending: cash sitting in branch/hub waiting for payout
      db.parcel.findMany({
        where: { currentState: { in: ['HANDOVER_TO_ORIGIN_BRANCH', 'HANDOVER_TO_ORIGIN_HUB', 'HANDOVER_TO_DEST_HUB'] } },
        select: { codAmount: true },
      }),

      // Discrepancies
      db.parcel.count({ where: { currentState: 'DISCREPANCY_FLAGGED' } }),

      // Settled today
      db.parcel.findMany({
        where: { currentState: 'SETTLED_TO_SELLER', updatedAt: { gte: today } },
        select: { codAmount: true },
      }),

      // Active delivery agents (users with role DELIVERY_AGENT)
      db.user.count({ where: { role: 'DELIVERY_AGENT' } }),

      // All parcels for status breakdown
      db.parcel.groupBy({
        by: ['currentState'],
        _count: { currentState: true },
      }),

      // Recent ledger events (activity feed)
      db.ledgerEvent.findMany({
        take: 10,
        orderBy: { timestamp: 'desc' },
        include: {
          parcel: { select: { id: true } },
          fromParty: { select: { name: true, role: true } },
          toParty: { select: { name: true, role: true } },
        },
      }),
    ]);

    const pendingAmount = pendingSettlements.reduce((sum, p) => sum + Number(p.codAmount), 0);
    const settledTodayAmount = settledToday.reduce((sum, p) => sum + Number(p.codAmount), 0);

    return NextResponse.json({
      totalParcels,
      todayParcels,
      pendingAmount,
      discrepancies,
      settledTodayAmount,
      activeAgents,
      statusBreakdown: allParcels,
      recentEvents,
    });
  } catch (error: any) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
