import { WeeklySchedule } from '../models/WeeklySchedule';
import { ScheduleEntry, DayOfWeek } from '../models';

export interface FormatterOptions {
  includeConflicts?: boolean;
  includeStatistics?: boolean;
  includeMetadata?: boolean;
  timeFormat?: '12h' | '24h';
  showEmptySlots?: boolean;
  highlightConflicts?: boolean;
  compactView?: boolean;
  colorOutput?: boolean;
}

export abstract class BaseScheduleFormatter {
  protected options: Required<FormatterOptions>;

  constructor(options: FormatterOptions = {}) {
    this.options = {
      includeConflicts: true,
      includeStatistics: false,
      includeMetadata: false,
      timeFormat: '24h',
      showEmptySlots: false,
      highlightConflicts: true,
      compactView: false,
      colorOutput: false,
      ...options
    };
  }

  abstract format(schedule: WeeklySchedule): string;

  protected formatTime(time: string): string {
    if (this.options.timeFormat === '12h') {
      const [hours, minutes] = time.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }
    return time;
  }

  protected sortEntriesByTime(entries: ScheduleEntry[]): ScheduleEntry[] {
    return [...entries].sort((a, b) => {
      const timeA = this.timeToMinutes(a.timeSlot.startTime);
      const timeB = this.timeToMinutes(b.timeSlot.startTime);
      return timeA - timeB;
    });
  }

  protected timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  protected getDayDisplayName(day: DayOfWeek): string {
    return day.toString();
  }

  protected isConflictingEntry(entry: ScheduleEntry, schedule: WeeklySchedule): boolean {
    return schedule.conflicts.some(conflict => 
      conflict.affectedEntries.some(affectedEntry => 
        affectedEntry.batchId === entry.batchId &&
        affectedEntry.subjectId === entry.subjectId &&
        affectedEntry.timeSlot.day === entry.timeSlot.day &&
        affectedEntry.timeSlot.startTime === entry.timeSlot.startTime
      )
    );
  }
}

export class TabularScheduleFormatter extends BaseScheduleFormatter {
  format(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    
    if (this.options.includeMetadata) {
      lines.push(this.formatMetadata(schedule));
      lines.push('');
    }

    lines.push(this.formatWeeklyView(schedule));

    if (this.options.includeConflicts && schedule.conflicts.length > 0) {
      lines.push('');
      lines.push(this.formatConflicts(schedule));
    }

    if (this.options.includeStatistics) {
      lines.push('');
      lines.push(this.formatStatistics(schedule));
    }

    return lines.join('\n');
  }

  private formatWeeklyView(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    const workingDays = [
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY
    ];

    // Get all unique time slots
    const timeSlots = this.getUniqueTimeSlots(schedule);
    
    // Create header
    const header = ['Time', ...workingDays.map(day => this.getDayDisplayName(day))];
    const columnWidths = this.calculateColumnWidths(header, schedule, workingDays);
    
    lines.push(this.formatTableRow(header, columnWidths));
    lines.push(this.formatSeparatorRow(columnWidths));

    // Create rows for each time slot
    timeSlots.forEach(timeSlot => {
      const row = [this.formatTimeSlot(timeSlot)];
      
      workingDays.forEach(day => {
        const dayEntries = schedule.getEntriesForDay(day)
          .filter(entry => entry.timeSlot.startTime === timeSlot);
        
        if (dayEntries.length > 0) {
          const cellContent = dayEntries.map(entry => 
            this.formatScheduleEntry(entry, schedule)
          ).join('\n');
          row.push(cellContent);
        } else if (this.options.showEmptySlots) {
          row.push('-');
        } else {
          row.push('');
        }
      });
      
      lines.push(this.formatTableRow(row, columnWidths));
    });

    return lines.join('\n');
  }

  private formatBatchView(schedule: WeeklySchedule, batchId: string): string {
    const lines: string[] = [];
    const batchEntries = schedule.getEntriesForBatch(batchId);
    
    if (batchEntries.length === 0) {
      return `No entries found for batch: ${batchId}`;
    }

    lines.push(`Schedule for Batch: ${batchId}`);
    lines.push('='.repeat(40));

    const workingDays = [
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY
    ];

    workingDays.forEach(day => {
      const dayEntries = batchEntries.filter(entry => entry.timeSlot.day === day);
      
      if (dayEntries.length > 0) {
        lines.push('');
        lines.push(`${this.getDayDisplayName(day)}:`);
        lines.push('-'.repeat(20));
        
        const sortedEntries = this.sortEntriesByTime(dayEntries);
        sortedEntries.forEach(entry => {
          lines.push(`  ${this.formatTime(entry.timeSlot.startTime)} - ${this.formatTime(entry.timeSlot.endTime)}: ${entry.subjectId} (${entry.facultyId})`);
        });
      }
    });

    return lines.join('\n');
  }

