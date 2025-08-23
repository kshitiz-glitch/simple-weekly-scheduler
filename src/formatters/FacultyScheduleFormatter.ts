import { BaseScheduleFormatter, FormatterOptions } from './ScheduleFormatter';
import { WeeklySchedule } from '../models/WeeklySchedule';
import { DayOfWeek, ScheduleEntry } from '../models';

export class FacultyScheduleFormatter extends BaseScheduleFormatter {
  constructor(options: FormatterOptions = {}) {
    super(options);
  }

  format(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    const facultyIds = schedule.getFacultyIds().sort();

    lines.push('FACULTY-WISE SCHEDULE VIEW');
    lines.push('='.repeat(40));
    lines.push('');

    if (facultyIds.length === 0) {
      lines.push('No faculty members found in the schedule.');
      return lines.join('\n');
    }

    facultyIds.forEach((facultyId, index) => {
      if (index > 0) {
        lines.push('');
        lines.push('-'.repeat(40));
        lines.push('');
      }
      
      lines.push(this.formatFacultySchedule(schedule, facultyId));
    });

    if (this.options.includeStatistics) {
      lines.push('');
      lines.push(this.formatFacultyStatistics(schedule));
    }

    return lines.join('\n');
  }

  formatFacultySchedule(schedule: WeeklySchedule, facultyId: string): string {
    const lines: string[] = [];
    const facultyEntries = schedule.getEntriesForFaculty(facultyId);
    
    lines.push(`👨‍🏫 FACULTY: ${facultyId}`);
    lines.push(`Total Lectures: ${facultyEntries.length}`);
    
    if (facultyEntries.length === 0) {
      lines.push('No lectures assigned to this faculty member.');
      return lines.join('\n');
    }

    // Calculate workload
    const workload = this.calculateFacultyWorkload(facultyEntries);
    lines.push(`Total Hours: ${workload.totalHours}`);
    lines.push(`Average per Day: ${workload.averagePerDay.toFixed(1)} hours`);

    // Check for conflicts
    const facultyConflicts = schedule.getConflictsForFaculty(facultyId);
    if (facultyConflicts.length > 0) {
      lines.push(`⚠️ Conflicts: ${facultyConflicts.length}`);
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
      const dayEntries = facultyEntries.filter(entry => entry.timeSlot.day === day);
      
      if (dayEntries.length > 0 || this.options.showEmptySlots) {
        const dayHours = this.calculateDayHours(dayEntries);
        lines.push(`${this.getDayDisplayName(day)} (${dayEntries.length} lectures, ${dayHours.toFixed(1)}h):`);
        
        if (dayEntries.length === 0) {
          lines.push('  Free day');
        } else {
          const sortedEntries = this.sortEntriesByTime(dayEntries);
          sortedEntries.forEach(entry => {
            const conflictMarker = this.isConflictingEntry(entry, schedule) ? '⚠️ ' : '';
            const timeRange = `${this.formatTime(entry.timeSlot.startTime)} - ${this.formatTime(entry.timeSlot.endTime)}`;
            lines.push(`  ${conflictMarker}${timeRange}: ${entry.subjectId} (Batch: ${entry.batchId})`);
          });
          
          // Show gaps if any
          if (sortedEntries.length > 1) {
            const gaps = this.findGapsInDay(sortedEntries);
            gaps.forEach(gap => {
              if (gap.duration >= 60) { // Show gaps of 1 hour or more
                lines.push(`    💤 Gap: ${gap.duration} minutes (${this.formatTime(gap.start)} - ${this.formatTime(gap.end)})`);
              }
            });
          }
        }
        lines.push('');
      }
    });

    // Add faculty-specific insights
    if (this.options.includeStatistics) {
      lines.push(this.formatFacultyInsights(schedule, facultyId));
    }

