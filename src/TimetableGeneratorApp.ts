import { ConsoleInterface } from './ui/ConsoleInterface';
import { ScheduleGenerator } from './algorithms/ScheduleGenerator';
import { InputManager } from './services/InputManager';
import { ValidationService } from './services/ValidationService';
import { ExportManager } from './exporters/ExportManager';
import { GlobalErrorBoundary, initializeGlobalErrorHandling } from './errors';
import { DayOfWeek } from './models';
import { FacultyConflictConstraint, TimeSlotAvailabilityConstraint } from './services/constraints';

export interface AppConfiguration {
  // Scheduling configuration
  workingDays?: DayOfWeek[];
  workingHours?: { start: string; end: string };
  slotDuration?: number;
  breakDuration?: number;
  maxAttemptsPerLecture?: number;
  allowPartialSchedules?: boolean;
  prioritizeEvenDistribution?: boolean;

  // UI configuration
  enableColors?: boolean;
  showProgressBars?: boolean;
  verboseMode?: boolean;
  autoSave?: boolean;

  // Error handling configuration
  enableLogging?: boolean;
  enableAutoRecovery?: boolean;
  maxRetryAttempts?: number;

  // Performance configuration
  memoryLimitMB?: number;
  timeoutMs?: number;
  enablePerformanceMonitoring?: boolean;
}

export interface AppMetrics {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  totalDuration?: number;
  batchesProcessed: number;
  lecturesGenerated: number;
  conflictsResolved: number;
  exportsCompleted: number;
  errorsEncountered: number;
  memoryPeakMB: number;
  performanceScore: number;
}

/**
 * Main application class that orchestrates all timetable generation components
 */
export class TimetableGeneratorApp {
  private config: Required<AppConfiguration>;
  private consoleInterface: ConsoleInterface;
  private scheduleGenerator: ScheduleGenerator;
  private inputManager: InputManager;
  private validationService: ValidationService;
  private exportManager: ExportManager;
  private globalErrorBoundary: GlobalErrorBoundary;
  private metrics: AppMetrics;
  private isRunning: boolean = false;

  constructor(config: AppConfiguration = {}) {
    this.config = this.mergeWithDefaults(config);
    this.metrics = this.initializeMetrics();
    
    // Initialize global error handling first
    this.globalErrorBoundary = initializeGlobalErrorHandling();
    
    // Initialize core components
    this.initializeComponents();
    
    // Set up graceful shutdown
    this.setupGracefulShutdown();
  }

  /**
   * Start the timetable generation application
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Application is already running.');
      return;
    }

    this.isRunning = true;
    this.metrics.startTime = new Date();

    try {
      console.log('🚀 Starting Automated Timetable Generator...');
      console.log(`📅 Session ID: ${this.metrics.sessionId}`);
      console.log(`⚙️  Configuration: ${this.getConfigurationSummary()}`);
      console.log('');

      // Performance monitoring setup
      if (this.config.enablePerformanceMonitoring) {
        this.startPerformanceMonitoring();
      }

      // Start the main application workflow
      await this.consoleInterface.start();

      // Application completed successfully
      await this.handleSuccessfulCompletion();

    } catch (error) {
      await this.handleApplicationError(error);
    } finally {
      await this.shutdown();
    }
  }

  /**
   * Stop the application gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping Automated Timetable Generator...');
    await this.shutdown();
  }

  /**
   * Get current application metrics
   */
  getMetrics(): AppMetrics {
    return { ...this.metrics };
  }

  /**
   * Get application configuration
   */
  getConfiguration(): Required<AppConfiguration> {
    return { ...this.config };
  }

  /**
   * Update application configuration
   */
  updateConfiguration(newConfig: Partial<AppConfiguration>): void {
    this.config = this.mergeWithDefaults({ ...this.config, ...newConfig });
    
    // Reinitialize components with new configuration
    this.initializeComponents();
    
    console.log('⚙️ Configuration updated');
  }

  /**
   * Run application in batch mode (non-interactive)
   */
  async runBatch(options: {
    inputFile?: string;
    outputDirectory?: string;
    exportFormats?: string[];
    configFile?: string;
  }): Promise<void> {
    console.log('🤖 Running in batch mode...');
    
    try {
      // This would implement batch processing
      // For now, we'll show the structure
      console.log('📁 Batch mode configuration:');
      console.log(`   Input file: ${options.inputFile || 'stdin'}`);
      console.log(`   Output directory: ${options.outputDirectory || './output'}`);
      console.log(`   Export formats: ${options.exportFormats?.join(', ') || 'all'}`);
      
      // Batch processing would be implemented here
      console.log('⚠️  Batch mode implementation pending');
      
    } catch (error) {
      console.error('❌ Batch mode failed:', error.message);
      throw error;
    }
  }

