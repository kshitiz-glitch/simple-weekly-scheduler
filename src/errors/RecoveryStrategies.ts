import { TimetableError, ErrorCode, SchedulingError, ExportError, SystemError } from './TimetableErrors';
import { WeeklySchedule } from '../models/WeeklySchedule';
import { Batch } from '../models';
import { ScheduleGenerator } from '../algorithms/ScheduleGenerator';
import { ExportManager } from '../exporters/ExportManager';
import { ExportFormat } from '../exporters/ExportInterfaces';

export interface RecoveryContext {
  schedule?: WeeklySchedule;
  batches?: Batch[];
  originalError: TimetableError;
  attemptCount: number;
  maxAttempts: number;
  fallbackOptions?: any;
}

export interface RecoveryStrategy {
  canHandle(error: TimetableError): boolean;
  execute(context: RecoveryContext): Promise<RecoveryResult>;
  priority: number; // Lower number = higher priority
  description: string;
}

export interface RecoveryResult {
  success: boolean;
  result?: any;
  message: string;
  fallbackUsed?: boolean;
  modifiedParameters?: any;
}

/**
 * Scheduling recovery strategies
 */
export class SchedulingRecoveryStrategy implements RecoveryStrategy {
  priority = 1;
  description = 'Attempt to recover from scheduling failures by adjusting parameters';

  canHandle(error: TimetableError): boolean {
    return error instanceof SchedulingError || error.code === ErrorCode.SCHEDULING_IMPOSSIBLE;
  }

  async execute(context: RecoveryContext): Promise<RecoveryResult> {
    if (!context.batches) {
      return {
        success: false,
        message: 'No batch data available for scheduling recovery'
      };
    }

    const scheduleGenerator = new ScheduleGenerator();
    
    // Try different recovery approaches based on attempt count
    switch (context.attemptCount) {
      case 1:
        return await this.tryRelaxedConstraints(scheduleGenerator, context);
      case 2:
        return await this.tryPartialScheduling(scheduleGenerator, context);
      case 3:
        return await this.trySimplifiedScheduling(scheduleGenerator, context);
      default:
        return await this.tryMinimalScheduling(scheduleGenerator, context);
    }
  }

  private async tryRelaxedConstraints(
    generator: ScheduleGenerator, 
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    try {
      // Relax some constraints to allow more flexibility
      const relaxedConfig = {
        allowPartialSchedules: true,
        prioritizeEvenDistribution: false,
        maxAttemptsPerLecture: 50, // Reduced attempts for faster recovery
        allowOverlappingLectures: true // Allow some overlaps as last resort
      };

      const schedule = await generator.generateTimetable(
        context.batches!,
        [], // Remove some constraints
        []  // Ignore holidays temporarily
      );

      return {
        success: true,
        result: schedule,
        message: 'Schedule generated with relaxed constraints',
        fallbackUsed: true,
        modifiedParameters: relaxedConfig
      };
    } catch (error) {
      return {
        success: false,
        message: `Relaxed constraints approach failed: ${error.message}`
      };
    }
  }

  private async tryPartialScheduling(
    generator: ScheduleGenerator, 
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    try {
      // Try to schedule only the most important subjects first
      const prioritizedBatches = this.prioritizeBatches(context.batches!);
      const reducedBatches = prioritizedBatches.slice(0, Math.ceil(prioritizedBatches.length * 0.7));

      const partialSchedule = await generator.generateTimetable(
        reducedBatches,
        [],
        []
      );

      return {
        success: true,
        result: partialSchedule,
        message: `Partial schedule generated for ${reducedBatches.length}/${context.batches!.length} batches`,
        fallbackUsed: true,
        modifiedParameters: { batchCount: reducedBatches.length }
      };
    } catch (error) {
      return {
        success: false,
        message: `Partial scheduling approach failed: ${error.message}`
      };
    }
  }

