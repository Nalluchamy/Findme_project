export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  event: string;
  userId?: string;
  parcelId?: string;
  details?: any;
  timestamp: string;
}

export const logger = {
  log: (level: LogLevel, event: string, metadata: { userId?: string; parcelId?: string; details?: any } = {}) => {
    const entry: LogEntry = {
      level,
      event,
      timestamp: new Date().toISOString(),
      ...metadata,
    };
    
    // In production, this would stream to CloudWatch, Datadog, etc.
    const logString = JSON.stringify(entry);
    
    if (level === 'error') {
      console.error(logString);
    } else if (level === 'warn') {
      console.warn(logString);
    } else {
      console.info(logString);
    }
  },
  
  info: (event: string, metadata?: any) => logger.log('info', event, metadata),
  warn: (event: string, metadata?: any) => logger.log('warn', event, metadata),
  error: (event: string, metadata?: any) => logger.log('error', event, metadata),
};