  /**
   * Initialize all application components
   */
  private initializeComponents(): void {
    // Initialize schedule generator with configuration
    this.scheduleGenerator = new ScheduleGenerator({
      workingDays: this.config.workingDays,
      workingHours: this.config.workingHours,
      slotDuration: this.config.slotDuration,
      breakDuration: this.config.breakDuration,
      maxAttemptsPerLecture: this.config.maxAttemptsPerLecture,
      allowPartialSchedules: this.config.allowPartialSchedules,
      prioritizeEvenDistribution: this.config.prioritizeEvenDistribution
    });

    // Initialize other services
    this.inputManager = new InputManager();
    this.validationService = new ValidationService();
    this.exportManager = new ExportManager();

    // Initialize console interface with configuration
    this.consoleInterface = new ConsoleInterface({
      enableColors: this.config.enableColors,
      showProgressBars: this.config.showProgressBars,
      verboseMode: this.config.verboseMode,
      autoSave: this.config.autoSave
    });
  }

  /**
   * Merge user configuration with defaults
   */
  private mergeWithDefaults(config: AppConfiguration): Required<AppConfiguration> {
    return {
      // Scheduling defaults
      workingDays: config.workingDays || [
        DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, 
        DayOfWeek.THURSDAY, DayOfWeek.FRIDAY
      ],
      workingHours: config.workingHours || { start: '08:00', end: '18:00' },
      slotDuration: config.slotDuration || 60,
      breakDuration: config.breakDuration || 15,
      maxAttemptsPerLecture: config.maxAttemptsPerLecture || 100,
      allowPartialSchedules: config.allowPartialSchedules ?? true,
      prioritizeEvenDistribution: config.prioritizeEvenDistribution ?? true,

      // UI defaults
      enableColors: config.enableColors ?? true,
      showProgressBars: config.showProgressBars ?? true,
      verboseMode: config.verboseMode ?? false,
      autoSave: config.autoSave ?? true,

      // Error handling defaults
      enableLogging: config.enableLogging ?? true,
      enableAutoRecovery: config.enableAutoRecovery ?? true,
      maxRetryAttempts: config.maxRetryAttempts ?? 3,

      // Performance defaults
      memoryLimitMB: config.memoryLimitMB || 512,
      timeoutMs: config.timeoutMs || 300000, // 5 minutes
      enablePerformanceMonitoring: config.enablePerformanceMonitoring ?? true
    };
  }

  /**
   * Initialize application metrics
   */
  private initializeMetrics(): AppMetrics {
    return {
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTime: new Date(),
      batchesProcessed: 0,
      lecturesGenerated: 0,
      conflictsResolved: 0,
      exportsCompleted: 0,
      errorsEncountered: 0,
      memoryPeakMB: 0,
      performanceScore: 0
    };
  }

  /**
   * Get configuration summary for display
   */
  private getConfigurationSummary(): string {
    const workingDaysStr = this.config.workingDays.map(day => day.substring(0, 3)).join(',');
    return `${workingDaysStr} ${this.config.workingHours.start}-${this.config.workingHours.end}, ${this.config.slotDuration}min slots`;
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    const monitoringInterval = setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      
      if (memoryMB > this.metrics.memoryPeakMB) {
        this.metrics.memoryPeakMB = memoryMB;
      }

      // Check memory limit
      if (memoryMB > this.config.memoryLimitMB) {
        console.warn(`⚠️ Memory usage (${memoryMB}MB) exceeds limit (${this.config.memoryLimitMB}MB)`);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      if (this.config.verboseMode) {
        console.log(`💾 Memory: ${memoryMB}MB (Peak: ${this.metrics.memoryPeakMB}MB)`);
      }
    }, 5000); // Check every 5 seconds

