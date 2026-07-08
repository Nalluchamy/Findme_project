import crypto from 'crypto';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-for-jwt-signing';

export interface UserSession {
  id: string;
  username: string;
  name: string;
  role: string;
  locationId: string | null;
  companyId: string | null;
}

export function signToken(payload: UserSession): string {
  // Add expiration time: 1 hour from now
  const exp = Math.floor(Date.now() / 1000) + (60 * 60);
  const payloadWithExp = { ...payload, exp };
  
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payloadWithExp)).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
    
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): UserSession | null {
  try {
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) return null;
    
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
      
    if (signature !== expectedSignature) return null;
    
    const parsedBody = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    
    // Check expiration
    if (parsedBody.exp && parsedBody.exp < Math.floor(Date.now() / 1000)) {
      return null; // Token expired
    }
    
    return parsedBody as UserSession;
  } catch {
    return null;
  }
}

export function getSession(req: NextRequest): UserSession | null {
  const cookie = req.cookies.get('session');
  if (!cookie) return null;
  return verifyToken(cookie.value);
}
