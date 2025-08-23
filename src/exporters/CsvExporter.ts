import { BaseExporter, ExportResult, ExportFormat } from './ExportInterfaces';
import { WeeklySchedule } from '../models/WeeklySchedule';
import { ScheduleEntry, ConstraintViolation } from '../models';

export class CsvExporter extends BaseExporter {
  async export(schedule: WeeklySchedule): Promise<ExportResult> {
    const startTime = Date.now();
    
    try {
      const filteredEntries = this.filterEntries(schedule.entries);
      const sortedEntries = this.sortEntries(filteredEntries);
      
      let csvContent = '';
      
      // Add metadata section if requested
      if (this.options.includeMetadata) {
        csvContent += this.generateMetadataSection(schedule);
        csvContent += '\n';
      }

      // Add main schedule data
      csvContent += this.generateScheduleSection(sortedEntries);

      // Add conflicts section if requested
      if (this.options.includeConflicts && schedule.conflicts.length > 0) {
        csvContent += '\n';
        csvContent += this.generateConflictsSection(schedule.conflicts);
      }

      // Add statistics section if requested
      if (this.options.includeStatistics) {
        csvContent += '\n';
        csvContent += this.generateStatisticsSection(schedule);
      }

      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        data: csvContent,
        filename: this.options.filename,
        mimeType: 'text/csv',
        size: Buffer.byteLength(csvContent, this.options.encoding),
        metadata: {
          exportedAt: new Date(),
          format: ExportFormat.CSV,
          entriesCount: sortedEntries.length,
          processingTimeMs: processingTime
        }
      };
    } catch (error) {
      return {
        success: false,
        filename: this.options.filename,
        mimeType: 'text/csv',
        size: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: {
          exportedAt: new Date(),
          format: ExportFormat.CSV,
          entriesCount: 0,
          processingTimeMs: Date.now() - startTime
        }
      };
    }
  }

  private generateMetadataSection(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    
    lines.push('# SCHEDULE METADATA');
    lines.push(`Generated At${this.options.delimiter}${this.formatDate(schedule.metadata.generatedAt)}`);
    lines.push(`Total Lectures${this.options.delimiter}${schedule.metadata.totalLectures}`);
    lines.push(`Batch Count${this.options.delimiter}${schedule.metadata.batchCount}`);
    
    if (schedule.metadata.facultyCount !== undefined) {
      lines.push(`Faculty Count${this.options.delimiter}${schedule.metadata.facultyCount}`);
    }
    
    if (schedule.metadata.optimizationScore !== undefined) {
      lines.push(`Optimization Score${this.options.delimiter}${(schedule.metadata.optimizationScore * 100).toFixed(1)}%`);
    }
    
    if (schedule.metadata.generationTimeMs !== undefined) {
      lines.push(`Generation Time (ms)${this.options.delimiter}${schedule.metadata.generationTimeMs}`);
    }

    return lines.join('\n');
  }

  private generateScheduleSection(entries: ScheduleEntry[]): string {
    const lines: string[] = [];
    
    // Add section header
    lines.push('# SCHEDULE ENTRIES');
    
    // Add column headers if requested
    if (this.options.includeHeaders) {
      const headers = [
        'Day',
        'Start Time',
        'End Time',
        'Duration (min)',
        'Subject',
        'Batch',
        'Faculty'
      ];
      lines.push(headers.join(this.options.delimiter));
    }

    // Add data rows
    entries.forEach(entry => {
      const duration = this.calculateDuration(entry.timeSlot.startTime, entry.timeSlot.endTime);
      const row = [
        this.escapeField(entry.timeSlot.day),
        this.escapeField(this.formatTime(entry.timeSlot.startTime)),
        this.escapeField(this.formatTime(entry.timeSlot.endTime)),
        duration.toString(),
        this.escapeField(entry.subjectId),
        this.escapeField(entry.batchId),
        this.escapeField(entry.facultyId)
      ];
      lines.push(row.join(this.options.delimiter));
    });

    return lines.join('\n');
  }

  private generateConflictsSection(conflicts: ConstraintViolation[]): string {
    const lines: string[] = [];
    
    lines.push('# CONFLICTS');
    
    if (this.options.includeHeaders) {
      const headers = [
        'Type',
        'Severity',
        'Message',
        'Affected Entries Count',
        'Affected Batches',
        'Affected Faculties'
      ];
      lines.push(headers.join(this.options.delimiter));
    }

    conflicts.forEach(conflict => {
      const affectedBatches = [...new Set(conflict.affectedEntries.map(e => e.batchId))];
      const affectedFaculties = [...new Set(conflict.affectedEntries.map(e => e.facultyId))];
      
      const row = [
        this.escapeField(conflict.type),
        this.escapeField(conflict.severity),
        this.escapeField(conflict.message),
        conflict.affectedEntries.length.toString(),
        this.escapeField(affectedBatches.join('; ')),
        this.escapeField(affectedFaculties.join('; '))
      ];
      lines.push(row.join(this.options.delimiter));
    });

    return lines.join('\n');
  }

  private generateStatisticsSection(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    const stats = schedule.calculateStatistics();
    
    lines.push('# STATISTICS');
    
    // Daily distribution
    lines.push('## Daily Distribution');
    if (this.options.includeHeaders) {
      lines.push(`Day${this.options.delimiter}Lecture Count${this.options.delimiter}Percentage`);
    }
    
    stats.entriesPerDay.forEach((count, day) => {
      const percentage = stats.totalEntries > 0 ? (count / stats.totalEntries * 100).toFixed(1) : '0.0';
      lines.push(`${day}${this.options.delimiter}${count}${this.options.delimiter}${percentage}%`);
    });

    // Batch distribution
    lines.push('## Batch Distribution');
    if (this.options.includeHeaders) {
      lines.push(`Batch${this.options.delimiter}Lecture Count`);
    }
    
    Array.from(stats.entriesPerBatch.entries())
      .sort(([,a], [,b]) => b - a)
      .forEach(([batch, count]) => {
        lines.push(`${this.escapeField(batch)}${this.options.delimiter}${count}`);
      });

    // Faculty distribution
    lines.push('## Faculty Distribution');
    if (this.options.includeHeaders) {
      lines.push(`Faculty${this.options.delimiter}Lecture Count`);
    }
    
    Array.from(stats.entriesPerFaculty.entries())
      .sort(([,a], [,b]) => b - a)
      .forEach(([faculty, count]) => {
        lines.push(`${this.escapeField(faculty)}${this.options.delimiter}${count}`);
      });

    // Utilization metrics
    lines.push('## Utilization Metrics');
    lines.push(`Total Entries${this.options.delimiter}${stats.totalEntries}`);
    lines.push(`Time Slot Utilization${this.options.delimiter}${stats.timeSlotUtilization.utilizationRate}%`);
    lines.push(`Average Entries per Day${this.options.delimiter}${stats.dailyLoadDistribution.averageEntriesPerDay}`);
    lines.push(`Max Entries per Day${this.options.delimiter}${stats.dailyLoadDistribution.maxEntriesPerDay}`);
    lines.push(`Min Entries per Day${this.options.delimiter}${stats.dailyLoadDistribution.minEntriesPerDay}`);
    lines.push(`Standard Deviation${this.options.delimiter}${stats.dailyLoadDistribution.standardDeviation}`);

    return lines.join('\n');
  }

  private calculateDuration(startTime: string, endTime: string): number {
    const start = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);
    return end - start;
  }

  private timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private escapeField(field: string): string {
    // Escape fields that contain the delimiter, quotes, or newlines
    if (field.includes(this.options.delimiter) || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  /**
   * Export schedule in pivot table format (days as columns)
   */
  exportPivotFormat(schedule: WeeklySchedule): Promise<ExportResult> {
    const startTime = Date.now();
    
    try {
      const filteredEntries = this.filterEntries(schedule.entries);
      const lines: string[] = [];
      
      // Get unique time slots and sort them
      const timeSlots = [...new Set(filteredEntries.map(e => e.timeSlot.startTime))]
        .sort((a, b) => this.timeToMinutes(a) - this.timeToMinutes(b));
      
      // Create header row
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const headers = ['Time', ...days];
      lines.push(headers.join(this.options.delimiter));
      
      // Create data rows
      timeSlots.forEach(timeSlot => {
        const row = [this.formatTime(timeSlot)];
        
        days.forEach(day => {
          const dayEntries = filteredEntries.filter(entry => 
            entry.timeSlot.day === day && entry.timeSlot.startTime === timeSlot
          );
          
          if (dayEntries.length > 0) {
            const cellContent = dayEntries.map(entry => 
              `${entry.subjectId} (${entry.batchId})`
            ).join('; ');
            row.push(this.escapeField(cellContent));
          } else {
            row.push('');
          }
        });
        
        lines.push(row.join(this.options.delimiter));
      });

      const csvContent = lines.join('\n');
      const processingTime = Date.now() - startTime;
      
      return Promise.resolve({
        success: true,
        data: csvContent,
        filename: this.options.filename.replace('.csv', '_pivot.csv'),
        mimeType: 'text/csv',
        size: Buffer.byteLength(csvContent, this.options.encoding),
        metadata: {
          exportedAt: new Date(),
          format: ExportFormat.CSV,
          entriesCount: filteredEntries.length,
          processingTimeMs: processingTime
        }
      });
    } catch (error) {
      return Promise.resolve({
        success: false,
        filename: this.options.filename,
        mimeType: 'text/csv',
        size: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: {
          exportedAt: new Date(),
          format: ExportFormat.CSV,
          entriesCount: 0,
          processingTimeMs: Date.now() - startTime
        }
      });
    }
  }

  /**
   * Export schedule grouped by batch
   */
  exportByBatch(schedule: WeeklySchedule): Promise<ExportResult> {
    const startTime = Date.now();
    
    try {
      const filteredEntries = this.filterEntries(schedule.entries);
      const batchGroups = new Map<string, ScheduleEntry[]>();
      
      // Group entries by batch
      filteredEntries.forEach(entry => {
        if (!batchGroups.has(entry.batchId)) {
          batchGroups.set(entry.batchId, []);
        }
        batchGroups.get(entry.batchId)!.push(entry);
      });

      const lines: string[] = [];
      
      // Sort batches alphabetically
      const sortedBatches = Array.from(batchGroups.keys()).sort();
      
      sortedBatches.forEach((batchId, index) => {
        if (index > 0) {
          lines.push(''); // Empty line between batches
        }
        
        lines.push(`# BATCH: ${batchId}`);
        
        if (this.options.includeHeaders) {
          const headers = ['Day', 'Start Time', 'End Time', 'Subject', 'Faculty'];
          lines.push(headers.join(this.options.delimiter));
        }
        
        const batchEntries = this.sortEntries(batchGroups.get(batchId)!);
        batchEntries.forEach(entry => {
          const row = [
            this.escapeField(entry.timeSlot.day),
            this.escapeField(this.formatTime(entry.timeSlot.startTime)),
            this.escapeField(this.formatTime(entry.timeSlot.endTime)),
            this.escapeField(entry.subjectId),
            this.escapeField(entry.facultyId)
          ];
          lines.push(row.join(this.options.delimiter));
        });
      });

      const csvContent = lines.join('\n');
      const processingTime = Date.now() - startTime;
      
      return Promise.resolve({
        success: true,
        data: csvContent,
        filename: this.options.filename.replace('.csv', '_by_batch.csv'),
        mimeType: 'text/csv',
        size: Buffer.byteLength(csvContent, this.options.encoding),
        metadata: {
          exportedAt: new Date(),
          format: ExportFormat.CSV,
          entriesCount: filteredEntries.length,
          processingTimeMs: processingTime
        }
      });
    } catch (error) {
      return Promise.resolve({
        success: false,
        filename: this.options.filename,
        mimeType: 'text/csv',
        size: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: {
          exportedAt: new Date(),
          format: ExportFormat.CSV,
          entriesCount: 0,
          processingTimeMs: Date.now() - startTime
        }
      });
    }
  }
}