    return lines.join('\n');
  }

  formatFacultyWorkloadComparison(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    const facultyIds = schedule.getFacultyIds().sort();
    
    lines.push('FACULTY WORKLOAD COMPARISON');
    lines.push('='.repeat(35));
    lines.push('');

    if (facultyIds.length === 0) {
      lines.push('No faculty members to compare.');
      return lines.join('\n');
    }

    // Create comparison table
    const headers = ['Faculty', 'Lectures', 'Hours', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Conflicts'];
    const columnWidths = [12, 9, 7, 5, 5, 5, 5, 5, 9];
    
    lines.push(this.formatComparisonRow(headers, columnWidths));
    lines.push(this.formatComparisonSeparator(columnWidths));

    facultyIds.forEach(facultyId => {
      const facultyEntries = schedule.getEntriesForFaculty(facultyId);
      const facultyConflicts = schedule.getConflictsForFaculty(facultyId);
      const workload = this.calculateFacultyWorkload(facultyEntries);
      
      const dailyCounts = [
        DayOfWeek.MONDAY,
        DayOfWeek.TUESDAY,
        DayOfWeek.WEDNESDAY,
        DayOfWeek.THURSDAY,
        DayOfWeek.FRIDAY
      ].map(day => 
        facultyEntries.filter(entry => entry.timeSlot.day === day).length.toString()
      );

      const row = [
        facultyId,
        facultyEntries.length.toString(),
        workload.totalHours.toString(),
        ...dailyCounts,
        facultyConflicts.length.toString()
      ];

      lines.push(this.formatComparisonRow(row, columnWidths));
    });

    // Add summary statistics
    lines.push('');
    lines.push(this.formatWorkloadSummary(schedule));

    return lines.join('\n');
  }

  formatFacultyAvailability(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    const facultyIds = schedule.getFacultyIds().sort();
    
    lines.push('FACULTY AVAILABILITY MATRIX');
    lines.push('='.repeat(35));
    lines.push('');

    // Create time slots (assuming 8 AM to 6 PM)
    const timeSlots = [];
    for (let hour = 8; hour < 18; hour++) {
      timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
    }

    const workingDays = [
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY
    ];

    facultyIds.forEach(facultyId => {
      lines.push(`Faculty: ${facultyId}`);
      lines.push('-'.repeat(20));
      
      // Create availability matrix
      const header = ['Time', ...workingDays.map(day => day.substring(0, 3))];
      const columnWidths = [8, 5, 5, 5, 5, 5];
      
      lines.push(this.formatComparisonRow(header, columnWidths));
      lines.push(this.formatComparisonSeparator(columnWidths));

      timeSlots.forEach(timeSlot => {
        const row = [this.formatTime(timeSlot)];
        
        workingDays.forEach(day => {
          const isOccupied = schedule.isTimeSlotOccupied(day, timeSlot) && 
            schedule.getEntriesForFacultyAndDay(facultyId, day)
              .some(entry => entry.timeSlot.startTime === timeSlot);
          
          row.push(isOccupied ? '🔴' : '🟢');
        });
        
        lines.push(this.formatComparisonRow(row, columnWidths));
      });
      
      lines.push('');
    });

    return lines.join('\n');
  }

  formatFacultyConflictAnalysis(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    const facultyIds = schedule.getFacultyIds().sort();
    
    lines.push('FACULTY CONFLICT ANALYSIS');
    lines.push('='.repeat(30));
    lines.push('');

    let totalConflicts = 0;
    const conflictsByFaculty = new Map<string, number>();

    facultyIds.forEach(facultyId => {
      const conflicts = schedule.getConflictsForFaculty(facultyId);
      conflictsByFaculty.set(facultyId, conflicts.length);
      totalConflicts += conflicts.length;

      if (conflicts.length > 0) {
        lines.push(`${facultyId}: ${conflicts.length} conflicts`);
        conflicts.forEach((conflict, index) => {
          lines.push(`  ${index + 1}. [${conflict.severity.toUpperCase()}] ${conflict.type}`);
          lines.push(`     ${conflict.message}`);
        });
        lines.push('');
      }
    });

    if (totalConflicts === 0) {
      lines.push('✅ No faculty conflicts detected.');
    } else {
      lines.push(`Total Faculty Conflicts: ${totalConflicts}`);
      
      // Show most problematic faculty
      const sortedConflicts = Array.from(conflictsByFaculty.entries())
        .filter(([, count]) => count > 0)
        .sort(([, a], [, b]) => b - a);
      
      if (sortedConflicts.length > 0) {
        lines.push(`Most Conflicts: ${sortedConflicts[0][0]} (${sortedConflicts[0][1]} conflicts)`);
      }
    }

    return lines.join('\n');
  }

  private formatFacultyInsights(schedule: WeeklySchedule, facultyId: string): string {
    const lines: string[] = [];
    const facultyEntries = schedule.getEntriesForFaculty(facultyId);
    
    lines.push('Faculty Insights:');
    
    // Subject distribution
    const subjectCounts = new Map<string, number>();
    const batchCounts = new Map<string, number>();
    
    facultyEntries.forEach(entry => {
      const subjectCount = subjectCounts.get(entry.subjectId) || 0;
      subjectCounts.set(entry.subjectId, subjectCount + 1);
      
      const batchCount = batchCounts.get(entry.batchId) || 0;
      batchCounts.set(entry.batchId, batchCount + 1);
    });

    lines.push('  Teaching Load:');
    Array.from(subjectCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .forEach(([subject, count]) => {
        lines.push(`    ${subject}: ${count} lectures`);
      });

    lines.push('  Batch Distribution:');
    Array.from(batchCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .forEach(([batch, count]) => {
        lines.push(`    ${batch}: ${count} lectures`);
      });

    // Workload analysis
    const workload = this.calculateFacultyWorkload(facultyEntries);
    lines.push('  Workload Analysis:');
    lines.push(`    Busiest Day: ${workload.busiestDay} (${workload.maxDayHours.toFixed(1)}h)`);
    lines.push(`    Lightest Day: ${workload.lightestDay} (${workload.minDayHours.toFixed(1)}h)`);
    lines.push(`    Free Days: ${workload.freeDays}`);

    return lines.join('\n');
  }

  private formatFacultyStatistics(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    const facultyIds = schedule.getFacultyIds();
    
    lines.push('OVERALL FACULTY STATISTICS');
    lines.push('-'.repeat(30));
    
    lines.push(`Total Faculty Members: ${facultyIds.length}`);
    
    // Calculate faculty workload statistics
    const facultyWorkloads = facultyIds.map(facultyId => {
      const entries = schedule.getEntriesForFaculty(facultyId);
      return this.calculateFacultyWorkload(entries);
    });

    if (facultyWorkloads.length > 0) {
      const totalHours = facultyWorkloads.reduce((sum, workload) => sum + workload.totalHours, 0);
      const averageHours = totalHours / facultyWorkloads.length;
      const maxHours = Math.max(...facultyWorkloads.map(w => w.totalHours));
      const minHours = Math.min(...facultyWorkloads.map(w => w.totalHours));
      
      lines.push(`Average Hours per Faculty: ${averageHours.toFixed(1)}`);
      lines.push(`Maximum Hours: ${maxHours.toFixed(1)}`);
      lines.push(`Minimum Hours: ${minHours.toFixed(1)}`);
      
      // Find most and least loaded faculty
      const maxIndex = facultyWorkloads.findIndex(w => w.totalHours === maxHours);
      const minIndex = facultyWorkloads.findIndex(w => w.totalHours === minHours);
      
      lines.push(`Most Loaded Faculty: ${facultyIds[maxIndex]} (${maxHours.toFixed(1)} hours)`);
      lines.push(`Least Loaded Faculty: ${facultyIds[minIndex]} (${minHours.toFixed(1)} hours)`);
    }

    return lines.join('\n');
  }

  private formatWorkloadSummary(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    const facultyIds = schedule.getFacultyIds();
    
    lines.push('Workload Summary:');
    
    const workloads = facultyIds.map(facultyId => {
      const entries = schedule.getEntriesForFaculty(facultyId);
      return this.calculateFacultyWorkload(entries);
    });

    if (workloads.length > 0) {
      const totalHours = workloads.reduce((sum, w) => sum + w.totalHours, 0);
      const averageHours = totalHours / workloads.length;
      
      // Calculate workload distribution
      const overloaded = workloads.filter(w => w.totalHours > averageHours * 1.2).length;
      const underloaded = workloads.filter(w => w.totalHours < averageHours * 0.8).length;
      const balanced = workloads.length - overloaded - underloaded;
      
      lines.push(`  Balanced Workload: ${balanced} faculty (${(balanced/workloads.length*100).toFixed(1)}%)`);
      lines.push(`  Overloaded: ${overloaded} faculty (${(overloaded/workloads.length*100).toFixed(1)}%)`);
      lines.push(`  Underloaded: ${underloaded} faculty (${(underloaded/workloads.length*100).toFixed(1)}%)`);
    }

    return lines.join('\n');
  }

  private calculateFacultyWorkload(entries: ScheduleEntry[]): {
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

  private calculateDayHours(entries: ScheduleEntry[]): number {
    return entries.reduce((total, entry) => {
      return total + this.calculateEntryDuration(entry);
    }, 0);
  }

  private calculateEntryDuration(entry: ScheduleEntry): number {
    const startMinutes = this.timeToMinutes(entry.timeSlot.startTime);
    const endMinutes = this.timeToMinutes(entry.timeSlot.endTime);
    return (endMinutes - startMinutes) / 60; // Convert to hours
  }

  private findGapsInDay(entries: ScheduleEntry[]): Array<{start: string, end: string, duration: number}> {
    const gaps: Array<{start: string, end: string, duration: number}> = [];
    const sortedEntries = this.sortEntriesByTime(entries);

    for (let i = 0; i < sortedEntries.length - 1; i++) {
      const currentEnd = sortedEntries[i].timeSlot.endTime;
      const nextStart = sortedEntries[i + 1].timeSlot.startTime;
      
      const currentEndMinutes = this.timeToMinutes(currentEnd);
      const nextStartMinutes = this.timeToMinutes(nextStart);
      const gapDuration = nextStartMinutes - currentEndMinutes;

      if (gapDuration > 0) {
        gaps.push({
          start: currentEnd,
          end: nextStart,
          duration: gapDuration
        });
      }
    }

    return gaps;
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