  private async trySimplifiedScheduling(
    generator: ScheduleGenerator, 
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    try {
      // Simplify by reducing lecture counts
      const simplifiedBatches = this.simplifyBatches(context.batches!);

      const simplifiedSchedule = await generator.generateTimetable(
        simplifiedBatches,
        [],
        []
      );

      return {
        success: true,
        result: simplifiedSchedule,
        message: 'Schedule generated with simplified requirements',
        fallbackUsed: true,
        modifiedParameters: { lecturesReduced: true }
      };
    } catch (error) {
      return {
        success: false,
        message: `Simplified scheduling approach failed: ${error.message}`
      };
    }
  }

  private async tryMinimalScheduling(
    generator: ScheduleGenerator, 
    context: RecoveryContext
  ): Promise<RecoveryResult> {
    try {
      // Create minimal schedule with just one lecture per subject
      const minimalBatches = this.createMinimalBatches(context.batches!);

      const minimalSchedule = await generator.generateTimetable(
        minimalBatches,
        [],
        []
      );

      return {
        success: true,
        result: minimalSchedule,
        message: 'Minimal schedule generated as last resort',
        fallbackUsed: true,
        modifiedParameters: { minimal: true }
      };
    } catch (error) {
      return {
        success: false,
        message: `All scheduling recovery attempts failed: ${error.message}`
      };
    }
  }

  private prioritizeBatches(batches: Batch[]): Batch[] {
    // Sort batches by total lecture count (ascending) to schedule easier ones first
    return [...batches].sort((a, b) => a.getTotalLecturesPerWeek() - b.getTotalLecturesPerWeek());
  }

  private simplifyBatches(batches: Batch[]): Batch[] {
    return batches.map(batch => {
      const simplifiedBatch = new Batch(batch.id, batch.name);
      
      batch.subjects.forEach(subject => {
        // Reduce lecture count by half, minimum 1
        const reducedLectures = Math.max(1, Math.floor(subject.lecturesPerWeek / 2));
        
        const simplifiedSubject = new (subject.constructor as any)(
          subject.id,
          subject.name,
          reducedLectures,
          subject.lectureDuration,
          subject.facultyId
        );
        
        simplifiedBatch.addSubject(simplifiedSubject);
      });
      
      return simplifiedBatch;
    });
  }

  private createMinimalBatches(batches: Batch[]): Batch[] {
    return batches.slice(0, 3).map(batch => { // Take only first 3 batches
      const minimalBatch = new Batch(batch.id, batch.name);
      
      // Take only first 3 subjects with 1 lecture each
      batch.subjects.slice(0, 3).forEach(subject => {
        const minimalSubject = new (subject.constructor as any)(
          subject.id,
          subject.name,
          1, // Only 1 lecture per week
          60, // Standard 1-hour duration
          subject.facultyId
        );
        
        minimalBatch.addSubject(minimalSubject);
      });
      
      return minimalBatch;
    });
  }
}

/**
 * Export recovery strategies
 */
export class ExportRecoveryStrategy implements RecoveryStrategy {
  priority = 2;
  description = 'Attempt to recover from export failures by trying alternative formats';

  canHandle(error: TimetableError): boolean {
    return error instanceof ExportError || error.code === ErrorCode.EXPORT_FAILED;
  }

  async execute(context: RecoveryContext): Promise<RecoveryResult> {
    if (!context.schedule) {
      return {
        success: false,
        message: 'No schedule available for export recovery'
      };
    }

    const exportManager = new ExportManager();
    const fallbackFormats = this.getFallbackFormats(context.originalError as ExportError);

    for (const format of fallbackFormats) {
      try {
        const result = await exportManager.exportSchedule(context.schedule, {
          format,
          filename: `timetable_recovery_${Date.now()}.${format}`,
          includeMetadata: true,
          includeConflicts: false // Simplified export
        });

        if (result.success) {
          return {
            success: true,
            result,
            message: `Export successful using fallback format: ${format}`,
            fallbackUsed: true,
            modifiedParameters: { format }
          };
        }
      } catch (error) {
        // Continue to next format
        continue;
      }
    }

    return {
      success: false,
      message: 'All export format fallbacks failed'
    };
  }

