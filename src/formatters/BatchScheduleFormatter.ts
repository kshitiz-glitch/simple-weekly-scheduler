import { BaseScheduleFormatter, FormatterOptions } from './ScheduleFormatter';
import { WeeklySchedule } from '../models/WeeklySchedule';
import { DayOfWeek, ScheduleEntry } from '../models';

export class BatchScheduleFormatter extends BaseScheduleFormatter {
  constructor(options: FormatterOptions = {}) {
    super(options);
  }

  format(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    const batchIds = schedule.getBatchIds().sort();

    lines.push('BATCH-WISE SCHEDULE VIEW');
    lines.push('='.repeat(40));
    lines.push('');

    if (batchIds.length === 0) {
      lines.push('No batches found in the schedule.');
      return lines.join('\n');
    }

    batchIds.forEach((batchId, index) => {
      if (index > 0) {
        lines.push('');
        lines.push('-'.repeat(40));
        lines.push('');
      }
      
      lines.push(this.formatBatchSchedule(schedule, batchId));
    });

    if (this.options.includeStatistics) {
      lines.push('');
      lines.push(this.formatBatchStatistics(schedule));
    }

    return lines.join('\n');
  }

  formatBatchSchedule(schedule: WeeklySchedule, batchId: string): string {
    const lines: string[] = [];
    const batchEntries = schedule.getEntriesForBatch(batchId);
    
    lines.push(`📚 BATCH: ${batchId}`);
    lines.push(`Total Lectures: ${batchEntries.length}`);
    
    if (batchEntries.length === 0) {
      lines.push('No lectures scheduled for this batch.');
      return lines.join('\n');
    }

    // Check for conflicts in this batch
    const batchConflicts = schedule.getConflictsForBatch(batchId);
    if (batchConflicts.length > 0) {
      lines.push(`⚠️ Conflicts: ${batchConflicts.length}`);
    }

    lines.push('');

    const workingDays = [
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY
    ];

    // Create daily schedule
    workingDays.forEach(day => {
      const dayEntries = batchEntries.filter(entry => entry.timeSlot.day === day);
      
      if (dayEntries.length > 0 || this.options.showEmptySlots) {
        lines.push(`${this.getDayDisplayName(day)} (${dayEntries.length} lectures):`);
        
        if (dayEntries.length === 0) {
          lines.push('  No lectures');
        } else {
          const sortedEntries = this.sortEntriesByTime(dayEntries);
          sortedEntries.forEach(entry => {
            const conflictMarker = this.isConflictingEntry(entry, schedule) ? '⚠️ ' : '';
            const timeRange = `${this.formatTime(entry.timeSlot.startTime)} - ${this.formatTime(entry.timeSlot.endTime)}`;
            lines.push(`  ${conflictMarker}${timeRange}: ${entry.subjectId} (${entry.facultyId})`);
          });
        }
        lines.push('');
      }
    });

    // Add batch-specific statistics
    if (this.options.includeStatistics) {
      lines.push(this.formatBatchSpecificStats(schedule, batchId));
    }

    return lines.join('\n');
  }

