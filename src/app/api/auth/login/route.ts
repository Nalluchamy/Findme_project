import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { loginSchema } from '@/lib/validations';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = loginSchema.safeParse(json);
    
    if (!parsed.success) {
      logger.warn('Login failed: Invalid input format', { details: parsed.error.issues });
      return NextResponse.json({ error: 'Invalid input format' }, { status: 400 });
    }
    
    const { username, password } = parsed.data;
    
    const user = await db.user.findUnique({
      where: { username },
    });
    
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      logger.warn('Login failed: Invalid credentials', { details: { username } });
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    
    const sessionPayload = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      locationId: user.locationId,
    };
    
    const token = signToken(sessionPayload);
    const csrfToken = crypto.randomBytes(32).toString('hex');
    
    logger.info('User logged in successfully', { userId: user.id, details: { role: user.role } });
    
    const response = NextResponse.json({ user: sessionPayload, csrfToken });
    
    response.cookies.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });
    
    response.cookies.set('csrf_token', csrfToken, {
      httpOnly: false, // Must be readable by JS so it can be sent as X-CSRF-Token header
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    
    return response;
  } catch (error: any) {
    logger.error('Login system error', { details: error.message });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
