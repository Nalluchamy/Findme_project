import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const search = searchParams.get('search') || '';
    const take = 20;
    const skip = (page - 1) * take;

    let whereClause: any = {};
    if (search) {
      whereClause.id = { contains: search, mode: 'insensitive' };
    }

    if (session.role === 'SELLER') {
      whereClause.sellerId = session.id;
    } else if (session.role === 'DELIVERY_AGENT') {
      whereClause.destinationLocationId = session.locationId || undefined;
    } else if (session.role === 'BRANCH_STAFF' || session.role === 'HUB_OPERATOR') {
      whereClause.OR = [
        { originLocationId: session.locationId || undefined },
        { destinationLocationId: session.locationId || undefined },
        { ledgerEvents: { some: { toPartyId: session.id } } },
        { ledgerEvents: { some: { fromPartyId: session.id } } },
      ];
    }
    // Admin & Finance have no role-based filtering, they see all (plus search)

    const [data, total] = await db.$transaction([
      db.parcel.findMany({
        where: whereClause,
        skip,
        take,
        include: {
          originLocation: true,
          destinationLocation: true,
          ledgerEvents: {
            orderBy: { timestamp: 'desc' },
            include: { fromParty: true, toParty: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.parcel.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(total / take);

    return NextResponse.json({ data, page, pageSize: take, total, totalPages });
  } catch (error: any) {
    console.error('Error fetching parcels:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = getSession(req);
  if (!session || (session.role !== 'ADMIN' && session.role !== 'SELLER')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id, sellerId, codAmount, originLocationId, destinationLocationId } = await req.json();

    if (!id || !sellerId || !codAmount || !originLocationId || !destinationLocationId) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const origin = await db.location.findUnique({ where: { id: originLocationId } });
    const dest = await db.location.findUnique({ where: { id: destinationLocationId } });
    if (!origin || !dest) {
      return NextResponse.json({ error: 'Invalid origin or destination location' }, { status: 400 });
    }

    const parcel = await db.parcel.create({
      data: {
        id,
        sellerId,
        codAmount: parseFloat(codAmount),
        originLocationId,
        destinationLocationId,
        currentState: 'CREATED',
      },
    });

    return NextResponse.json({ parcel });
  } catch (error: any) {
    console.error('Error creating parcel:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Parcel ID already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
