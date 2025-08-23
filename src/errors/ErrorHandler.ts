import { TimetableError, ErrorSeverity, ErrorCode, ErrorContext, ErrorRecoveryAction } from './TimetableErrors';
import { Logger } from '../utils/Logger';

export interface ErrorHandlerOptions {
  enableLogging?: boolean;
  enableUserGuidance?: boolean;
  enableAutoRecovery?: boolean;
  maxRetryAttempts?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  enableColors?: boolean;
}

export interface ErrorReport {
  error: TimetableError;
  handled: boolean;
  recoveryAttempted: boolean;
  recoverySuccessful?: boolean;
  userNotified: boolean;
  timestamp: Date;
  handlingDuration: number;
}

export interface RecoveryResult {
  success: boolean;
  action: ErrorRecoveryAction;
  message: string;
  retryCount?: number;
}

/**
 * Centralized error handling service for the timetable application
 */
export class ErrorHandler {
  private options: Required<ErrorHandlerOptions>;
  private logger: Logger;
  private errorHistory: ErrorReport[] = [];
  private retryCounters: Map<string, number> = new Map();
  private recoveryStrategies: Map<ErrorCode, (error: TimetableError) => Promise<RecoveryResult>> = new Map();

  constructor(options: ErrorHandlerOptions = {}) {
    this.options = {
      enableLogging: options.enableLogging ?? true,
      enableUserGuidance: options.enableUserGuidance ?? true,
      enableAutoRecovery: options.enableAutoRecovery ?? true,
      maxRetryAttempts: options.maxRetryAttempts ?? 3,
      logLevel: options.logLevel ?? 'error',
      enableColors: options.enableColors ?? true
    };

    this.logger = new Logger({
      level: this.options.logLevel,
      enableColors: this.options.enableColors,
      enableFileLogging: this.options.enableLogging
    });

    this.initializeRecoveryStrategies();
  }

  /**
   * Main error handling entry point
   */
  async handleError(error: Error | TimetableError, context?: ErrorContext): Promise<ErrorReport> {
    const startTime = Date.now();
    
    // Convert regular errors to TimetableError if needed
    const timetableError = this.ensureTimetableError(error, context);
    
    // Create error report
    const report: ErrorReport = {
      error: timetableError,
      handled: false,
      recoveryAttempted: false,
      userNotified: false,
      timestamp: new Date(),
      handlingDuration: 0
    };

    try {
      // Log the error
      if (this.options.enableLogging) {
        await this.logError(timetableError);
      }

      // Attempt recovery if enabled and error is recoverable
      if (this.options.enableAutoRecovery && timetableError.isRecoverable()) {
        const recoveryResult = await this.attemptRecovery(timetableError);
        report.recoveryAttempted = true;
        report.recoverySuccessful = recoveryResult.success;
      }

      // Notify user if enabled
      if (this.options.enableUserGuidance) {
        await this.notifyUser(timetableError);
        report.userNotified = true;
      }

      report.handled = true;
    } catch (handlingError) {
      // Error occurred while handling the original error
      this.logger.error('Error occurred during error handling', {
        originalError: timetableError.getTechnicalDetails(),
        handlingError: handlingError.message
      });
    } finally {
      report.handlingDuration = Date.now() - startTime;
      this.errorHistory.push(report);
      
      // Keep only last 100 error reports
      if (this.errorHistory.length > 100) {
        this.errorHistory = this.errorHistory.slice(-100);
      }
    }

    return report;
  }

  /**
   * Handle multiple errors (batch processing)
   */
  async handleErrors(errors: (Error | TimetableError)[], context?: ErrorContext): Promise<ErrorReport[]> {
    const reports: ErrorReport[] = [];
    
    for (const error of errors) {
      const report = await this.handleError(error, context);
      reports.push(report);
      
      // Stop processing if we encounter a critical error
      if (report.error.severity === ErrorSeverity.CRITICAL && !report.recoverySuccessful) {
        this.logger.warn('Stopping batch error processing due to critical error');
        break;
      }
    }
    
    return reports;
  }