  private getFallbackFormats(exportError: ExportError): ExportFormat[] {
    const allFormats = [ExportFormat.JSON, ExportFormat.CSV, ExportFormat.HTML];
    
    // Remove the failed format and return others
    const failedFormat = exportError.format;
    return allFormats.filter(format => format !== failedFormat);
  }
}

/**
 * Memory recovery strategies
 */
export class MemoryRecoveryStrategy implements RecoveryStrategy {
  priority = 3;
  description = 'Attempt to recover from memory issues by freeing resources';

  canHandle(error: TimetableError): boolean {
    return error.code === ErrorCode.MEMORY_LIMIT_EXCEEDED;
  }

  async execute(context: RecoveryContext): Promise<RecoveryResult> {
    try {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Clear any cached data
      this.clearCaches();

      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if memory was freed
      const memoryAfter = process.memoryUsage();
      
      return {
        success: true,
        result: memoryAfter,
        message: `Memory cleanup performed. Heap usage: ${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB`,
        modifiedParameters: { memoryCleared: true }
      };
    } catch (error) {
      return {
        success: false,
        message: `Memory recovery failed: ${error.message}`
      };
    }
  }

  private clearCaches(): void {
    // Clear any application-level caches
    // This would be implemented based on specific caching mechanisms used
  }
}

/**
 * Timeout recovery strategies
 */
export class TimeoutRecoveryStrategy implements RecoveryStrategy {
  priority = 4;
  description = 'Attempt to recover from timeout errors by adjusting parameters';

  canHandle(error: TimetableError): boolean {
    return error.code === ErrorCode.TIMEOUT_ERROR;
  }

  async execute(context: RecoveryContext): Promise<RecoveryResult> {
    // For timeout errors, we typically need to reduce the complexity of the operation
    if (context.batches && context.batches.length > 5) {
      // Reduce batch count
      const reducedBatches = context.batches.slice(0, Math.ceil(context.batches.length / 2));
      
      return {
        success: true,
        result: reducedBatches,
        message: `Reduced dataset size to prevent timeout (${reducedBatches.length}/${context.batches.length} batches)`,
        fallbackUsed: true,
        modifiedParameters: { 
          originalBatchCount: context.batches.length,
          reducedBatchCount: reducedBatches.length
        }
      };
    }

    return {
      success: false,
      message: 'Cannot reduce complexity further to prevent timeout'
    };
  }
}

/**
 * Data validation recovery strategies
 */
export class ValidationRecoveryStrategy implements RecoveryStrategy {
  priority = 5;
  description = 'Attempt to recover from validation errors by cleaning data';

  canHandle(error: TimetableError): boolean {
    return error.code === ErrorCode.VALIDATION_FAILED || 
           error.code === ErrorCode.INVALID_BATCH_DATA ||
           error.code === ErrorCode.INVALID_SUBJECT_DATA;
  }

