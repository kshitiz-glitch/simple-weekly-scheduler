import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  level?: LogLevel;
  enableColors?: boolean;
  enableFileLogging?: boolean;
  logDirectory?: string;
  maxLogFiles?: number;
  maxLogSizeBytes?: number;
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  data?: any;
  component?: string;
  operation?: string;
}

/**
 * Logging utility for the timetable generator
 */
export class Logger {
  private options: Required<LoggerOptions>;
  private logLevels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  constructor(options: LoggerOptions = {}) {
    this.options = {
      level: options.level ?? 'info',
      enableColors: options.enableColors ?? true,
      enableFileLogging: options.enableFileLogging ?? false,
      logDirectory: options.logDirectory ?? './logs',
      maxLogFiles: options.maxLogFiles ?? 10,
      maxLogSizeBytes: options.maxLogSizeBytes ?? 10 * 1024 * 1024 // 10MB
    };

    if (this.options.enableFileLogging) {
      this.ensureLogDirectory();
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: any, component?: string, operation?: string): void {
    this.log('debug', message, data, component, operation);
  }

  /**
   * Log info message
   */
  info(message: string, data?: any, component?: string, operation?: string): void {
    this.log('info', message, data, component, operation);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: any, component?: string, operation?: string): void {
    this.log('warn', message, data, component, operation);
  }

  /**
   * Log error message
   */
  error(message: string, data?: any, component?: string, operation?: string): void {
    this.log('error', message, data, component, operation);
  }

  /**
   * Main logging method
   */
  private log(level: LogLevel, message: string, data?: any, component?: string, operation?: string): void {
    // Check if this log level should be output
    if (this.logLevels[level] < this.logLevels[this.options.level]) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      data,
      component,
      operation
    };

    // Console output
    this.logToConsole(logEntry);

    // File output
    if (this.options.enableFileLogging) {
      this.logToFile(logEntry);
    }
  }

  /**
   * Log to console with colors
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelStr = entry.level.toUpperCase().padEnd(5);
    
    let colorCode = '';
    let resetCode = '';
    
    if (this.options.enableColors) {
      switch (entry.level) {
        case 'debug':
          colorCode = '\x1b[90m'; // Gray
          break;
        case 'info':
          colorCode = '\x1b[36m'; // Cyan
          break;
        case 'warn':
          colorCode = '\x1b[33m'; // Yellow
          break;
        case 'error':
          colorCode = '\x1b[31m'; // Red
          break;
      }
      resetCode = '\x1b[0m';
    }

    let logLine = `${colorCode}[${timestamp}] ${levelStr} ${entry.message}${resetCode}`;
    
    if (entry.component) {
      logLine += ` (${entry.component}`;
      if (entry.operation) {
        logLine += `:${entry.operation}`;
      }
      logLine += ')';
    }

    console.log(logLine);

    // Log data if present
    if (entry.data) {
      if (typeof entry.data === 'object') {
        console.log(JSON.stringify(entry.data, null, 2));
      } else {
        console.log(entry.data);
      }
    }
  }

  /**
   * Log to file
   */
  private logToFile(entry: LogEntry): void {
    try {
      const logFileName = this.getLogFileName();
      const logFilePath = path.join(this.options.logDirectory, logFileName);
      
      // Check if log rotation is needed
      if (fs.existsSync(logFilePath)) {
        const stats = fs.statSync(logFilePath);
        if (stats.size > this.options.maxLogSizeBytes) {
          this.rotateLogFile(logFilePath);
        }
      }

      const logLine = this.formatLogEntry(entry);
      fs.appendFileSync(logFilePath, logLine + '\n', 'utf8');
    } catch (error) {
      // Fallback to console if file logging fails
      console.error('Failed to write to log file:', error.message);
    }
  }

  /**
   * Format log entry for file output
   */
  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    
    let logLine = `[${timestamp}] ${level} ${entry.message}`;
    
    if (entry.component) {
      logLine += ` (${entry.component}`;
      if (entry.operation) {
        logLine += `:${entry.operation}`;
      }
      logLine += ')';
    }

    if (entry.data) {
      logLine += ` | Data: ${JSON.stringify(entry.data)}`;
    }

