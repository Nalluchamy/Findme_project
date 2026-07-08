import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session || (session.role !== 'FINANCE_OFFICER' && session.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const dateStr = searchParams.get('date');
    
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(targetDate);
    nextDay.setDate(targetDate.getDate() + 1);

    const companyId = session.companyId;
    const filter = companyId ? { companyId } : {};

    // Get all ledger events for the target date to calculate daily cash movements
    const events = await db.ledgerEvent.findMany({
      where: {
        timestamp: {
          gte: targetDate,
          lt: nextDay,
        },
        parcel: filter,
      },
      include: {
        parcel: {
          include: {
            originLocation: true,
            destinationLocation: true,
          },
        },
        fromParty: { select: { id: true, name: true, role: true } },
        toParty: { select: { id: true, name: true, role: true } },
      },
      orderBy: { timestamp: 'desc' },
    });

    // Calculate aggregations
    let totalCollected = 0;
    let totalSettled = 0;
    let totalPending = 0;
    let discrepanciesCount = 0;

    const agentMap: Record<string, { name: string; amount: number; count: number }> = {};
    const branchMap: Record<string, { name: string; amount: number; count: number }> = {};
    const discrepanciesList: any[] = [];

    events.forEach(event => {
      const amount = Number(event.confirmedAmount ?? event.expectedAmount ?? 0);
      
      if (event.eventType === 'COD_COLLECTED') {
        totalCollected += amount;
        
        // Agent metrics
        if (event.fromParty && event.fromParty.role === 'DELIVERY_AGENT') {
          const agentId = event.fromParty.id;
          if (!agentMap[agentId]) {
            agentMap[agentId] = { name: event.fromParty.name, amount: 0, count: 0 };
          }
          agentMap[agentId].amount += amount;
          agentMap[agentId].count += 1;
        }

        // Branch metrics
        if (event.parcel && event.parcel.destinationLocation) {
          const branchId = event.parcel.destinationLocation.id;
          if (!branchMap[branchId]) {
            branchMap[branchId] = { name: event.parcel.destinationLocation.name, amount: 0, count: 0 };
          }
          branchMap[branchId].amount += amount;
          branchMap[branchId].count += 1;
        }
      }

      if (event.eventType === 'SETTLED_TO_SELLER') {
        totalSettled += amount;
      }

      if (event.eventType === 'DISCREPANCY_FLAGGED') {
        discrepanciesCount += 1;
        discrepanciesList.push({
          parcelId: event.parcelId,
          expected: Number(event.expectedAmount),
          confirmed: Number(event.confirmedAmount ?? 0),
          note: event.discrepancyNote,
        });
      }
    });

    // Get current pending amount (all active branch holdings)
    const pendingParcels = await db.parcel.findMany({
      where: {
        ...filter,
        currentState: { in: ['HANDOVER_TO_ORIGIN_BRANCH', 'HANDOVER_TO_ORIGIN_HUB', 'HANDOVER_TO_DEST_HUB'] },
      },
      select: { codAmount: true },
    });
    totalPending = pendingParcels.reduce((sum, p) => sum + Number(p.codAmount), 0);

    return NextResponse.json({
      date: targetDate.toISOString().split('T')[0],
      totalCollected,
      totalSettled,
      totalPending,
      discrepanciesCount,
      discrepanciesList,
      agents: Object.values(agentMap),
      branches: Object.values(branchMap),
    });
  } catch (error: any) {
    console.error('Daily report error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
