import { TimetableError, ErrorCode, ErrorSeverity, UIError } from './TimetableErrors';
import { ErrorHandler } from './ErrorHandler';

export interface ErrorBoundaryOptions {
  fallbackUI?: () => void;
  onError?: (error: TimetableError) => void;
  enableRecovery?: boolean;
  maxRecoveryAttempts?: number;
  component?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: TimetableError;
  errorInfo?: any;
  recoveryAttempts: number;
  isRecovering: boolean;
}

/**
 * Error boundary for UI components to handle and recover from errors gracefully
 */
export class ErrorBoundary {
  private state: ErrorBoundaryState;
  private options: Required<ErrorBoundaryOptions>;
  private errorHandler: ErrorHandler;

  constructor(options: ErrorBoundaryOptions = {}) {
    this.options = {
      fallbackUI: options.fallbackUI || this.defaultFallbackUI,
      onError: options.onError || (() => {}),
      enableRecovery: options.enableRecovery ?? true,
      maxRecoveryAttempts: options.maxRecoveryAttempts ?? 3,
      component: options.component || 'Unknown'
    };

    this.state = {
      hasError: false,
      recoveryAttempts: 0,
      isRecovering: false
    };

    this.errorHandler = new ErrorHandler({
      enableLogging: true,
      enableUserGuidance: true,
      enableAutoRecovery: this.options.enableRecovery
    });
  }

