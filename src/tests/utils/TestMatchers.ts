import { WeeklySchedule } from '../../models/WeeklySchedule';
import { ScheduleEntry, ConstraintViolation, DayOfWeek } from '../../models';
import { ExportResult } from '../../exporters/ExportInterfaces';

/**
 * Custom Jest matchers for timetable testing
 */
export const customMatchers = {
  /**
   * Check if a schedule has valid structure
   */
  toBeValidSchedule(received: WeeklySchedule) {
    const validation = received.validate();
    
    return {
      message: () => 
        validation.isValid 
          ? `Expected schedule to be invalid, but it was valid`
          : `Expected schedule to be valid, but found issues: ${validation.issues.join(', ')}`,
      pass: validation.isValid
    };
  },

  /**
   * Check if a schedule has no critical conflicts
   */
  toHaveNoCriticalConflicts(received: WeeklySchedule) {
    const criticalConflicts = received.getConflictsBySeverity('error');
    
    return {
      message: () => 
        criticalConflicts.length === 0
          ? `Expected schedule to have critical conflicts, but found none`
          : `Expected no critical conflicts, but found ${criticalConflicts.length}: ${criticalConflicts.map(c => c.message).join(', ')}`,
      pass: criticalConflicts.length === 0
    };
  },

  /**
   * Check if a schedule has good distribution
   */
  toHaveGoodDistribution(received: WeeklySchedule, threshold: number = 0.3) {
    const stats = received.calculateStatistics();
    const cv = stats.dailyLoadDistribution.standardDeviation / stats.dailyLoadDistribution.averageEntriesPerDay;
    const hasGoodDistribution = cv < threshold;
    
    return {
      message: () => 
        hasGoodDistribution
          ? `Expected poor distribution (CV >= ${threshold}), but got CV = ${cv.toFixed(3)}`
          : `Expected good distribution (CV < ${threshold}), but got CV = ${cv.toFixed(3)}`,
      pass: hasGoodDistribution
    };
  },

  /**
   * Check if a schedule has reasonable utilization
   */
  toHaveReasonableUtilization(received: WeeklySchedule, minRate: number = 20, maxRate: number = 80) {
    const stats = received.calculateStatistics();
    const utilizationRate = stats.timeSlotUtilization.utilizationRate;
    const isReasonable = utilizationRate >= minRate && utilizationRate <= maxRate;
    
    return {
      message: () => 
        isReasonable
          ? `Expected utilization outside ${minRate}-${maxRate}%, but got ${utilizationRate}%`
          : `Expected utilization between ${minRate}-${maxRate}%, but got ${utilizationRate}%`,
      pass: isReasonable
    };
  },

  /**
   * Check if schedule entries respect time constraints
   */
  toRespectTimeConstraints(received: ScheduleEntry[], startHour: number = 8, endHour: number = 18) {
    const violations: string[] = [];
    
    received.forEach((entry, index) => {
      const startTime = this.timeToMinutes(entry.timeSlot.startTime);
      const endTime = this.timeToMinutes(entry.timeSlot.endTime);
      const startLimit = startHour * 60;
      const endLimit = endHour * 60;
      
      if (startTime < startLimit) {
        violations.push(`Entry ${index}: starts at ${entry.timeSlot.startTime} (before ${startHour}:00)`);
      }
      
      if (endTime > endLimit) {
        violations.push(`Entry ${index}: ends at ${entry.timeSlot.endTime} (after ${endHour}:00)`);
      }
      
      if (startTime >= endTime) {
        violations.push(`Entry ${index}: invalid time range ${entry.timeSlot.startTime}-${entry.timeSlot.endTime}`);
      }
    });
    
    return {
      message: () => 
        violations.length === 0
          ? `Expected time constraint violations, but found none`
          : `Expected no time constraint violations, but found: ${violations.join('; ')}`,
      pass: violations.length === 0
    };
  },

  /**
   * Check if export result is successful
   */
  toBeSuccessfulExport(received: ExportResult) {
    const issues: string[] = [];
    
    if (!received.success) {
      issues.push(`Export failed: ${received.error || 'Unknown error'}`);
    }
    
    if (!received.data || (typeof received.data === 'string' && received.data.length === 0)) {
      issues.push('Export data is empty');
    }
    
    if (received.size <= 0) {
      issues.push('Export size is zero or negative');
    }
    
    if (!received.filename) {
      issues.push('Export filename is missing');
    }
    
    return {
      message: () => 
        issues.length === 0
          ? `Expected export to fail, but it was successful`
          : `Expected successful export, but found issues: ${issues.join('; ')}`,
      pass: issues.length === 0
    };
  },

  // Helper methods
  timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  },

  timeSlotOverlap(slot1: any, slot2: any): boolean {
    if (slot1.day !== slot2.day) {
      return false;
    }

    const start1 = this.timeToMinutes(slot1.startTime);
    const end1 = this.timeToMinutes(slot1.endTime);
    const start2 = this.timeToMinutes(slot2.startTime);
    const end2 = this.timeToMinutes(slot2.endTime);

    return start1 < end2 && start2 < end1;
  },

  getDateDayOfWeek(date: Date): DayOfWeek {
    const dayIndex = date.getDay();
    switch (dayIndex) {
      case 0: return DayOfWeek.SUNDAY;
      case 1: return DayOfWeek.MONDAY;
      case 2: return DayOfWeek.TUESDAY;
      case 3: return DayOfWeek.WEDNESDAY;
      case 4: return DayOfWeek.THURSDAY;
      case 5: return DayOfWeek.FRIDAY;
      case 6: return DayOfWeek.SATURDAY;
      default: return DayOfWeek.MONDAY;
    }
  }
};

