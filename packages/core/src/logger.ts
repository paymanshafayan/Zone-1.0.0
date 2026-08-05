/**
 * Zone Logger — Structured logging for the entire system
 *
 * Uses Pino-compatible JSON format for production,
 * pretty-print for development.
 */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  level: LogLevel;
  msg: string;
  timestamp: string;
  [key: string]: any;
}

export class Logger {
  private context: Record<string, any>;
  private minLevel: LogLevel;
  private handler: (entry: LogEntry) => void;

  private static LEVEL_ORDER: Record<LogLevel, number> = {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
    fatal: 5,
  };

  constructor(options: {
    context?: Record<string, any>;
    minLevel?: LogLevel;
    handler?: (entry: LogEntry) => void;
  } = {}) {
    this.context = options.context || {};
    this.minLevel = options.minLevel || 'info';
    this.handler = options.handler || Logger.defaultHandler;
  }

  trace(msg: string, data?: Record<string, any>): void {
    this.log('trace', msg, data);
  }

  debug(msg: string, data?: Record<string, any>): void {
    this.log('debug', msg, data);
  }

  info(msg: string, data?: Record<string, any>): void {
    this.log('info', msg, data);
  }

  warn(msg: string, data?: Record<string, any>): void {
    this.log('warn', msg, data);
  }

  error(msg: string, data?: Record<string, any>): void {
    this.log('error', msg, data);
  }

  fatal(msg: string, data?: Record<string, any>): void {
    this.log('fatal', msg, data);
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, any>): Logger {
    return new Logger({
      context: { ...this.context, ...context },
      minLevel: this.minLevel,
      handler: this.handler,
    });
  }

  private log(level: LogLevel, msg: string, data?: Record<string, any>): void {
    if (Logger.LEVEL_ORDER[level] < Logger.LEVEL_ORDER[this.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      level,
      msg,
      timestamp: new Date().toISOString(),
      ...this.context,
      ...data,
    };

    this.handler(entry);
  }

  private static defaultHandler(entry: LogEntry): void {
    const output = JSON.stringify(entry);

    if (entry.level === 'fatal' || entry.level === 'error') {
      process.stderr.write(output + '\n');
    } else {
      process.stdout.write(output + '\n');
    }
  }
}