  private formatFacultyView(schedule: WeeklySchedule, facultyId: string): string {
    const lines: string[] = [];
    const facultyEntries = schedule.getEntriesForFaculty(facultyId);
    
    if (facultyEntries.length === 0) {
      return `No entries found for faculty: ${facultyId}`;
    }

    lines.push(`Schedule for Faculty: ${facultyId}`);
    lines.push('='.repeat(40));

    const workingDays = [
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY
    ];

    workingDays.forEach(day => {
      const dayEntries = facultyEntries.filter(entry => entry.timeSlot.day === day);
      
      if (dayEntries.length > 0) {
        lines.push('');
        lines.push(`${this.getDayDisplayName(day)}:`);
        lines.push('-'.repeat(20));
        
        const sortedEntries = this.sortEntriesByTime(dayEntries);
        sortedEntries.forEach(entry => {
          lines.push(`  ${this.formatTime(entry.timeSlot.startTime)} - ${this.formatTime(entry.timeSlot.endTime)}: ${entry.subjectId} (Batch: ${entry.batchId})`);
        });
      }
    });

    return lines.join('\n');
  }

  private getUniqueTimeSlots(schedule: WeeklySchedule): string[] {
    const timeSlots = new Set<string>();
    schedule.entries.forEach(entry => {
      timeSlots.add(entry.timeSlot.startTime);
    });
    
    return Array.from(timeSlots).sort((a, b) => 
      this.timeToMinutes(a) - this.timeToMinutes(b)
    );
  }

  private formatTimeSlot(timeSlot: string): string {
    return this.formatTime(timeSlot);
  }

  private formatScheduleEntry(entry: ScheduleEntry, schedule: WeeklySchedule): string {
    let content = `${entry.subjectId}\n(${entry.batchId})`;
    
    if (!this.options.compactView) {
      content += `\n${entry.facultyId}`;
    }

    if (this.options.highlightConflicts && this.isConflictingEntry(entry, schedule)) {
      content = `⚠️ ${content}`;
    }

    return content;
  }

  private calculateColumnWidths(
    header: string[], 
    schedule: WeeklySchedule, 
    workingDays: DayOfWeek[]
  ): number[] {
    const widths = header.map(h => h.length);
    
    // Check content widths
    schedule.entries.forEach(entry => {
      const dayIndex = workingDays.indexOf(entry.timeSlot.day);
      if (dayIndex !== -1) {
        const content = this.formatScheduleEntry(entry, schedule);
        const maxLineLength = Math.max(...content.split('\n').map(line => line.length));
        widths[dayIndex + 1] = Math.max(widths[dayIndex + 1], maxLineLength);
      }
    });

    // Ensure minimum widths
    return widths.map(width => Math.max(width, 12));
  }

  private formatTableRow(cells: string[], widths: number[]): string {
    const paddedCells = cells.map((cell, index) => {
      const lines = cell.split('\n');
      const maxLines = Math.max(1, lines.length);
      const paddedLines = [];
      
      for (let i = 0; i < maxLines; i++) {
        const line = lines[i] || '';
        paddedLines.push(line.padEnd(widths[index]));
      }
      
      return paddedLines;
    });

    const maxLines = Math.max(...paddedCells.map(cell => cell.length));
    const rows: string[] = [];
    
    for (let i = 0; i < maxLines; i++) {
      const rowCells = paddedCells.map(cell => cell[i] || ''.padEnd(widths[paddedCells.indexOf(cell)]));
      rows.push('| ' + rowCells.join(' | ') + ' |');
    }
    
    return rows.join('\n');
  }

  private formatSeparatorRow(widths: number[]): string {
    const separators = widths.map(width => '-'.repeat(width));
    return '|-' + separators.join('-|-') + '-|';
  }

  private formatMetadata(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    lines.push('Schedule Metadata:');
    lines.push(`Generated: ${schedule.metadata.generatedAt.toLocaleString()}`);
    lines.push(`Total Lectures: ${schedule.metadata.totalLectures}`);
    lines.push(`Batch Count: ${schedule.metadata.batchCount}`);
    
    if (schedule.metadata.facultyCount !== undefined) {
      lines.push(`Faculty Count: ${schedule.metadata.facultyCount}`);
    }
    
    if (schedule.metadata.optimizationScore !== undefined) {
      lines.push(`Optimization Score: ${(schedule.metadata.optimizationScore * 100).toFixed(1)}%`);
    }
    
    return lines.join('\n');
  }

