// Error handling module exports

// Core error classes
export {
  TimetableError,
  ValidationError,
  SchedulingError,
  ExportError,
  SystemError,
  UIError,
  DataIntegrityError,
  TimeoutError,
  MemoryLimitError,
  ConfigurationError,
  ErrorFactory,
  ErrorSeverityChecker
} from './TimetableErrors';

export {
  ErrorCode,
  ErrorSeverity,
  ErrorContext,
  ErrorRecoveryAction
} from './TimetableErrors';

// Error handler
export {
  ErrorHandler,
  ErrorHandlerOptions,
  ErrorReport,
  RecoveryResult
} from './ErrorHandler';

// Recovery strategies
export {
  RecoveryStrategy,
  RecoveryContext,
  RecoveryResult as StrategyRecoveryResult,
  SchedulingRecoveryStrategy,
  ExportRecoveryStrategy,
  MemoryRecoveryStrategy,
  TimeoutRecoveryStrategy,
  ValidationRecoveryStrategy,
  RecoveryStrategyManager
} from './RecoveryStrategies';

// Error boundary
export {
  ErrorBoundary,
  GlobalErrorBoundary,
  ErrorBoundaryOptions,
  ErrorBoundaryState
} from './ErrorBoundary';

// Utility functions
export const createErrorHandler = (options?: import('./ErrorHandler').ErrorHandlerOptions) => {
  return new (require('./ErrorHandler').ErrorHandler)(options);
};

export const createRecoveryManager = () => {
  return new (require('./RecoveryStrategies').RecoveryStrategyManager)();
};

export const initializeGlobalErrorHandling = () => {
  return (require('./ErrorBoundary').GlobalErrorBoundary).initialize();
};