    // Store interval for cleanup
    (this as any).performanceMonitoringInterval = monitoringInterval;
  }

  /**
   * Handle successful application completion
   */
  private async handleSuccessfulCompletion(): Promise<void> {
    this.metrics.endTime = new Date();
    this.metrics.totalDuration = this.metrics.endTime.getTime() - this.metrics.startTime.getTime();
    this.metrics.performanceScore = this.calculatePerformanceScore();

    console.log('');
    console.log('🎉 TIMETABLE GENERATION COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log(`📊 Session Summary:`);
    console.log(`   Session ID: ${this.metrics.sessionId}`);
    console.log(`   Duration: ${Math.round(this.metrics.totalDuration / 1000)}s`);
    console.log(`   Batches Processed: ${this.metrics.batchesProcessed}`);
    console.log(`   Lectures Generated: ${this.metrics.lecturesGenerated}`);
    console.log(`   Conflicts Resolved: ${this.metrics.conflictsResolved}`);
    console.log(`   Exports Completed: ${this.metrics.exportsCompleted}`);
    console.log(`   Peak Memory: ${this.metrics.memoryPeakMB}MB`);
    console.log(`   Performance Score: ${this.metrics.performanceScore}/100`);
    
    if (this.metrics.errorsEncountered > 0) {
      console.log(`   ⚠️ Errors Handled: ${this.metrics.errorsEncountered}`);
    }
    
    console.log('');
    console.log('Thank you for using the Automated Timetable Generator! 🎓');
  }

  /**
   * Handle application errors
   */
  private async handleApplicationError(error: any): Promise<void> {
    this.metrics.errorsEncountered++;
    
    console.log('');
    console.log('❌ APPLICATION ERROR OCCURRED');
    console.log('='.repeat(60));
    console.log(`Error: ${error.message}`);
    
    if (this.config.verboseMode && error.stack) {
      console.log(`Stack trace: ${error.stack}`);
    }
    
    console.log('');
    console.log('The application encountered an error and will now exit.');
    console.log('Please check your input data and try again.');
    
    if (error.recoveryActions && error.recoveryActions.length > 0) {
      console.log('');
      console.log('💡 Suggested actions:');
      error.recoveryActions.forEach((action: any, index: number) => {
        console.log(`   ${index + 1}. ${action.description}`);
      });
    }
  }

  /**
   * Calculate performance score based on metrics
   */
  private calculatePerformanceScore(): number {
    let score = 100;
    
    // Penalize for errors
    score -= Math.min(this.metrics.errorsEncountered * 10, 50);
    
    // Penalize for excessive memory usage
    if (this.metrics.memoryPeakMB > this.config.memoryLimitMB * 0.8) {
      score -= 20;
    }
    
    // Penalize for long duration (if we have benchmarks)
    if (this.metrics.totalDuration && this.metrics.totalDuration > 60000) { // More than 1 minute
      score -= 10;
    }
    
    // Bonus for successful operations
    if (this.metrics.lecturesGenerated > 0) {
      score += 10;
    }
    
    if (this.metrics.exportsCompleted > 0) {
      score += 5;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Set up graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdownHandler = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdownHandler('SIGINT'));
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('💥 Uncaught Exception:', error.message);
      await this.handleApplicationError(error);
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      console.error('💥 Unhandled Promise Rejection:', reason);
      await this.handleApplicationError(new Error(String(reason)));
      process.exit(1);
    });
  }

  /**
   * Shutdown application and cleanup resources
   */
  private async shutdown(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('🧹 Cleaning up resources...');

    // Stop performance monitoring
    if ((this as any).performanceMonitoringInterval) {
      clearInterval((this as any).performanceMonitoringInterval);
    }

    // Cleanup components
    try {
      // Any cleanup needed for components would go here
      if (this.config.verboseMode) {
        console.log('✅ Components cleaned up');
      }
    } catch (error) {
      console.warn('⚠️ Warning during cleanup:', error.message);
    }

    this.isRunning = false;
    
    if (this.config.verboseMode) {
      console.log('✅ Application shutdown complete');
    }
  }

  /**
   * Display application information
   */
  displayInfo(): void {
    console.log('📋 AUTOMATED TIMETABLE GENERATOR');
    console.log('='.repeat(50));
    console.log('A comprehensive solution for educational institution scheduling');
    console.log('');
    console.log('Features:');
    console.log('  ✅ Automated conflict-free schedule generation');
    console.log('  ✅ Multiple export formats (CSV, JSON, HTML)');
    console.log('  ✅ Interactive schedule review and editing');
    console.log('  ✅ Holiday and constraint handling');
    console.log('  ✅ Performance optimization and scalability');
    console.log('  ✅ Comprehensive error handling and recovery');
    console.log('  ✅ Impossible scenario detection and partial scheduling');
    console.log('');
    console.log('Configuration:');
    console.log(`  Working Days: ${this.config.workingDays.map(d => d.substring(0, 3)).join(', ')}`);
    console.log(`  Working Hours: ${this.config.workingHours.start} - ${this.config.workingHours.end}`);
    console.log(`  Slot Duration: ${this.config.slotDuration} minutes`);
    console.log(`  Break Duration: ${this.config.breakDuration} minutes`);
    console.log(`  Partial Schedules: ${this.config.allowPartialSchedules ? 'Enabled' : 'Disabled'}`);
    console.log(`  Auto Recovery: ${this.config.enableAutoRecovery ? 'Enabled' : 'Disabled'}`);
    console.log('');
  }

  /**
   * Run application health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'error';
    checks: Array<{ name: string; status: boolean; message: string }>;
    metrics: AppMetrics;
  }> {
    const checks = [];
    let overallStatus: 'healthy' | 'warning' | 'error' = 'healthy';

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const memoryOk = memoryMB < this.config.memoryLimitMB * 0.8;
    
    checks.push({
      name: 'Memory Usage',
      status: memoryOk,
      message: `${memoryMB}MB used (limit: ${this.config.memoryLimitMB}MB)`
    });

    if (!memoryOk) overallStatus = 'warning';

    // Check error boundary status
    const errorBoundaryHealthy = this.globalErrorBoundary ? !this.globalErrorBoundary.hasError() : true;
    checks.push({
      name: 'Error Boundary',
      status: errorBoundaryHealthy,
      message: errorBoundaryHealthy ? 'No active errors' : 'Active error detected'
    });

    if (!errorBoundaryHealthy) overallStatus = 'error';

    // Check component initialization
    const componentsOk = !!(this.scheduleGenerator && this.inputManager && this.validationService && this.exportManager);
    checks.push({
      name: 'Components',
      status: componentsOk,
      message: componentsOk ? 'All components initialized' : 'Component initialization failed'
    });

    if (!componentsOk) overallStatus = 'error';

    // Check configuration validity
    const configOk = this.validateConfiguration();
    checks.push({
      name: 'Configuration',
      status: configOk,
      message: configOk ? 'Configuration valid' : 'Configuration issues detected'
    });

    if (!configOk) overallStatus = 'warning';

    return {
      status: overallStatus,
      checks,
      metrics: this.getMetrics()
    };
  }

  /**
   * Validate current configuration
   */
  private validateConfiguration(): boolean {
    try {
      // Check working hours
      const startTime = this.parseTime(this.config.workingHours.start);
      const endTime = this.parseTime(this.config.workingHours.end);
      
      if (startTime >= endTime) {
        return false;
      }

      // Check slot duration
      if (this.config.slotDuration <= 0 || this.config.slotDuration > 480) {
        return false;
      }

      // Check working days
      if (this.config.workingDays.length === 0) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Parse time string to minutes
   */
  private parseTime(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }
}

/**
 * Application factory for creating configured instances
 */
export class TimetableGeneratorAppFactory {
  /**
   * Create application for small institutions
   */
  static createForSmallInstitution(): TimetableGeneratorApp {
    return new TimetableGeneratorApp({
      workingDays: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY],
      workingHours: { start: '09:00', end: '17:00' },
      slotDuration: 60,
      breakDuration: 15,
      maxAttemptsPerLecture: 50,
      allowPartialSchedules: true,
      memoryLimitMB: 256,
      timeoutMs: 120000 // 2 minutes
    });
  }

  /**
   * Create application for large universities
   */
  static createForLargeUniversity(): TimetableGeneratorApp {
    return new TimetableGeneratorApp({
      workingDays: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY],
      workingHours: { start: '08:00', end: '20:00' },
      slotDuration: 60,
      breakDuration: 10,
      maxAttemptsPerLecture: 200,
      allowPartialSchedules: true,
      prioritizeEvenDistribution: true,
      memoryLimitMB: 1024,
      timeoutMs: 600000, // 10 minutes
      enablePerformanceMonitoring: true
    });
  }

  /**
   * Create application for testing
   */
  static createForTesting(): TimetableGeneratorApp {
    return new TimetableGeneratorApp({
      workingDays: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY],
      workingHours: { start: '09:00', end: '15:00' },
      slotDuration: 60,
      breakDuration: 0,
      maxAttemptsPerLecture: 20,
      allowPartialSchedules: true,
      enableColors: false,
      showProgressBars: false,
      verboseMode: true,
      memoryLimitMB: 128,
      timeoutMs: 30000 // 30 seconds
    });
  }

  /**
   * Create application with custom configuration
   */
  static createCustom(config: AppConfiguration): TimetableGeneratorApp {
    return new TimetableGeneratorApp(config);
  }
}
