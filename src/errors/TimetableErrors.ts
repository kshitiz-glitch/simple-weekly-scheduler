/**
 * Custom error classes for the Timetable Generator application
 */

export enum ErrorCode {
  // Input validation errors
  INVALID_BATCH_DATA = 'INVALID_BATCH_DATA',
  INVALID_SUBJECT_DATA = 'INVALID_SUBJECT_DATA',
  INVALID_TIME_FORMAT = 'INVALID_TIME_FORMAT',
  DUPLICATE_BATCH_ID = 'DUPLICATE_BATCH_ID',
  DUPLICATE_SUBJECT_ID = 'DUPLICATE_SUBJECT_ID',
  
  // Scheduling errors
  SCHEDULING_IMPOSSIBLE = 'SCHEDULING_IMPOSSIBLE',
  FACULTY_CONFLICT = 'FACULTY_CONFLICT',
  TIME_SLOT_UNAVAILABLE = 'TIME_SLOT_UNAVAILABLE',
  INSUFFICIENT_TIME_SLOTS = 'INSUFFICIENT_TIME_SLOTS',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  
  // Export errors
  EXPORT_FAILED = 'EXPORT_FAILED',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  INVALID_EXPORT_OPTIONS = 'INVALID_EXPORT_OPTIONS',
  
  // System errors
  MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  DEPENDENCY_ERROR = 'DEPENDENCY_ERROR',
  
  // User interface errors
  USER_INPUT_ERROR = 'USER_INPUT_ERROR',
  INTERFACE_ERROR = 'INTERFACE_ERROR',
  DISPLAY_ERROR = 'DISPLAY_ERROR',
  
  // Data integrity errors
  DATA_CORRUPTION = 'DATA_CORRUPTION',
  INCONSISTENT_STATE = 'INCONSISTENT_STATE',
  VALIDATION_FAILED = 'VALIDATION_FAILED'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  component?: string;
  operation?: string;
  userId?: string;
  sessionId?: string;
  timestamp?: Date;
  additionalData?: Record<string, any>;
}

export interface ErrorRecoveryAction {
  type: 'retry' | 'fallback' | 'skip' | 'abort' | 'manual';
  description: string;
  action?: () => Promise<void> | void;
}

/**
 * Base class for all timetable-related errors
 */
export abstract class TimetableError extends Error {
  public readonly code: ErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly recoveryActions: ErrorRecoveryAction[];
  public readonly timestamp: Date;
  public readonly userMessage: string;

