import { 
  ExportOptions, 
  ExportResult, 
  ExportFormat, 
  ComparisonOptions, 
  ComparisonResult,
  PrintableOptions 
} from './ExportInterfaces';
import { WeeklySchedule } from '../models/WeeklySchedule';
import { CsvExporter } from './CsvExporter';
import { JsonExporter } from './JsonExporter';
import { HtmlExporter } from './HtmlExporter';
import { ScheduleComparator } from './ScheduleComparator';

export class ExportManager {
  private csvExporter: CsvExporter;
  private jsonExporter: JsonExporter;
  private htmlExporter: HtmlExporter;
  private scheduleComparator: ScheduleComparator;

  constructor() {
    this.csvExporter = new CsvExporter({ format: ExportFormat.CSV });
    this.jsonExporter = new JsonExporter({ format: ExportFormat.JSON });
    this.htmlExporter = new HtmlExporter({ format: ExportFormat.HTML });
    this.scheduleComparator = new ScheduleComparator();
  }

  /**
   * Export schedule in the specified format
   */
  async exportSchedule(schedule: WeeklySchedule, options: ExportOptions): Promise<ExportResult> {
    try {
      switch (options.format) {
        case ExportFormat.CSV:
          this.csvExporter = new CsvExporter(options);
          return await this.csvExporter.export(schedule);

        case ExportFormat.JSON:
          this.jsonExporter = new JsonExporter(options);
          return await this.jsonExporter.export(schedule);

        case ExportFormat.HTML:
          this.htmlExporter = new HtmlExporter(options as PrintableOptions);
          return await this.htmlExporter.export(schedule);

        case ExportFormat.TEXT:
          return await this.exportAsText(schedule, options);

        case ExportFormat.MARKDOWN:
          return await this.exportAsMarkdown(schedule, options);

        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }
    } catch (error) {
      return {
        success: false,
        filename: options.filename || `schedule.${options.format}`,
        mimeType: this.getMimeType(options.format),
        size: 0,
        error: error instanceof Error ? error.message : 'Unknown export error',
        metadata: {
          exportedAt: new Date(),
          format: options.format,
          entriesCount: 0,
          processingTimeMs: 0
        }
      };
    }
  }

  /**
   * Export schedule in multiple formats simultaneously
   */
  async exportMultipleFormats(
    schedule: WeeklySchedule, 
    formats: ExportFormat[],
    baseOptions: Omit<ExportOptions, 'format'>
  ): Promise<Map<ExportFormat, ExportResult>> {
    const results = new Map<ExportFormat, ExportResult>();
    
    const exportPromises = formats.map(async (format) => {
      const options: ExportOptions = {
        ...baseOptions,
        format,
        filename: baseOptions.filename?.replace(/\.[^.]+$/, `.${format}`) || `schedule.${format}`
      };
      
      const result = await this.exportSchedule(schedule, options);
      return { format, result };
    });

    const exportResults = await Promise.all(exportPromises);
    
    exportResults.forEach(({ format, result }) => {
      results.set(format, result);
    });

    return results;
  }

