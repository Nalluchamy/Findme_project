import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({ user: session });
}

export async function POST(req: NextRequest) {
  // Logout
  const response = NextResponse.json({ success: true });
  response.cookies.delete('session');
  return response;
}
