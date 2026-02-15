import type { Request, Response, NextFunction } from 'express';
import { logger } from './logger.js';

/**
 * Request logging middleware that logs structured information about each request
 * Format: JSON structured logging for GCP compatibility
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Store original end function
  const originalEnd = res.end;

  // Override end function to log after response is sent
  res.end = function(...args: unknown[]): Response {
    const duration = Date.now() - startTime;

    // Extract agent_id from authorization header if present
    const agentId = req.headers['x-agent-id'] || req.get('authorization')?.split(' ')[1]?.substring(0, 8) || 'anonymous';

    // Structured log entry
    const logEntry = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      agent_id: agentId,
      timestamp: new Date().toISOString(),
    };

    // Log at appropriate level based on status code
    if (res.statusCode >= 500) {
      logger.error('Request completed with error', logEntry);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed with client error', logEntry);
    } else {
      logger.info('Request completed', logEntry);
    }

    // Call original end function
    return originalEnd.apply(res, args as Parameters<typeof originalEnd>);
  };

  next();
}