  private formatConflicts(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    lines.push('Conflicts:');
    lines.push('-'.repeat(20));
    
    if (schedule.conflicts.length === 0) {
      lines.push('No conflicts detected.');
    } else {
      schedule.conflicts.forEach((conflict, index) => {
        lines.push(`${index + 1}. [${conflict.severity.toUpperCase()}] ${conflict.type}: ${conflict.message}`);
        if (conflict.affectedEntries.length > 0) {
          lines.push(`   Affected entries: ${conflict.affectedEntries.length}`);
        }
      });
    }
    
    return lines.join('\n');
  }

  private formatStatistics(schedule: WeeklySchedule): string {
    const stats = schedule.calculateStatistics();
    const lines: string[] = [];
    
    lines.push('Schedule Statistics:');
    lines.push('-'.repeat(20));
    lines.push(`Total Entries: ${stats.totalEntries}`);
    lines.push(`Time Slot Utilization: ${stats.timeSlotUtilization.utilizationRate}%`);
    lines.push(`Average Entries per Day: ${stats.dailyLoadDistribution.averageEntriesPerDay}`);
    lines.push(`Max Entries per Day: ${stats.dailyLoadDistribution.maxEntriesPerDay}`);
    lines.push(`Min Entries per Day: ${stats.dailyLoadDistribution.minEntriesPerDay}`);
    
    lines.push('');
    lines.push('Entries per Day:');
    stats.entriesPerDay.forEach((count, day) => {
      lines.push(`  ${day}: ${count}`);
    });
    
    return lines.join('\n');
  }

  formatBatchView(schedule: WeeklySchedule, batchId: string): string {
    return this.formatBatchView(schedule, batchId);
  }

  formatFacultyView(schedule: WeeklySchedule, facultyId: string): string {
    return this.formatFacultyView(schedule, facultyId);
  }
}

export class CompactScheduleFormatter extends BaseScheduleFormatter {
  format(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    const workingDays = [
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY
    ];

    workingDays.forEach(day => {
      const dayEntries = schedule.getEntriesForDay(day);
      if (dayEntries.length > 0) {
        lines.push(`${this.getDayDisplayName(day)}: ${dayEntries.length} lectures`);
        
        const sortedEntries = this.sortEntriesByTime(dayEntries);
        const timeSlots = sortedEntries.map(entry => 
          `${this.formatTime(entry.timeSlot.startTime)}(${entry.subjectId})`
        ).join(', ');
        
        lines.push(`  ${timeSlots}`);
      }
    });

    if (this.options.includeConflicts && schedule.conflicts.length > 0) {
      lines.push('');
      lines.push(`Conflicts: ${schedule.conflicts.length}`);
    }

    return lines.join('\n');
  }
}

export class DetailedScheduleFormatter extends BaseScheduleFormatter {
  format(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    
    lines.push('DETAILED TIMETABLE SCHEDULE');
    lines.push('='.repeat(50));
    lines.push('');

    if (this.options.includeMetadata) {
      lines.push(this.formatDetailedMetadata(schedule));
      lines.push('');
    }

    lines.push(this.formatDetailedSchedule(schedule));

    if (this.options.includeConflicts) {
      lines.push('');
      lines.push(this.formatDetailedConflicts(schedule));
    }

    if (this.options.includeStatistics) {
      lines.push('');
      lines.push(this.formatDetailedStatistics(schedule));
    }

    return lines.join('\n');
  }

  private formatDetailedMetadata(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    const summary = schedule.getSummary();
    
    lines.push('SCHEDULE OVERVIEW:');
    lines.push(`📅 Generated: ${schedule.metadata.generatedAt.toLocaleString()}`);
    lines.push(`📚 Total Lectures: ${summary.totalLectures}`);
    lines.push(`🎓 Batches: ${summary.totalBatches}`);
    lines.push(`👨‍🏫 Faculty Members: ${summary.totalFaculties}`);
    lines.push(`📖 Subjects: ${summary.totalSubjects}`);
    
    if (summary.totalConflicts > 0) {
      lines.push(`⚠️ Conflicts: ${summary.totalConflicts} (${summary.errorConflicts} errors, ${summary.warningConflicts} warnings)`);
    } else {
      lines.push('✅ No conflicts detected');
    }

    if (schedule.metadata.optimizationScore !== undefined) {
      lines.push(`📊 Optimization Score: ${(schedule.metadata.optimizationScore * 100).toFixed(1)}%`);
    }

    return lines.join('\n');
  }