  formatBatchComparison(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    const batchIds = schedule.getBatchIds().sort();
    
    lines.push('BATCH COMPARISON');
    lines.push('='.repeat(30));
    lines.push('');

    if (batchIds.length === 0) {
      lines.push('No batches to compare.');
      return lines.join('\n');
    }

    // Create comparison table
    const headers = ['Batch', 'Total Lectures', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Conflicts'];
    const columnWidths = [15, 15, 5, 5, 5, 5, 5, 10];
    
    lines.push(this.formatComparisonRow(headers, columnWidths));
    lines.push(this.formatComparisonSeparator(columnWidths));

    batchIds.forEach(batchId => {
      const batchEntries = schedule.getEntriesForBatch(batchId);
      const batchConflicts = schedule.getConflictsForBatch(batchId);
      
      const dailyCounts = [
        DayOfWeek.MONDAY,
        DayOfWeek.TUESDAY,
        DayOfWeek.WEDNESDAY,
        DayOfWeek.THURSDAY,
        DayOfWeek.FRIDAY
      ].map(day => 
        batchEntries.filter(entry => entry.timeSlot.day === day).length.toString()
      );

      const row = [
        batchId,
        batchEntries.length.toString(),
        ...dailyCounts,
        batchConflicts.length.toString()
      ];

      lines.push(this.formatComparisonRow(row, columnWidths));
    });

    return lines.join('\n');
  }

  formatBatchWorkload(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    const batchIds = schedule.getBatchIds().sort();
    
    lines.push('BATCH WORKLOAD ANALYSIS');
    lines.push('='.repeat(30));
    lines.push('');

    batchIds.forEach(batchId => {
      const batchEntries = schedule.getEntriesForBatch(batchId);
      const workload = this.calculateBatchWorkload(batchEntries);
      
      lines.push(`${batchId}:`);
      lines.push(`  Total Hours: ${workload.totalHours}`);
      lines.push(`  Average per Day: ${workload.averagePerDay.toFixed(1)}`);
      lines.push(`  Busiest Day: ${workload.busiestDay} (${workload.maxDayHours} hours)`);
      lines.push(`  Lightest Day: ${workload.lightestDay} (${workload.minDayHours} hours)`);
      lines.push(`  Free Days: ${workload.freeDays}`);
      lines.push('');
    });

    return lines.join('\n');
  }

  private formatBatchSpecificStats(schedule: WeeklySchedule, batchId: string): string {
    const lines: string[] = [];
    const batchEntries = schedule.getEntriesForBatch(batchId);
    
    lines.push('Batch Statistics:');
    
    // Subject distribution
    const subjectCounts = new Map<string, number>();
    batchEntries.forEach(entry => {
      const count = subjectCounts.get(entry.subjectId) || 0;
      subjectCounts.set(entry.subjectId, count + 1);
    });

    lines.push('  Subjects:');
    Array.from(subjectCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .forEach(([subject, count]) => {
        lines.push(`    ${subject}: ${count} lectures`);
      });

    // Faculty distribution
    const facultyCounts = new Map<string, number>();
    batchEntries.forEach(entry => {
      const count = facultyCounts.get(entry.facultyId) || 0;
      facultyCounts.set(entry.facultyId, count + 1);
    });

    lines.push('  Faculty:');
    Array.from(facultyCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .forEach(([faculty, count]) => {
        lines.push(`    ${faculty}: ${count} lectures`);
      });

    return lines.join('\n');
  }

  private formatBatchStatistics(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    const batchIds = schedule.getBatchIds();
    
    lines.push('OVERALL BATCH STATISTICS');
    lines.push('-'.repeat(30));
    
    lines.push(`Total Batches: ${batchIds.length}`);
    
    // Calculate batch workload statistics
    const batchWorkloads = batchIds.map(batchId => {
      const entries = schedule.getEntriesForBatch(batchId);
      return entries.length;
    });

    if (batchWorkloads.length > 0) {
      const totalLectures = batchWorkloads.reduce((sum, count) => sum + count, 0);
      const averageLectures = totalLectures / batchWorkloads.length;
      const maxLectures = Math.max(...batchWorkloads);
      const minLectures = Math.min(...batchWorkloads);
      
      lines.push(`Average Lectures per Batch: ${averageLectures.toFixed(1)}`);
      lines.push(`Maximum Lectures: ${maxLectures}`);
      lines.push(`Minimum Lectures: ${minLectures}`);
      
      // Find most and least loaded batches
      const maxIndex = batchWorkloads.indexOf(maxLectures);
      const minIndex = batchWorkloads.indexOf(minLectures);
      
      lines.push(`Most Loaded Batch: ${batchIds[maxIndex]} (${maxLectures} lectures)`);
      lines.push(`Least Loaded Batch: ${batchIds[minIndex]} (${minLectures} lectures)`);
    }

    return lines.join('\n');
  }

  private calculateBatchWorkload(entries: ScheduleEntry[]): {
    totalHours: number;
    averagePerDay: number;
    busiestDay: string;
    lightestDay: string;
    maxDayHours: number;
    minDayHours: number;
    freeDays: number;
  } {
    const dailyHours = new Map<DayOfWeek, number>();
    const workingDays = [
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY
    ];

    // Initialize daily hours
    workingDays.forEach(day => dailyHours.set(day, 0));

    // Calculate hours per day
    entries.forEach(entry => {
      const duration = this.calculateEntryDuration(entry);
      const currentHours = dailyHours.get(entry.timeSlot.day) || 0;
      dailyHours.set(entry.timeSlot.day, currentHours + duration);
    });

    const hourValues = Array.from(dailyHours.values());
    const totalHours = hourValues.reduce((sum, hours) => sum + hours, 0);
    const averagePerDay = totalHours / workingDays.length;
    const maxDayHours = Math.max(...hourValues);
    const minDayHours = Math.min(...hourValues);
    const freeDays = hourValues.filter(hours => hours === 0).length;

    // Find busiest and lightest days
    let busiestDay = '';
    let lightestDay = '';
    
    dailyHours.forEach((hours, day) => {
      if (hours === maxDayHours) busiestDay = day;
      if (hours === minDayHours) lightestDay = day;
    });

    return {
      totalHours,
      averagePerDay,
      busiestDay,
      lightestDay,
      maxDayHours,
      minDayHours,
      freeDays
    };
  }

  private calculateEntryDuration(entry: ScheduleEntry): number {
    const startMinutes = this.timeToMinutes(entry.timeSlot.startTime);
    const endMinutes = this.timeToMinutes(entry.timeSlot.endTime);
    return (endMinutes - startMinutes) / 60; // Convert to hours
  }

  private formatComparisonRow(cells: string[], widths: number[]): string {
    const paddedCells = cells.map((cell, index) => 
      cell.padEnd(widths[index])
    );
    return '| ' + paddedCells.join(' | ') + ' |';
  }

  private formatComparisonSeparator(widths: number[]): string {
    const separators = widths.map(width => '-'.repeat(width));
    return '|-' + separators.join('-|-') + '-|';
  }
}
