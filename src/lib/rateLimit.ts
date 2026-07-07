export interface RateLimitStatus {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

const store = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(identifier: string, limit: number, windowMs: number): RateLimitStatus {
  const now = Date.now();
  
  // Clean up expired entries (simple garbage collection on access)
  for (const [key, val] of store.entries()) {
    if (val.resetTime < now) store.delete(key);
  }

  let record = store.get(identifier);

  if (!record) {
    record = { count: 0, resetTime: now + windowMs };
    store.set(identifier, record);
  }

  if (now > record.resetTime) {
    record = { count: 0, resetTime: now + windowMs };
    store.set(identifier, record);
  }

  record.count += 1;

  return {
    success: record.count <= limit,
    limit,
    remaining: Math.max(0, limit - record.count),
    reset: record.resetTime,
  };
}