/**
 * Test assertion helpers
 */
export class TestAssertions {
  /**
   * Assert that a schedule meets quality standards
   */
  static assertScheduleQuality(schedule: WeeklySchedule, options: {
    minUtilization?: number;
    maxUtilization?: number;
    maxCriticalConflicts?: number;
    maxDistributionCV?: number;
  } = {}) {
    const {
      minUtilization = 20,
      maxUtilization = 80,
      maxCriticalConflicts = 0,
      maxDistributionCV = 0.5
    } = options;

    // Check basic validity
    const validation = schedule.validate();
    expect(validation.isValid).toBe(true);

    // Check utilization
    const stats = schedule.calculateStatistics();
    expect(stats.timeSlotUtilization.utilizationRate).toBeGreaterThanOrEqual(minUtilization);
    expect(stats.timeSlotUtilization.utilizationRate).toBeLessThanOrEqual(maxUtilization);

    // Check conflicts
    const criticalConflicts = schedule.getConflictsBySeverity('error');
    expect(criticalConflicts.length).toBeLessThanOrEqual(maxCriticalConflicts);

    // Check distribution
    const cv = stats.dailyLoadDistribution.standardDeviation / stats.dailyLoadDistribution.averageEntriesPerDay;
    expect(cv).toBeLessThan(maxDistributionCV);
  }

  /**
   * Assert that export results are valid
   */
  static assertExportQuality(exportResult: ExportResult, options: {
    minSize?: number;
    maxProcessingTime?: number;
    requiredMimeType?: string;
  } = {}) {
    const {
      minSize = 1,
      maxProcessingTime = 5000,
      requiredMimeType
    } = options;

    expect(exportResult.success).toBe(true);
    expect(exportResult.size).toBeGreaterThanOrEqual(minSize);
    expect(exportResult.metadata.processingTimeMs).toBeLessThan(maxProcessingTime);
    
    if (requiredMimeType) {
      expect(exportResult.mimeType).toBe(requiredMimeType);
    }
    
    expect(exportResult.data).toBeDefined();
    expect(exportResult.filename).toBeDefined();
  }
}

/**
 * Performance measurement utilities
 */
export class PerformanceTestUtils {
  /**
   * Measure execution time of an async function
   */
  static async measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; timeMs: number }> {
    const startTime = Date.now();
    const result = await fn();
    const timeMs = Date.now() - startTime;
    
    return { result, timeMs };
  }

  /**
   * Measure memory usage (Node.js only)
   */
  static measureMemoryUsage(): { heapUsed: number; heapTotal: number } {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal
      };
    }
    
    return { heapUsed: 0, heapTotal: 0 };
  }

  /**
   * Run performance benchmark
   */
  static async runBenchmark<T>(
    name: string,
    fn: () => Promise<T>,
    iterations: number = 10
  ): Promise<{
    name: string;
    averageTimeMs: number;
    minTimeMs: number;
    maxTimeMs: number;
    totalTimeMs: number;
    iterations: number;
  }> {
    const times: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const { timeMs } = await this.measureExecutionTime(fn);
      times.push(timeMs);
    }
    
    const totalTimeMs = times.reduce((sum, time) => sum + time, 0);
    const averageTimeMs = totalTimeMs / iterations;
    const minTimeMs = Math.min(...times);
    const maxTimeMs = Math.max(...times);
    
    return {
      name,
      averageTimeMs,
      minTimeMs,
      maxTimeMs,
      totalTimeMs,
      iterations
    };
  }
}