    return logLine;
  }

  /**
   * Get current log file name
   */
  private getLogFileName(): string {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    return `timetable-${dateStr}.log`;
  }

  /**
   * Rotate log file when it gets too large
   */
  private rotateLogFile(currentLogPath: string): void {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedPath = currentLogPath.replace('.log', `-${timestamp}.log`);
      
      fs.renameSync(currentLogPath, rotatedPath);
      
      // Clean up old log files
      this.cleanupOldLogFiles();
    } catch (error) {
      console.error('Failed to rotate log file:', error.message);
    }
  }

  /**
   * Clean up old log files
   */
  private cleanupOldLogFiles(): void {
    try {
      const files = fs.readdirSync(this.options.logDirectory)
        .filter(file => file.startsWith('timetable-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.options.logDirectory, file),
          stats: fs.statSync(path.join(this.options.logDirectory, file))
        }))
        .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());

      // Keep only the most recent files
      const filesToDelete = files.slice(this.options.maxLogFiles);
      
      filesToDelete.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (error) {
          console.error(`Failed to delete old log file ${file.name}:`, error.message);
        }
      });
    } catch (error) {
      console.error('Failed to cleanup old log files:', error.message);
    }
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    try {
      if (!fs.existsSync(this.options.logDirectory)) {
        fs.mkdirSync(this.options.logDirectory, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error.message);
      this.options.enableFileLogging = false;
    }
  }

  /**
   * Get log statistics
   */
  getLogStatistics(): {
    totalLogFiles: number;
    totalLogSize: number;
    oldestLogDate?: Date;
    newestLogDate?: Date;
  } {
    if (!this.options.enableFileLogging || !fs.existsSync(this.options.logDirectory)) {
      return {
        totalLogFiles: 0,
        totalLogSize: 0
      };
    }

    try {
      const files = fs.readdirSync(this.options.logDirectory)
        .filter(file => file.startsWith('timetable-') && file.endsWith('.log'))
        .map(file => {
          const filePath = path.join(this.options.logDirectory, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            size: stats.size,
            mtime: stats.mtime
          };
        });

      const totalLogSize = files.reduce((sum, file) => sum + file.size, 0);
      const dates = files.map(f => f.mtime).sort((a, b) => a.getTime() - b.getTime());

      return {
        totalLogFiles: files.length,
        totalLogSize,
        oldestLogDate: dates.length > 0 ? dates[0] : undefined,
        newestLogDate: dates.length > 0 ? dates[dates.length - 1] : undefined
      };
    } catch (error) {
      console.error('Failed to get log statistics:', error.message);
      return {
        totalLogFiles: 0,
        totalLogSize: 0
      };
    }
  }

  /**
   * Read recent log entries
   */
  getRecentLogEntries(count: number = 100): LogEntry[] {
    if (!this.options.enableFileLogging) {
      return [];
    }

    try {
      const logFileName = this.getLogFileName();
      const logFilePath = path.join(this.options.logDirectory, logFileName);
      
      if (!fs.existsSync(logFilePath)) {
        return [];
      }

      const content = fs.readFileSync(logFilePath, 'utf8');
      const lines = content.trim().split('\n').slice(-count);
      
      return lines.map(line => this.parseLogLine(line)).filter(entry => entry !== null) as LogEntry[];
    } catch (error) {
      console.error('Failed to read log entries:', error.message);
      return [];
    }
  }

  /**
   * Parse log line back to LogEntry
   */
  private parseLogLine(line: string): LogEntry | null {
    try {
      // Parse format: [timestamp] LEVEL message (component:operation) | Data: {...}
      const timestampMatch = line.match(/^\[([^\]]+)\]/);
      if (!timestampMatch) return null;

      const timestamp = new Date(timestampMatch[1]);
      const rest = line.substring(timestampMatch[0].length).trim();

      const levelMatch = rest.match(/^(\w+)\s+(.+)$/);
      if (!levelMatch) return null;

      const level = levelMatch[1].toLowerCase() as LogLevel;
      let message = levelMatch[2];

      let component: string | undefined;
      let operation: string | undefined;
      let data: any;

      // Extract component and operation
      const componentMatch = message.match(/\(([^:)]+)(?::([^)]+))?\)$/);
      if (componentMatch) {
        component = componentMatch[1];
        operation = componentMatch[2];
        message = message.replace(componentMatch[0], '').trim();
      }

      // Extract data
      const dataMatch = message.match(/\s+\|\s+Data:\s+(.+)$/);
      if (dataMatch) {
        try {
          data = JSON.parse(dataMatch[1]);
          message = message.replace(dataMatch[0], '').trim();
        } catch {
          // If JSON parsing fails, keep data as string
          data = dataMatch[1];
        }
      }

      return {
        timestamp,
        level,
        message,
        data,
        component,
        operation
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear all log files
   */
  clearLogs(): void {
    if (!this.options.enableFileLogging || !fs.existsSync(this.options.logDirectory)) {
      return;
    }

    try {
      const files = fs.readdirSync(this.options.logDirectory)
        .filter(file => file.startsWith('timetable-') && file.endsWith('.log'));

      files.forEach(file => {
        const filePath = path.join(this.options.logDirectory, file);
        fs.unlinkSync(filePath);
      });
    } catch (error) {
      console.error('Failed to clear logs:', error.message);
    }
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.options.level = level;
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.options.level;
  }
}
