import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';

/** Structured log entry for GCP Cloud Logging */
interface LogEntry {
    severity: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
    message: string;
    requestId?: string;
    component?: string;
    [key: string]: unknown;
}

/** Write a structured JSON log line (GCP Cloud Logging compatible) */
function writeLog(entry: LogEntry): void {
    const output = {
        ...entry,
        timestamp: new Date().toISOString(),
    };
    if (entry.severity === 'ERROR') {
        console.error(JSON.stringify(output));
    } else {
        console.log(JSON.stringify(output));
    }
}

/** Scoped logger bound to a request ID and component */
export interface Logger {
    debug(message: string, data?: Record<string, unknown>): void;
    info(message: string, data?: Record<string, unknown>): void;
    warn(message: string, data?: Record<string, unknown>): void;
    error(message: string, data?: Record<string, unknown>): void;
}

export function createLogger(requestId: string, component: string): Logger {
    const log = (severity: LogEntry['severity'], message: string, data?: Record<string, unknown>) => {
        writeLog({ severity, message, requestId, component, ...data });
    };
    return {
        debug: (msg, data) => log('DEBUG', msg, data),
        info: (msg, data) => log('INFO', msg, data),
        warn: (msg, data) => log('WARNING', msg, data),
        error: (msg, data) => log('ERROR', msg, data),
    };
}

/** Create a standalone logger (not tied to a request) */
export function createStandaloneLogger(component: string): Logger {
    return createLogger('system', component);
}

/** Express middleware: attaches requestId + logger to every request */
export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();
    (req as any).requestId = requestId;
    (req as any).log = createLogger(requestId, 'http');
    next();
}

/** Express middleware: logs every request/response */
export function requestLogMiddleware(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    const log: Logger = (req as any).log;
    const requestId: string = (req as any).requestId;

    log.info(`→ ${req.method} ${req.originalUrl}`, {
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
    });

    res.setHeader('X-Request-Id', requestId);

    res.on('finish', () => {
        const duration = Date.now() - start;
        const level = res.statusCode >= 400 ? 'warn' : 'info';
        log[level](`← ${res.statusCode} ${req.method} ${req.originalUrl} (${duration}ms)`, {
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            durationMs: duration,
        });
    });

    next();
}