  /**
   * Register custom recovery strategy for specific error codes
   */
  registerRecoveryStrategy(
    errorCode: ErrorCode,
    strategy: (error: TimetableError) => Promise<RecoveryResult>
  ): void {
    this.recoveryStrategies.set(errorCode, strategy);
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByCode: Map<ErrorCode, number>;
    errorsBySeverity: Map<ErrorSeverity, number>;
    recoverySuccessRate: number;
    averageHandlingTime: number;
  } {
    const errorsByCode = new Map<ErrorCode, number>();
    const errorsBySeverity = new Map<ErrorSeverity, number>();
    let totalRecoveryAttempts = 0;
    let successfulRecoveries = 0;
    let totalHandlingTime = 0;

    this.errorHistory.forEach(report => {
      // Count by error code
      const currentCodeCount = errorsByCode.get(report.error.code) || 0;
      errorsByCode.set(report.error.code, currentCodeCount + 1);

      // Count by severity
      const currentSeverityCount = errorsBySeverity.get(report.error.severity) || 0;
      errorsBySeverity.set(report.error.severity, currentSeverityCount + 1);

      // Recovery statistics
      if (report.recoveryAttempted) {
        totalRecoveryAttempts++;
        if (report.recoverySuccessful) {
          successfulRecoveries++;
        }
      }

      totalHandlingTime += report.handlingDuration;
    });

    return {
      totalErrors: this.errorHistory.length,
      errorsByCode,
      errorsBySeverity,
      recoverySuccessRate: totalRecoveryAttempts > 0 ? (successfulRecoveries / totalRecoveryAttempts) * 100 : 0,
      averageHandlingTime: this.errorHistory.length > 0 ? totalHandlingTime / this.errorHistory.length : 0
    };
  }

  /**
   * Get recent error reports
   */
  getRecentErrors(count: number = 10): ErrorReport[] {
    return this.errorHistory.slice(-count);
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
    this.retryCounters.clear();
  }

  /**
   * Check if system is in a healthy state
   */
  isSystemHealthy(): boolean {
    const recentErrors = this.getRecentErrors(10);
    const criticalErrors = recentErrors.filter(r => r.error.severity === ErrorSeverity.CRITICAL);
    const unrecoveredErrors = recentErrors.filter(r => r.recoveryAttempted && !r.recoverySuccessful);
    
    // System is unhealthy if there are recent critical errors or many unrecovered errors
    return criticalErrors.length === 0 && unrecoveredErrors.length < 3;
  }

  /**
   * Generate error report for debugging
   */
  generateErrorReport(): string {
    const stats = this.getErrorStatistics();
    const recentErrors = this.getRecentErrors(5);
    
    let report = '=== TIMETABLE GENERATOR ERROR REPORT ===\n\n';
    
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `System Health: ${this.isSystemHealthy() ? 'HEALTHY' : 'UNHEALTHY'}\n\n`;
    
    report += '--- STATISTICS ---\n';
    report += `Total Errors: ${stats.totalErrors}\n`;
    report += `Recovery Success Rate: ${stats.recoverySuccessRate.toFixed(1)}%\n`;
    report += `Average Handling Time: ${stats.averageHandlingTime.toFixed(2)}ms\n\n`;
    
    report += '--- ERRORS BY SEVERITY ---\n';
    stats.errorsBySeverity.forEach((count, severity) => {
      report += `${severity.toUpperCase()}: ${count}\n`;
    });
    
    report += '\n--- ERRORS BY CODE ---\n';
    Array.from(stats.errorsByCode.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([code, count]) => {
        report += `${code}: ${count}\n`;
      });
    
    report += '\n--- RECENT ERRORS ---\n';
    recentErrors.forEach((errorReport, index) => {
      report += `${index + 1}. [${errorReport.error.severity.toUpperCase()}] ${errorReport.error.code}\n`;
      report += `   Message: ${errorReport.error.message}\n`;
      report += `   Time: ${errorReport.timestamp.toISOString()}\n`;
      report += `   Recovered: ${errorReport.recoverySuccessful ? 'Yes' : 'No'}\n\n`;
    });
    
    return report;
  }

  /**
   * Convert regular Error to TimetableError
   */
  private ensureTimetableError(error: Error | TimetableError, context?: ErrorContext): TimetableError {
    if (error instanceof TimetableError) {
      return error;
    }

    // Convert regular Error to TimetableError
    return new (class extends TimetableError {
      constructor() {
        super(
          ErrorCode.DEPENDENCY_ERROR,
          error.message,
          'An unexpected error occurred. Please try again or contact support.',
          ErrorSeverity.MEDIUM,
          context || {},
          [
            {
              type: 'retry',
              description: 'Retry the operation'
            }
          ]
        );
      }
    })();
  }

  /**
   * Log error with appropriate level
   */
  private async logError(error: TimetableError): Promise<void> {
    const logData = {
      ...error.getTechnicalDetails(),
      userMessage: error.getUserMessage(),
      recoverable: error.isRecoverable(),
      recoveryActions: error.getRecoveryActions().map(a => a.description)
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        this.logger.error(`CRITICAL ERROR: ${error.message}`, logData);
        break;
      case ErrorSeverity.HIGH:
        this.logger.error(`HIGH SEVERITY: ${error.message}`, logData);
        break;
      case ErrorSeverity.MEDIUM:
        this.logger.warn(`MEDIUM SEVERITY: ${error.message}`, logData);
        break;
      case ErrorSeverity.LOW:
        this.logger.info(`LOW SEVERITY: ${error.message}`, logData);
        break;
    }
  }