  private formatDetailedSchedule(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    const workingDays = [
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY
    ];

    lines.push('WEEKLY SCHEDULE:');
    lines.push('-'.repeat(30));

    workingDays.forEach(day => {
      const dayEntries = schedule.getEntriesForDay(day);
      
      lines.push('');
      lines.push(`${this.getDayDisplayName(day).toUpperCase()} (${dayEntries.length} lectures):`);
      
      if (dayEntries.length === 0) {
        lines.push('  No lectures scheduled');
      } else {
        const sortedEntries = this.sortEntriesByTime(dayEntries);
        sortedEntries.forEach(entry => {
          const conflictMarker = this.isConflictingEntry(entry, schedule) ? '⚠️ ' : '';
          lines.push(`  ${conflictMarker}${this.formatTime(entry.timeSlot.startTime)} - ${this.formatTime(entry.timeSlot.endTime)}`);
          lines.push(`     📖 ${entry.subjectId} | 🎓 ${entry.batchId} | 👨‍🏫 ${entry.facultyId}`);
        });
      }
    });

    return lines.join('\n');
  }

  private formatDetailedConflicts(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    
    lines.push('CONFLICT ANALYSIS:');
    lines.push('-'.repeat(30));
    
    if (schedule.conflicts.length === 0) {
      lines.push('✅ No conflicts detected in the schedule.');
    } else {
      const errorConflicts = schedule.getConflictsBySeverity('error');
      const warningConflicts = schedule.getConflictsBySeverity('warning');
      
      if (errorConflicts.length > 0) {
        lines.push('');
        lines.push(`🚨 CRITICAL ERRORS (${errorConflicts.length}):`);
        errorConflicts.forEach((conflict, index) => {
          lines.push(`  ${index + 1}. ${conflict.type}: ${conflict.message}`);
          lines.push(`     Affected: ${conflict.affectedEntries.length} entries`);
        });
      }
      
      if (warningConflicts.length > 0) {
        lines.push('');
        lines.push(`⚠️ WARNINGS (${warningConflicts.length}):`);
        warningConflicts.forEach((conflict, index) => {
          lines.push(`  ${index + 1}. ${conflict.type}: ${conflict.message}`);
          lines.push(`     Affected: ${conflict.affectedEntries.length} entries`);
        });
      }
    }
    
    return lines.join('\n');
  }

  private formatDetailedStatistics(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    const stats = schedule.calculateStatistics();
    
    lines.push('DETAILED STATISTICS:');
    lines.push('-'.repeat(30));
    
    lines.push('');
    lines.push('📊 Daily Distribution:');
    stats.entriesPerDay.forEach((count, day) => {
      const percentage = stats.totalEntries > 0 ? (count / stats.totalEntries * 100).toFixed(1) : '0.0';
      lines.push(`  ${day}: ${count} lectures (${percentage}%)`);
    });
    
    lines.push('');
    lines.push('🎓 Batch Distribution:');
    Array.from(stats.entriesPerBatch.entries())
      .sort(([,a], [,b]) => b - a)
      .forEach(([batch, count]) => {
        lines.push(`  ${batch}: ${count} lectures`);
      });
    
    lines.push('');
    lines.push('👨‍🏫 Faculty Workload:');
    Array.from(stats.entriesPerFaculty.entries())
      .sort(([,a], [,b]) => b - a)
      .forEach(([faculty, count]) => {
        lines.push(`  ${faculty}: ${count} lectures`);
      });
    
    lines.push('');
    lines.push('⏰ Time Slot Utilization:');
    lines.push(`  Total Available Slots: ${stats.timeSlotUtilization.totalSlots}`);
    lines.push(`  Occupied Slots: ${stats.timeSlotUtilization.occupiedSlots}`);
    lines.push(`  Utilization Rate: ${stats.timeSlotUtilization.utilizationRate}%`);
    
    lines.push('');
    lines.push('📈 Load Distribution:');
    lines.push(`  Average per Day: ${stats.dailyLoadDistribution.averageEntriesPerDay}`);
    lines.push(`  Maximum per Day: ${stats.dailyLoadDistribution.maxEntriesPerDay}`);
    lines.push(`  Minimum per Day: ${stats.dailyLoadDistribution.minEntriesPerDay}`);
    lines.push(`  Standard Deviation: ${stats.dailyLoadDistribution.standardDeviation}`);
    
    return lines.join('\n');
  }
}