  /**
   * Export schedule with specialized formats
   */
  async exportSpecializedFormat(
    schedule: WeeklySchedule, 
    format: 'pivot' | 'batch' | 'faculty' | 'mobile' | 'api',
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      switch (format) {
        case 'pivot':
          if (options.format === ExportFormat.CSV) {
            this.csvExporter = new CsvExporter(options);
            return await this.csvExporter.exportPivotFormat(schedule);
          }
          throw new Error('Pivot format only supported for CSV export');

        case 'batch':
          if (options.format === ExportFormat.CSV) {
            this.csvExporter = new CsvExporter(options);
            return await this.csvExporter.exportByBatch(schedule);
          }
          throw new Error('Batch format only supported for CSV export');

        case 'mobile':
          if (options.format === ExportFormat.HTML) {
            this.htmlExporter = new HtmlExporter(options as PrintableOptions);
            return await this.htmlExporter.exportMobileFormat(schedule);
          }
          throw new Error('Mobile format only supported for HTML export');

        case 'api':
          if (options.format === ExportFormat.JSON) {
            this.jsonExporter = new JsonExporter(options);
            return await this.jsonExporter.exportApiFormat(schedule);
          }
          throw new Error('API format only supported for JSON export');

        default:
          throw new Error(`Unsupported specialized format: ${format}`);
      }
    } catch (error) {
      return {
        success: false,
        filename: options.filename || `schedule_${format}.${options.format}`,
        mimeType: this.getMimeType(options.format),
        size: 0,
        error: error instanceof Error ? error.message : 'Unknown export error',
        metadata: {
          exportedAt: new Date(),
          format: options.format,
          entriesCount: 0,
          processingTimeMs: 0
        }
      };
    }
  }

  /**
   * Compare two schedules and export the comparison
   */
  async compareAndExport(
    comparisonOptions: ComparisonOptions,
    exportOptions: ExportOptions
  ): Promise<{ comparison: ComparisonResult; export: ExportResult }> {
    const comparison = await this.scheduleComparator.compareSchedules(comparisonOptions);
    const exportResult = await this.scheduleComparator.exportComparison(comparison, exportOptions);
    
    return { comparison, export: exportResult };
  }

  /**
   * Get export statistics for a schedule
   */
  getExportStatistics(schedule: WeeklySchedule): {
    totalEntries: number;
    estimatedSizes: Map<ExportFormat, number>;
    recommendedFormats: ExportFormat[];
    warnings: string[];
  } {
    const totalEntries = schedule.entries.length;
    const estimatedSizes = new Map<ExportFormat, number>();
    const warnings: string[] = [];

    // Estimate file sizes (rough approximations)
    const avgEntrySize = {
      [ExportFormat.CSV]: 100, // bytes per entry
      [ExportFormat.JSON]: 200,
      [ExportFormat.HTML]: 150,
      [ExportFormat.TEXT]: 80,
      [ExportFormat.MARKDOWN]: 90
    };

    Object.entries(avgEntrySize).forEach(([format, size]) => {
      estimatedSizes.set(format as ExportFormat, totalEntries * size);
    });

    // Recommend formats based on schedule size and characteristics
    const recommendedFormats: ExportFormat[] = [];
    
    if (totalEntries < 50) {
      recommendedFormats.push(ExportFormat.HTML, ExportFormat.JSON);
    } else if (totalEntries < 200) {
      recommendedFormats.push(ExportFormat.CSV, ExportFormat.JSON);
    } else {
      recommendedFormats.push(ExportFormat.CSV);
      warnings.push('Large schedule detected. CSV format recommended for better performance.');
    }

    if (schedule.conflicts.length > 0) {
      recommendedFormats.push(ExportFormat.HTML);
      warnings.push('Conflicts detected. HTML format provides better conflict visualization.');
    }

    return {
      totalEntries,
      estimatedSizes,
      recommendedFormats,
      warnings
    };
  }

  /**
   * Validate export options
   */
  validateExportOptions(options: ExportOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!options.format) {
      errors.push('Export format is required');
    }

    // Validate format-specific options
    if (options.format === ExportFormat.CSV && options.delimiter && options.delimiter.length !== 1) {
      errors.push('CSV delimiter must be a single character');
    }

    if (options.format === ExportFormat.HTML) {
      const printOptions = options as PrintableOptions;
      if (printOptions.margins) {
        const { top, right, bottom, left } = printOptions.margins;
        if (top < 0 || right < 0 || bottom < 0 || left < 0) {
          errors.push('Margins must be non-negative values');
        }
      }
    }

    // Validate filter options
    if (options.filterBy?.timeRange) {
      const { start, end } = options.filterBy.timeRange;
      if (!this.isValidTimeFormat(start) || !this.isValidTimeFormat(end)) {
        errors.push('Time range must use HH:MM format');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get supported export formats
   */
  getSupportedFormats(): {
    format: ExportFormat;
    name: string;
    description: string;
    mimeType: string;
    features: string[];
  }[] {
    return [
      {
        format: ExportFormat.CSV,
        name: 'CSV (Comma Separated Values)',
        description: 'Tabular format suitable for spreadsheet applications',
        mimeType: 'text/csv',
        features: ['Pivot tables', 'Batch grouping', 'Statistics', 'Filtering']
      },
      {
        format: ExportFormat.JSON,
        name: 'JSON (JavaScript Object Notation)',
        description: 'Structured data format ideal for APIs and data exchange',
        mimeType: 'application/json',
        features: ['Full metadata', 'Conflict details', 'Statistics', 'API format']
      },
      {
        format: ExportFormat.HTML,
        name: 'HTML (HyperText Markup Language)',
        description: 'Web format with rich formatting and print capabilities',
        mimeType: 'text/html',
        features: ['Print-ready', 'Mobile format', 'Conflict highlighting', 'Visual formatting']
      },
      {
        format: ExportFormat.TEXT,
        name: 'Plain Text',
        description: 'Simple text format for basic viewing and sharing',
        mimeType: 'text/plain',
        features: ['Lightweight', 'Universal compatibility']
      },
      {
        format: ExportFormat.MARKDOWN,
        name: 'Markdown',
        description: 'Formatted text suitable for documentation and README files',
        mimeType: 'text/markdown',
        features: ['Documentation-friendly', 'Version control friendly']
      }
    ];
  }

  private async exportAsText(schedule: WeeklySchedule, options: ExportOptions): Promise<ExportResult> {
    const startTime = Date.now();
    
    try {
      const filteredEntries = this.filterAndSortEntries(schedule.entries, options);
      const lines: string[] = [];
      
      lines.push('WEEKLY TIMETABLE');
      lines.push('='.repeat(50));
      lines.push('');
      lines.push(`Generated: ${schedule.metadata.generatedAt.toLocaleString()}`);
      lines.push(`Total Lectures: ${schedule.metadata.totalLectures}`);
      lines.push('');

      // Group by day
      const workingDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      
      workingDays.forEach(day => {
        const dayEntries = filteredEntries.filter(entry => entry.timeSlot.day === day);
        
        lines.push(`${day.toUpperCase()} (${dayEntries.length} lectures):`);
        
        if (dayEntries.length === 0) {
          lines.push('  No lectures scheduled');
        } else {
          dayEntries
            .sort((a, b) => a.timeSlot.startTime.localeCompare(b.timeSlot.startTime))
            .forEach(entry => {
              lines.push(`  ${entry.timeSlot.startTime} - ${entry.timeSlot.endTime}: ${entry.subjectId} (${entry.batchId}) - ${entry.facultyId}`);
            });
        }
        lines.push('');
      });

      const textContent = lines.join('\n');
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        data: textContent,
        filename: options.filename || 'schedule.txt',
        mimeType: 'text/plain',
        size: Buffer.byteLength(textContent, options.encoding || 'utf8'),
        metadata: {
          exportedAt: new Date(),
          format: ExportFormat.TEXT,
          entriesCount: filteredEntries.length,
          processingTimeMs: processingTime
        }
      };
    } catch (error) {
      return {
        success: false,
        filename: options.filename || 'schedule.txt',
        mimeType: 'text/plain',
        size: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: {
          exportedAt: new Date(),
          format: ExportFormat.TEXT,
          entriesCount: 0,
          processingTimeMs: Date.now() - startTime
        }
      };
    }
  }

  private async exportAsMarkdown(schedule: WeeklySchedule, options: ExportOptions): Promise<ExportResult> {
    const startTime = Date.now();
    
    try {
      const filteredEntries = this.filterAndSortEntries(schedule.entries, options);
      const lines: string[] = [];
      
      lines.push('# Weekly Timetable');
      lines.push('');
      lines.push(`**Generated:** ${schedule.metadata.generatedAt.toLocaleString()}`);
      lines.push(`**Total Lectures:** ${schedule.metadata.totalLectures}`);
      lines.push('');

      // Create table
      lines.push('| Time | Monday | Tuesday | Wednesday | Thursday | Friday |');
      lines.push('|------|--------|---------|-----------|----------|--------|');

      // Get unique time slots
      const timeSlots = [...new Set(filteredEntries.map(e => e.timeSlot.startTime))]
        .sort();

      const workingDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

      timeSlots.forEach(timeSlot => {
        const row = [`**${timeSlot}**`];
        
        workingDays.forEach(day => {
          const dayEntries = filteredEntries.filter(entry => 
            entry.timeSlot.day === day && entry.timeSlot.startTime === timeSlot
          );
          
          if (dayEntries.length > 0) {
            const cellContent = dayEntries.map(entry => 
              `${entry.subjectId}<br>*(${entry.batchId})*`
            ).join('<br>');
            row.push(cellContent);
          } else {
            row.push('-');
          }
        });
        
        lines.push(`| ${row.join(' | ')} |`);
      });

      const markdownContent = lines.join('\n');
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        data: markdownContent,
        filename: options.filename || 'schedule.md',
        mimeType: 'text/markdown',
        size: Buffer.byteLength(markdownContent, options.encoding || 'utf8'),
        metadata: {
          exportedAt: new Date(),
          format: ExportFormat.MARKDOWN,
          entriesCount: filteredEntries.length,
          processingTimeMs: processingTime
        }
      };
    } catch (error) {
      return {
        success: false,
        filename: options.filename || 'schedule.md',
        mimeType: 'text/markdown',
        size: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: {
          exportedAt: new Date(),
          format: ExportFormat.MARKDOWN,
          entriesCount: 0,
          processingTimeMs: Date.now() - startTime
        }
      };
    }
  }

  private filterAndSortEntries(entries: any[], options: ExportOptions): any[] {
    // This would use the same filtering logic as BaseExporter
    // For now, return entries as-is
    return entries.sort((a, b) => {
      const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const dayA = dayOrder.indexOf(a.timeSlot.day);
      const dayB = dayOrder.indexOf(b.timeSlot.day);
      
      if (dayA !== dayB) {
        return dayA - dayB;
      }
      
      return a.timeSlot.startTime.localeCompare(b.timeSlot.startTime);
    });
  }

  private getMimeType(format: ExportFormat): string {
    const mimeTypes = {
      [ExportFormat.CSV]: 'text/csv',
      [ExportFormat.JSON]: 'application/json',
      [ExportFormat.HTML]: 'text/html',
      [ExportFormat.TEXT]: 'text/plain',
      [ExportFormat.MARKDOWN]: 'text/markdown',
      [ExportFormat.XML]: 'application/xml',
      [ExportFormat.PDF]: 'application/pdf',
      [ExportFormat.EXCEL]: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      [ExportFormat.ICAL]: 'text/calendar'
    };

    return mimeTypes[format] || 'application/octet-stream';
  }

  private isValidTimeFormat(time: string): boolean {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }
}
