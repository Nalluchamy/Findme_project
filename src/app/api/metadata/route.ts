import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const locations = await db.location.findMany({
      orderBy: { name: 'asc' },
    });

    const users = await db.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        locationId: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ locations, users });
  } catch (error: any) {
    console.error('Metadata error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