  constructor(
    code: ErrorCode,
    message: string,
    userMessage: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context: ErrorContext = {},
    recoveryActions: ErrorRecoveryAction[] = []
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.severity = severity;
    this.context = { ...context, timestamp: new Date() };
    this.recoveryActions = recoveryActions;
    this.timestamp = new Date();
    this.userMessage = userMessage;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get a user-friendly error message
   */
  getUserMessage(): string {
    return this.userMessage;
  }

  /**
   * Get technical details for logging
   */
  getTechnicalDetails(): Record<string, any> {
    return {
      code: this.code,
      severity: this.severity,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }

  /**
   * Check if error is recoverable
   */
  isRecoverable(): boolean {
    return this.recoveryActions.length > 0;
  }

  /**
   * Get suggested recovery actions
   */
  getRecoveryActions(): ErrorRecoveryAction[] {
    return this.recoveryActions;
  }
}

/**
 * Input validation errors
 */
export class ValidationError extends TimetableError {
  public readonly field?: string;
  public readonly value?: any;
  public readonly constraints?: string[];

  constructor(
    code: ErrorCode,
    message: string,
    userMessage: string,
    field?: string,
    value?: any,
    constraints?: string[],
    context: ErrorContext = {}
  ) {
    super(code, message, userMessage, ErrorSeverity.MEDIUM, context, [
      {
        type: 'manual',
        description: 'Please correct the input and try again'
      }
    ]);
    
    this.field = field;
    this.value = value;
    this.constraints = constraints;
  }
}

/**
 * Scheduling-related errors
 */
export class SchedulingError extends TimetableError {
  public readonly conflictingEntries?: any[];
  public readonly suggestedSolutions?: string[];

  constructor(
    code: ErrorCode,
    message: string,
    userMessage: string,
    severity: ErrorSeverity = ErrorSeverity.HIGH,
    conflictingEntries?: any[],
    suggestedSolutions?: string[],
    context: ErrorContext = {}
  ) {
    const recoveryActions: ErrorRecoveryAction[] = [
      {
        type: 'retry',
        description: 'Retry scheduling with different parameters'
      }
    ];

    if (suggestedSolutions && suggestedSolutions.length > 0) {
      recoveryActions.push({
        type: 'manual',
        description: 'Apply suggested solutions: ' + suggestedSolutions.join(', ')
      });
    }

    super(code, message, userMessage, severity, context, recoveryActions);
    
    this.conflictingEntries = conflictingEntries;
    this.suggestedSolutions = suggestedSolutions;
  }
}

/**
 * Export-related errors
 */
export class ExportError extends TimetableError {
  public readonly format?: string;
  public readonly filename?: string;

  constructor(
    code: ErrorCode,
    message: string,
    userMessage: string,
    format?: string,
    filename?: string,
    context: ErrorContext = {}
  ) {
    super(code, message, userMessage, ErrorSeverity.MEDIUM, context, [
      {
        type: 'retry',
        description: 'Retry export operation'
      },
      {
        type: 'fallback',
        description: 'Try exporting in a different format'
      }
    ]);
    
    this.format = format;
    this.filename = filename;
  }
}

/**
 * System-level errors
 */
export class SystemError extends TimetableError {
  public readonly systemInfo?: Record<string, any>;

  constructor(
    code: ErrorCode,
    message: string,
    userMessage: string,
    severity: ErrorSeverity = ErrorSeverity.HIGH,
    systemInfo?: Record<string, any>,
    context: ErrorContext = {}
  ) {
    super(code, message, userMessage, severity, context, [
      {
        type: 'retry',
        description: 'Retry the operation'
      },
      {
        type: 'abort',
        description: 'Abort current operation and restart'
      }
    ]);
    
    this.systemInfo = systemInfo;
  }
}

/**
 * User interface errors
 */
export class UIError extends TimetableError {
  public readonly component?: string;
  public readonly userAction?: string;

  constructor(
    code: ErrorCode,
    message: string,
    userMessage: string,
    component?: string,
    userAction?: string,
    context: ErrorContext = {}
  ) {
    super(code, message, userMessage, ErrorSeverity.LOW, context, [
      {
        type: 'retry',
        description: 'Try the action again'
      },
      {
        type: 'fallback',
        description: 'Use alternative interface method'
      }
    ]);
    
    this.component = component;
    this.userAction = userAction;
  }
}

/**
 * Data integrity errors
 */
export class DataIntegrityError extends TimetableError {
  public readonly dataType?: string;
  public readonly expectedValue?: any;
  public readonly actualValue?: any;

  constructor(
    code: ErrorCode,
    message: string,
    userMessage: string,
    dataType?: string,
    expectedValue?: any,
    actualValue?: any,
    context: ErrorContext = {}
  ) {
    super(code, message, userMessage, ErrorSeverity.CRITICAL, context, [
      {
        type: 'abort',
        description: 'Stop operation to prevent data corruption'
      },
      {
        type: 'manual',
        description: 'Manual intervention required to fix data integrity'
      }
    ]);
    
    this.dataType = dataType;
    this.expectedValue = expectedValue;
    this.actualValue = actualValue;
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends SystemError {
  public readonly timeoutMs: number;
  public readonly operation: string;

  constructor(
    operation: string,
    timeoutMs: number,
    context: ErrorContext = {}
  ) {
    super(
      ErrorCode.TIMEOUT_ERROR,
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      `The operation took too long to complete. This might be due to complex scheduling requirements or system load.`,
      ErrorSeverity.HIGH,
      { timeoutMs, operation },
      context
    );
    
    this.timeoutMs = timeoutMs;
    this.operation = operation;
  }
}

/**
 * Memory limit errors
 */
export class MemoryLimitError extends SystemError {
  public readonly memoryUsed: number;
  public readonly memoryLimit: number;

  constructor(
    memoryUsed: number,
    memoryLimit: number,
    context: ErrorContext = {}
  ) {
    super(
      ErrorCode.MEMORY_LIMIT_EXCEEDED,
      `Memory limit exceeded: ${memoryUsed}MB used, limit is ${memoryLimit}MB`,
      `The operation requires too much memory. Try reducing the dataset size or simplifying the scheduling requirements.`,
      ErrorSeverity.CRITICAL,
      { memoryUsed, memoryLimit },
      context
    );
    
    this.memoryUsed = memoryUsed;
    this.memoryLimit = memoryLimit;
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends SystemError {
  public readonly configKey?: string;
  public readonly configValue?: any;

  constructor(
    message: string,
    userMessage: string,
    configKey?: string,
    configValue?: any,
    context: ErrorContext = {}
  ) {
    super(
      ErrorCode.CONFIGURATION_ERROR,
      message,
      userMessage,
      ErrorSeverity.HIGH,
      { configKey, configValue },
      context
    );
    
    this.configKey = configKey;
    this.configValue = configValue;
  }
}

/**
 * Factory functions for creating common errors
 */
export class ErrorFactory {
  static createValidationError(
    field: string,
    value: any,
    constraints: string[],
    context?: ErrorContext
  ): ValidationError {
    return new ValidationError(
      ErrorCode.INVALID_BATCH_DATA,
      `Validation failed for field '${field}' with value '${value}'`,
      `Invalid ${field}: ${constraints.join(', ')}`,
      field,
      value,
      constraints,
      context
    );
  }

  static createSchedulingImpossibleError(
    reason: string,
    suggestions: string[],
    context?: ErrorContext
  ): SchedulingError {
    return new SchedulingError(
      ErrorCode.SCHEDULING_IMPOSSIBLE,
      `Scheduling impossible: ${reason}`,
      `Unable to create a valid schedule: ${reason}`,
      ErrorSeverity.CRITICAL,
      undefined,
      suggestions,
      context
    );
  }

  static createFacultyConflictError(
    facultyId: string,
    conflictingEntries: any[],
    context?: ErrorContext
  ): SchedulingError {
    return new SchedulingError(
      ErrorCode.FACULTY_CONFLICT,
      `Faculty conflict detected for ${facultyId}`,
      `${facultyId} is assigned to multiple lectures at the same time`,
      ErrorSeverity.HIGH,
      conflictingEntries,
      ['Move one of the conflicting lectures', 'Assign different faculty'],
      context
    );
  }

  static createExportError(
    format: string,
    filename: string,
    reason: string,
    context?: ErrorContext
  ): ExportError {
    return new ExportError(
      ErrorCode.EXPORT_FAILED,
      `Export failed for ${format}: ${reason}`,
      `Failed to export schedule to ${filename}: ${reason}`,
      format,
      filename,
      context
    );
  }

  static createTimeoutError(
    operation: string,
    timeoutMs: number,
    context?: ErrorContext
  ): TimeoutError {
    return new TimeoutError(operation, timeoutMs, context);
  }

  static createMemoryError(
    memoryUsed: number,
    memoryLimit: number,
    context?: ErrorContext
  ): MemoryLimitError {
    return new MemoryLimitError(memoryUsed, memoryLimit, context);
  }

  static createUIError(
    component: string,
    action: string,
    reason: string,
    context?: ErrorContext
  ): UIError {
    return new UIError(
      ErrorCode.INTERFACE_ERROR,
      `UI error in ${component} during ${action}: ${reason}`,
      `An interface error occurred. Please try again or use an alternative method.`,
      component,
      action,
      context
    );
  }

  static createDataIntegrityError(
    dataType: string,
    expected: any,
    actual: any,
    context?: ErrorContext
  ): DataIntegrityError {
    return new DataIntegrityError(
      ErrorCode.DATA_CORRUPTION,
      `Data integrity violation in ${dataType}: expected ${expected}, got ${actual}`,
      `Data corruption detected. The operation has been stopped to prevent further issues.`,
      dataType,
      expected,
      actual,
      context
    );
  }
}

/**
 * Error severity checker
 */
export class ErrorSeverityChecker {
  static isCritical(error: TimetableError): boolean {
    return error.severity === ErrorSeverity.CRITICAL;
  }

  static isHigh(error: TimetableError): boolean {
    return error.severity === ErrorSeverity.HIGH;
  }

  static requiresImmedateAction(error: TimetableError): boolean {
    return error.severity === ErrorSeverity.CRITICAL || error.severity === ErrorSeverity.HIGH;
  }

  static canContinueOperation(error: TimetableError): boolean {
    return error.severity === ErrorSeverity.LOW || error.severity === ErrorSeverity.MEDIUM;
  }
}