  /**
   * Attempt to recover from error
   */
  private async attemptRecovery(error: TimetableError): Promise<RecoveryResult> {
    const errorKey = `${error.code}_${error.context.operation || 'unknown'}`;
    const retryCount = this.retryCounters.get(errorKey) || 0;

    // Check if we've exceeded max retry attempts
    if (retryCount >= this.options.maxRetryAttempts) {
      return {
        success: false,
        action: { type: 'abort', description: 'Max retry attempts exceeded' },
        message: 'Maximum retry attempts exceeded',
        retryCount
      };
    }

    // Try custom recovery strategy first
    const customStrategy = this.recoveryStrategies.get(error.code);
    if (customStrategy) {
      try {
        const result = await customStrategy(error);
        if (result.success) {
          this.retryCounters.delete(errorKey); // Reset counter on success
        } else {
          this.retryCounters.set(errorKey, retryCount + 1);
        }
        return result;
      } catch (recoveryError) {
        this.logger.warn('Custom recovery strategy failed', {
          errorCode: error.code,
          recoveryError: recoveryError.message
        });
      }
    }

    // Try built-in recovery actions
    for (const action of error.getRecoveryActions()) {
      if (action.type === 'retry' && action.action) {
        try {
          await action.action();
          this.retryCounters.delete(errorKey); // Reset counter on success
          return {
            success: true,
            action,
            message: 'Recovery successful via retry',
            retryCount: retryCount + 1
          };
        } catch (retryError) {
          this.logger.debug('Retry recovery failed', {
            errorCode: error.code,
            retryError: retryError.message
          });
        }
      }
    }

    // Update retry counter
    this.retryCounters.set(errorKey, retryCount + 1);

    return {
      success: false,
      action: error.getRecoveryActions()[0] || { type: 'manual', description: 'Manual intervention required' },
      message: 'Automatic recovery failed',
      retryCount: retryCount + 1
    };
  }

  /**
   * Notify user about the error
   */
  private async notifyUser(error: TimetableError): Promise<void> {
    // In a real application, this would show UI notifications
    // For now, we'll use console output with colors if enabled
    
    const severityColor = this.getSeverityColor(error.severity);
    const icon = this.getSeverityIcon(error.severity);
    
    if (this.options.enableColors) {
      console.log(`\n${severityColor}${icon} ${error.getUserMessage()}\x1b[0m`);
    } else {
      console.log(`\n${icon} ${error.getUserMessage()}`);
    }

    // Show recovery suggestions if available
    const recoveryActions = error.getRecoveryActions();
    if (recoveryActions.length > 0) {
      console.log('\nSuggested actions:');
      recoveryActions.forEach((action, index) => {
        console.log(`  ${index + 1}. ${action.description}`);
      });
    }

    // Show additional context for critical errors
    if (error.severity === ErrorSeverity.CRITICAL) {
      console.log('\n⚠️  This is a critical error that may require immediate attention.');
      console.log('Please save your work and consider restarting the application.');
    }
  }

  /**
   * Initialize built-in recovery strategies
   */
  private initializeRecoveryStrategies(): void {
    // Memory limit recovery
    this.recoveryStrategies.set(ErrorCode.MEMORY_LIMIT_EXCEEDED, async (error) => {
      // Trigger garbage collection if available
      if (global.gc) {
        global.gc();
        return {
          success: true,
          action: { type: 'retry', description: 'Memory cleaned up' },
          message: 'Garbage collection performed, memory freed'
        };
      }
      
      return {
        success: false,
        action: { type: 'manual', description: 'Reduce dataset size' },
        message: 'Unable to free memory automatically'
      };
    });

    // Timeout recovery
    this.recoveryStrategies.set(ErrorCode.TIMEOUT_ERROR, async (error) => {
      return {
        success: false,
        action: { type: 'retry', description: 'Retry with increased timeout' },
        message: 'Consider simplifying the operation or increasing timeout limits'
      };
    });

    // Export failure recovery
    this.recoveryStrategies.set(ErrorCode.EXPORT_FAILED, async (error) => {
      return {
        success: false,
        action: { type: 'fallback', description: 'Try different export format' },
        message: 'Export failed, try using a different format or check file permissions'
      };
    });
  }

  /**
   * Get color code for error severity
   */
  private getSeverityColor(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.CRITICAL: return '\x1b[41m\x1b[37m'; // Red background, white text
      case ErrorSeverity.HIGH: return '\x1b[31m'; // Red text
      case ErrorSeverity.MEDIUM: return '\x1b[33m'; // Yellow text
      case ErrorSeverity.LOW: return '\x1b[36m'; // Cyan text
      default: return '\x1b[0m'; // Reset
    }
  }

  /**
   * Get icon for error severity
   */
  private getSeverityIcon(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.CRITICAL: return '🚨';
      case ErrorSeverity.HIGH: return '❌';
      case ErrorSeverity.MEDIUM: return '⚠️';
      case ErrorSeverity.LOW: return 'ℹ️';
      default: return '❓';
    }
  }
}