  /**
   * Wrap a function with error boundary protection
   */
  wrap<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: any[]) => {
      try {
        const result = fn(...args);
        
        // Handle async functions
        if (result && typeof result.then === 'function') {
          return result.catch((error: Error) => this.handleError(error));
        }
        
        return result;
      } catch (error) {
        return this.handleError(error);
      }
    }) as T;
  }

  /**
   * Wrap an async function with error boundary protection
   */
  wrapAsync<T extends (...args: any[]) => Promise<any>>(fn: T): T {
    return (async (...args: any[]) => {
      try {
        return await fn(...args);
      } catch (error) {
        return await this.handleError(error);
      }
    }) as T;
  }

  /**
   * Execute a function within the error boundary
   */
  async execute<T>(fn: () => T | Promise<T>, operation?: string): Promise<T | null> {
    try {
      this.resetErrorState();
      const result = await fn();
      return result;
    } catch (error) {
      await this.handleError(error, operation);
      return null;
    }
  }

  /**
   * Handle errors that occur within the boundary
   */
  private async handleError(error: Error, operation?: string): Promise<any> {
    // Convert to TimetableError if needed
    const timetableError = this.ensureTimetableError(error, operation);
    
    // Update state
    this.state = {
      hasError: true,
      error: timetableError,
      errorInfo: {
        component: this.options.component,
        operation,
        timestamp: new Date(),
        stack: error.stack
      },
      recoveryAttempts: this.state.recoveryAttempts,
      isRecovering: false
    };

    // Call error handler
    const report = await this.errorHandler.handleError(timetableError, {
      component: this.options.component,
      operation
    });

    // Call custom error handler
    this.options.onError(timetableError);

    // Attempt recovery if enabled
    if (this.options.enableRecovery && this.canAttemptRecovery()) {
      return await this.attemptRecovery();
    }

    // Show fallback UI
    this.options.fallbackUI();
    
    // Re-throw critical errors
    if (timetableError.severity === ErrorSeverity.CRITICAL) {
      throw timetableError;
    }

    return null;
  }

  /**
   * Attempt to recover from the error
   */
  private async attemptRecovery(): Promise<any> {
    if (!this.state.error || this.state.isRecovering) {
      return null;
    }

    this.state.isRecovering = true;
    this.state.recoveryAttempts++;

    try {
      console.log(`🔄 Attempting recovery (${this.state.recoveryAttempts}/${this.options.maxRecoveryAttempts})...`);
      
      // Try recovery actions from the error
      const recoveryActions = this.state.error.getRecoveryActions();
      
      for (const action of recoveryActions) {
        if (action.action && action.type === 'retry') {
          try {
            await action.action();
            
            // Recovery successful
            this.resetErrorState();
            console.log('✅ Recovery successful!');
            return true;
          } catch (recoveryError) {
            console.warn(`Recovery action failed: ${recoveryError.message}`);
            continue;
          }
        }
      }

      // If no recovery actions worked, try fallback strategies
      return await this.tryFallbackRecovery();
      
    } catch (recoveryError) {
      console.error('Recovery attempt failed:', recoveryError.message);
      return null;
    } finally {
      this.state.isRecovering = false;
    }
  }

  /**
   * Try fallback recovery strategies
   */
  private async tryFallbackRecovery(): Promise<any> {
    if (!this.state.error) return null;

    // Different fallback strategies based on error type
    switch (this.state.error.code) {
      case ErrorCode.USER_INPUT_ERROR:
        return this.recoverFromInputError();
      
      case ErrorCode.INTERFACE_ERROR:
        return this.recoverFromInterfaceError();
      
      case ErrorCode.DISPLAY_ERROR:
        return this.recoverFromDisplayError();
      
      default:
        return this.genericRecovery();
    }
  }

  /**
   * Recover from input errors
   */
  private async recoverFromInputError(): Promise<any> {
    console.log('🔧 Attempting input error recovery...');
    
    // Clear any cached input data
    // Reset input forms to default state
    // This would be implemented based on specific UI framework
    
    return true;
  }

  /**
   * Recover from interface errors
   */
  private async recoverFromInterfaceError(): Promise<any> {
    console.log('🔧 Attempting interface error recovery...');
    
    // Refresh UI components
    // Reset component state
    // This would be implemented based on specific UI framework
    
    return true;
  }

  /**
   * Recover from display errors
   */
  private async recoverFromDisplayError(): Promise<any> {
    console.log('🔧 Attempting display error recovery...');
    
    // Switch to simplified display mode
    // Reduce visual complexity
    // This would be implemented based on specific UI framework
    
    return true;
  }

  /**
   * Generic recovery strategy
   */
  private async genericRecovery(): Promise<any> {
    console.log('🔧 Attempting generic recovery...');
    
    // Wait a moment and retry
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Reset component state
    this.resetErrorState();
    
    return true;
  }

  /**
   * Check if recovery can be attempted
   */
  private canAttemptRecovery(): boolean {
    return this.state.recoveryAttempts < this.options.maxRecoveryAttempts &&
           this.state.error?.isRecoverable() === true;
  }

  /**
   * Reset error state
   */
  private resetErrorState(): void {
    this.state = {
      hasError: false,
      recoveryAttempts: 0,
      isRecovering: false
    };
  }

  /**
   * Convert regular Error to TimetableError
   */
  private ensureTimetableError(error: Error, operation?: string): TimetableError {
    if (error instanceof TimetableError) {
      return error;
    }

    // Create UI error for boundary-caught errors
    return new UIError(
      ErrorCode.INTERFACE_ERROR,
      error.message,
      'An interface error occurred. The system is attempting to recover.',
      this.options.component,
      operation,
      {
        component: this.options.component,
        operation,
        originalError: error.message
      }
    );
  }

  /**
   * Default fallback UI
   */
  private defaultFallbackUI(): void {
    console.log('🚨 Error Boundary Activated');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('An error occurred in the user interface.');
    console.log('The system is attempting to recover...');
    
    if (this.state.error) {
      console.log(`\nError: ${this.state.error.getUserMessage()}`);
      
      const recoveryActions = this.state.error.getRecoveryActions();
      if (recoveryActions.length > 0) {
        console.log('\nSuggested actions:');
        recoveryActions.forEach((action, index) => {
          console.log(`  ${index + 1}. ${action.description}`);
        });
      }
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  /**
   * Get current error state
   */
  getState(): ErrorBoundaryState {
    return { ...this.state };
  }

  /**
   * Check if boundary has an error
   */
  hasError(): boolean {
    return this.state.hasError;
  }

  /**
   * Get current error
   */
  getError(): TimetableError | undefined {
    return this.state.error;
  }

  /**
   * Manually trigger recovery
   */
  async recover(): Promise<boolean> {
    if (!this.state.hasError || !this.canAttemptRecovery()) {
      return false;
    }

    const result = await this.attemptRecovery();
    return result !== null;
  }

  /**
   * Clear error state manually
   */
  clearError(): void {
    this.resetErrorState();
  }

  /**
   * Get error statistics from the error handler
   */
  getErrorStatistics() {
    return this.errorHandler.getErrorStatistics();
  }
}

/**
 * Global error boundary for the entire application
 */
export class GlobalErrorBoundary extends ErrorBoundary {
  private static instance: GlobalErrorBoundary;

  private constructor() {
    super({
      component: 'Global',
      enableRecovery: true,
      maxRecoveryAttempts: 5,
      fallbackUI: () => {
        console.log('🚨 GLOBAL ERROR BOUNDARY ACTIVATED');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('A critical error occurred in the application.');
        console.log('The system is attempting emergency recovery procedures...');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }
    });

    // Set up global error handlers
    this.setupGlobalHandlers();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): GlobalErrorBoundary {
    if (!GlobalErrorBoundary.instance) {
      GlobalErrorBoundary.instance = new GlobalErrorBoundary();
    }
    return GlobalErrorBoundary.instance;
  }

  /**
   * Set up global error handlers
   */
  private setupGlobalHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      console.error('🚨 Uncaught Exception:', error.message);
      this.handleError(error, 'uncaughtException');
      
      // Give time for error handling, then exit
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      console.error('🚨 Unhandled Promise Rejection:', reason);
      
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.handleError(error, 'unhandledRejection');
    });

    // Handle warnings
    process.on('warning', (warning: Error) => {
      console.warn('⚠️ Process Warning:', warning.message);
    });
  }

  /**
   * Initialize global error boundary
   */
  static initialize(): GlobalErrorBoundary {
    return GlobalErrorBoundary.getInstance();
  }
}