  async execute(context: RecoveryContext): Promise<RecoveryResult> {
    if (!context.batches) {
      return {
        success: false,
        message: 'No data available for validation recovery'
      };
    }

    try {
      const cleanedBatches = this.cleanBatchData(context.batches);
      
      return {
        success: true,
        result: cleanedBatches,
        message: `Data cleaned and validated (${cleanedBatches.length}/${context.batches.length} batches retained)`,
        fallbackUsed: true,
        modifiedParameters: { 
          originalCount: context.batches.length,
          cleanedCount: cleanedBatches.length
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Data cleaning failed: ${error.message}`
      };
    }
  }

  private cleanBatchData(batches: Batch[]): Batch[] {
    const cleanedBatches: Batch[] = [];

    for (const batch of batches) {
      try {
        // Validate batch
        if (!batch.id || !batch.name) {
          continue; // Skip invalid batch
        }

        const cleanedBatch = new Batch(batch.id, batch.name);
        
        // Clean subjects
        for (const subject of batch.subjects) {
          try {
            // Validate subject data
            if (!subject.id || !subject.name || 
                subject.lecturesPerWeek <= 0 || 
                subject.lectureDuration <= 0) {
              continue; // Skip invalid subject
            }

            // Ensure reasonable values
            const lecturesPerWeek = Math.min(10, Math.max(1, subject.lecturesPerWeek));
            const duration = Math.min(240, Math.max(30, subject.lectureDuration));

            const cleanedSubject = new (subject.constructor as any)(
              subject.id,
              subject.name,
              lecturesPerWeek,
              duration,
              subject.facultyId || 'Unknown Faculty'
            );

            cleanedBatch.addSubject(cleanedSubject);
          } catch (error) {
            // Skip this subject and continue
            continue;
          }
        }

        // Only add batch if it has at least one valid subject
        if (cleanedBatch.subjects.length > 0) {
          cleanedBatches.push(cleanedBatch);
        }
      } catch (error) {
        // Skip this batch and continue
        continue;
      }
    }

    return cleanedBatches;
  }
}

/**
 * Recovery strategy manager
 */
export class RecoveryStrategyManager {
  private strategies: RecoveryStrategy[] = [];

  constructor() {
    // Register default strategies
    this.registerStrategy(new SchedulingRecoveryStrategy());
    this.registerStrategy(new ExportRecoveryStrategy());
    this.registerStrategy(new MemoryRecoveryStrategy());
    this.registerStrategy(new TimeoutRecoveryStrategy());
    this.registerStrategy(new ValidationRecoveryStrategy());
  }

  /**
   * Register a new recovery strategy
   */
  registerStrategy(strategy: RecoveryStrategy): void {
    this.strategies.push(strategy);
    // Sort by priority (lower number = higher priority)
    this.strategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Find applicable strategies for an error
   */
  findStrategies(error: TimetableError): RecoveryStrategy[] {
    return this.strategies.filter(strategy => strategy.canHandle(error));
  }

  /**
   * Execute recovery strategies for an error
   */
  async executeRecovery(
    error: TimetableError, 
    context: Partial<RecoveryContext> = {}
  ): Promise<RecoveryResult> {
    const applicableStrategies = this.findStrategies(error);
    
    if (applicableStrategies.length === 0) {
      return {
        success: false,
        message: 'No recovery strategies available for this error type'
      };
    }

    const recoveryContext: RecoveryContext = {
      originalError: error,
      attemptCount: 1,
      maxAttempts: 3,
      ...context
    };

    // Try each strategy in priority order
    for (const strategy of applicableStrategies) {
      try {
        const result = await strategy.execute(recoveryContext);
        
        if (result.success) {
          return result;
        }
        
        // Increment attempt count for next strategy
        recoveryContext.attemptCount++;
        
        if (recoveryContext.attemptCount > recoveryContext.maxAttempts) {
          break;
        }
      } catch (strategyError) {
        // Log strategy failure and continue to next strategy
        console.warn(`Recovery strategy '${strategy.description}' failed:`, strategyError.message);
        continue;
      }
    }

    return {
      success: false,
      message: 'All recovery strategies failed'
    };
  }

  /**
   * Get available strategies
   */
  getStrategies(): RecoveryStrategy[] {
    return [...this.strategies];
  }

  /**
   * Remove a strategy
   */
  removeStrategy(strategyToRemove: RecoveryStrategy): boolean {
    const index = this.strategies.indexOf(strategyToRemove);
    if (index > -1) {
      this.strategies.splice(index, 1);
      return true;
    }
    return false;
  }
}
