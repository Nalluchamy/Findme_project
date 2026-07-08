import { NextResponse } from 'next/server';
import { getSession } from './auth';
import { ApiResponse } from '@/types';

export function successResponse<T>(data: T, message?: string, status = 200) {
  const body: ApiResponse<T> = {
    success: true,
    message,
    data,
  };
  return NextResponse.json(body, { status });
}

export function errorResponse(code: string, message: string, status = 400) {
  const body: ApiResponse = {
    success: false,
    error: { code, message },
  };
  return NextResponse.json(body, { status });
}

export function requireAuth(req: any, allowedRoles?: string[]) {
  const session = getSession(req);
  if (!session) {
    return { authorized: false, errorResponse: errorResponse('UNAUTHORIZED', 'Access denied. Please log in.', 401), session: null };
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return { authorized: false, errorResponse: errorResponse('FORBIDDEN', 'Insufficient permissions.', 403), session };
  }

  return { authorized: true, errorResponse: null, session };
}
