import { ExportManager } from '../exporters/ExportManager';
import { ExportFormat, ExportOptions } from '../exporters/ExportInterfaces';
import { WeeklySchedule } from '../models/WeeklySchedule';
import { ScheduleEntry, DayOfWeek, ConstraintViolation } from '../models';

describe('ExportManager', () => {
  let exportManager: ExportManager;
  let sampleSchedule: WeeklySchedule;
  let sampleEntries: ScheduleEntry[];
  let sampleConflicts: ConstraintViolation[];

  beforeEach(() => {
    exportManager = new ExportManager();
    
    sampleEntries = [
      {
        batchId: 'CS-A',
        subjectId: 'Mathematics',
        facultyId: 'Dr. Smith',
        timeSlot: {
          day: DayOfWeek.MONDAY,
          startTime: '09:00',
          endTime: '10:00',
          isAvailable: true
        }
      },
      {
        batchId: 'CS-A',
        subjectId: 'Physics',
        facultyId: 'Dr. Johnson',
        timeSlot: {
          day: DayOfWeek.TUESDAY,
          startTime: '10:00',
          endTime: '11:00',
          isAvailable: true
        }
      },
      {
        batchId: 'CS-B',
        subjectId: 'Chemistry',
        facultyId: 'Dr. Brown',
        timeSlot: {
          day: DayOfWeek.WEDNESDAY,
          startTime: '11:00',
          endTime: '12:00',
          isAvailable: true
        }
      }
    ];

    sampleConflicts = [
      {
        type: 'faculty_conflict',
        message: 'Dr. Smith has overlapping lectures',
        affectedEntries: [sampleEntries[0]],
        severity: 'error'
      }
    ];

    sampleSchedule = new WeeklySchedule(sampleEntries, sampleConflicts, {
      optimizationScore: 0.85,
      generationTimeMs: 1200
    });
  });

  describe('exportSchedule', () => {
    it('should export schedule in CSV format', async () => {
      const options: ExportOptions = {
        format: ExportFormat.CSV,
        includeMetadata: true,
        includeConflicts: true,
        filename: 'test_schedule.csv'
      };

      const result = await exportManager.exportSchedule(sampleSchedule, options);

      expect(result.success).toBe(true);
      expect(result.filename).toBe('test_schedule.csv');
      expect(result.mimeType).toBe('text/csv');
      expect(result.data).toContain('Mathematics');
      expect(result.data).toContain('CS-A');
      expect(result.data).toContain('Dr. Smith');
      expect(result.metadata.format).toBe(ExportFormat.CSV);
      expect(result.metadata.entriesCount).toBe(3);
    });

    it('should export schedule in JSON format', async () => {
      const options: ExportOptions = {
        format: ExportFormat.JSON,
        includeMetadata: true,
        includeStatistics: true,
        pretty: true,
        filename: 'test_schedule.json'
      };

      const result = await exportManager.exportSchedule(sampleSchedule, options);

      expect(result.success).toBe(true);
      expect(result.filename).toBe('test_schedule.json');
      expect(result.mimeType).toBe('application/json');
      
      const jsonData = JSON.parse(result.data as string);
      expect(jsonData.metadata).toBeDefined();
      expect(jsonData.entries).toHaveLength(3);
      expect(jsonData.statistics).toBeDefined();
      expect(jsonData.summary.totalEntries).toBe(3);
    });

    it('should export schedule in HTML format', async () => {
      const options: ExportOptions = {
        format: ExportFormat.HTML,
        includeMetadata: true,
        includeConflicts: true,
        filename: 'test_schedule.html'
      };

      const result = await exportManager.exportSchedule(sampleSchedule, options);

      expect(result.success).toBe(true);
      expect(result.filename).toBe('test_schedule.html');
      expect(result.mimeType).toBe('text/html');
      expect(result.data).toContain('<!DOCTYPE html>');
      expect(result.data).toContain('Mathematics');
      expect(result.data).toContain('Weekly Timetable');
    });

    it('should export schedule in TEXT format', async () => {
      const options: ExportOptions = {
        format: ExportFormat.TEXT,
        filename: 'test_schedule.txt'
      };

      const result = await exportManager.exportSchedule(sampleSchedule, options);

      expect(result.success).toBe(true);
      expect(result.filename).toBe('test_schedule.txt');
      expect(result.mimeType).toBe('text/plain');
      expect(result.data).toContain('WEEKLY TIMETABLE');
      expect(result.data).toContain('Mathematics');
    });

    it('should export schedule in MARKDOWN format', async () => {
      const options: ExportOptions = {
        format: ExportFormat.MARKDOWN,
        filename: 'test_schedule.md'
      };

      const result = await exportManager.exportSchedule(sampleSchedule, options);

      expect(result.success).toBe(true);
      expect(result.filename).toBe('test_schedule.md');
      expect(result.mimeType).toBe('text/markdown');
      expect(result.data).toContain('# Weekly Timetable');
      expect(result.data).toContain('| Time |');
      expect(result.data).toContain('Mathematics');
    });

    it('should handle unsupported export format', async () => {
      const options: ExportOptions = {
        format: 'unsupported' as ExportFormat,
        filename: 'test_schedule.unknown'
      };

      const result = await exportManager.exportSchedule(sampleSchedule, options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported export format');
    });

    it('should apply filters correctly', async () => {
      const options: ExportOptions = {
        format: ExportFormat.JSON,
        filterBy: {
          batches: ['CS-A']
        },
        filename: 'filtered_schedule.json'
      };

      const result = await exportManager.exportSchedule(sampleSchedule, options);

      expect(result.success).toBe(true);
      const jsonData = JSON.parse(result.data as string);
      expect(jsonData.entries).toHaveLength(2); // Only CS-A entries
      expect(jsonData.entries.every((entry: any) => entry.batch.id === 'CS-A')).toBe(true);
    });

    it('should handle empty schedule', async () => {
      const emptySchedule = new WeeklySchedule();
      const options: ExportOptions = {
        format: ExportFormat.CSV,
        filename: 'empty_schedule.csv'
      };

      const result = await exportManager.exportSchedule(emptySchedule, options);

      expect(result.success).toBe(true);
      expect(result.metadata.entriesCount).toBe(0);
    });
  });

  describe('exportMultipleFormats', () => {
    it('should export schedule in multiple formats', async () => {
      const formats = [ExportFormat.CSV, ExportFormat.JSON, ExportFormat.HTML];
      const baseOptions = {
        includeMetadata: true,
        filename: 'multi_schedule'
      };

      const results = await exportManager.exportMultipleFormats(sampleSchedule, formats, baseOptions);

      expect(results.size).toBe(3);
      expect(results.has(ExportFormat.CSV)).toBe(true);
      expect(results.has(ExportFormat.JSON)).toBe(true);
      expect(results.has(ExportFormat.HTML)).toBe(true);

      const csvResult = results.get(ExportFormat.CSV)!;
      expect(csvResult.success).toBe(true);
      expect(csvResult.filename).toBe('multi_schedule.csv');

      const jsonResult = results.get(ExportFormat.JSON)!;
      expect(jsonResult.success).toBe(true);
      expect(jsonResult.filename).toBe('multi_schedule.json');

      const htmlResult = results.get(ExportFormat.HTML)!;
      expect(htmlResult.success).toBe(true);
      expect(htmlResult.filename).toBe('multi_schedule.html');
    });

    it('should handle partial failures in multiple format export', async () => {
      const formats = [ExportFormat.CSV, 'invalid' as ExportFormat];
      const baseOptions = {
        filename: 'partial_schedule'
      };

      const results = await exportManager.exportMultipleFormats(sampleSchedule, formats, baseOptions);

      expect(results.size).toBe(2);
      
      const csvResult = results.get(ExportFormat.CSV)!;
      expect(csvResult.success).toBe(true);

      const invalidResult = results.get('invalid' as ExportFormat)!;
      expect(invalidResult.success).toBe(false);
    });
  });

  describe('exportSpecializedFormat', () => {
    it('should export pivot format for CSV', async () => {
      const options: ExportOptions = {
        format: ExportFormat.CSV,
        filename: 'pivot_schedule.csv'
      };

      const result = await exportManager.exportSpecializedFormat(sampleSchedule, 'pivot', options);

      expect(result.success).toBe(true);
      expect(result.filename).toBe('pivot_schedule.csv');
      expect(result.data).toContain('Time');
      expect(result.data).toContain('Monday');
    });

    it('should export batch format for CSV', async () => {
      const options: ExportOptions = {
        format: ExportFormat.CSV,
        filename: 'batch_schedule.csv'
      };

      const result = await exportManager.exportSpecializedFormat(sampleSchedule, 'batch', options);

      expect(result.success).toBe(true);
      expect(result.filename).toBe('batch_schedule.csv');
      expect(result.data).toContain('# BATCH: CS-A');
      expect(result.data).toContain('# BATCH: CS-B');
    });

    it('should export mobile format for HTML', async () => {
      const options: ExportOptions = {
        format: ExportFormat.HTML,
        filename: 'mobile_schedule.html'
      };

      const result = await exportManager.exportSpecializedFormat(sampleSchedule, 'mobile', options);

      expect(result.success).toBe(true);
      expect(result.filename).toBe('mobile_schedule.html');
      expect(result.data).toContain('viewport');
      expect(result.data).toContain('day-section');
    });

    it('should export API format for JSON', async () => {
      const options: ExportOptions = {
        format: ExportFormat.JSON,
        filename: 'api_schedule.json'
      };

      const result = await exportManager.exportSpecializedFormat(sampleSchedule, 'api', options);

      expect(result.success).toBe(true);
      expect(result.filename).toBe('api_schedule.json');
      
      const jsonData = JSON.parse(result.data as string);
      expect(jsonData.success).toBe(true);
      expect(jsonData.data.schedule).toBeDefined();
      expect(jsonData.meta).toBeDefined();
    });

    it('should handle invalid specialized format combinations', async () => {
      const options: ExportOptions = {
        format: ExportFormat.JSON,
        filename: 'invalid.json'
      };

      const result = await exportManager.exportSpecializedFormat(sampleSchedule, 'pivot', options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Pivot format only supported for CSV export');
    });
  });

  describe('compareAndExport', () => {
    it('should compare schedules and export comparison', async () => {
      const scheduleB = new WeeklySchedule([
        {
          ...sampleEntries[0],
          facultyId: 'Dr. Wilson' // Changed faculty
        },
        ...sampleEntries.slice(1)
      ]);

      const comparisonOptions = {
        scheduleA: sampleSchedule,
        scheduleB: scheduleB,
        labelA: 'Original Schedule',
        labelB: 'Modified Schedule'
      };

      const exportOptions: ExportOptions = {
        format: ExportFormat.JSON,
        filename: 'comparison.json'
      };

      const result = await exportManager.compareAndExport(comparisonOptions, exportOptions);

      expect(result.comparison).toBeDefined();
      expect(result.export.success).toBe(true);
      expect(result.comparison.summary.totalDifferences).toBeGreaterThan(0);
      expect(result.comparison.differences.modifiedEntries).toHaveLength(1);
    });
  });

  describe('getExportStatistics', () => {
    it('should provide export statistics', () => {
      const stats = exportManager.getExportStatistics(sampleSchedule);

      expect(stats.totalEntries).toBe(3);
      expect(stats.estimatedSizes).toBeInstanceOf(Map);
      expect(stats.recommendedFormats).toContain(ExportFormat.HTML);
      expect(stats.recommendedFormats).toContain(ExportFormat.JSON);
      expect(stats.warnings).toContain('Conflicts detected. HTML format provides better conflict visualization.');
    });

    it('should recommend CSV for large schedules', () => {
      const largeEntries: ScheduleEntry[] = [];
      for (let i = 0; i < 300; i++) {
        largeEntries.push({
          batchId: `Batch-${i % 10}`,
          subjectId: `Subject-${i % 20}`,
          facultyId: `Faculty-${i % 15}`,
          timeSlot: {
            day: Object.values(DayOfWeek)[i % 5],
            startTime: `${(9 + (i % 8)).toString().padStart(2, '0')}:00`,
            endTime: `${(10 + (i % 8)).toString().padStart(2, '0')}:00`,
            isAvailable: true
          }
        });
      }

      const largeSchedule = new WeeklySchedule(largeEntries);
      const stats = exportManager.getExportStatistics(largeSchedule);

      expect(stats.totalEntries).toBe(300);
      expect(stats.recommendedFormats).toContain(ExportFormat.CSV);
      expect(stats.warnings).toContain('Large schedule detected. CSV format recommended for better performance.');
    });
  });

  describe('validateExportOptions', () => {
    it('should validate correct export options', () => {
      const options: ExportOptions = {
        format: ExportFormat.CSV,
        delimiter: ',',
        includeHeaders: true,
        filename: 'valid_schedule.csv'
      };

      const validation = exportManager.validateExportOptions(options);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing format', () => {
      const options = {
        filename: 'schedule.csv'
      } as ExportOptions;

      const validation = exportManager.validateExportOptions(options);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Export format is required');
    });

    it('should validate CSV delimiter', () => {
      const options: ExportOptions = {
        format: ExportFormat.CSV,
        delimiter: ',,', // Invalid: multiple characters
        filename: 'schedule.csv'
      };

      const validation = exportManager.validateExportOptions(options);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('CSV delimiter must be a single character');
    });

    it('should validate time range format', () => {
      const options: ExportOptions = {
        format: ExportFormat.JSON,
        filterBy: {
          timeRange: {
            start: '9:00', // Invalid format
            end: '17:00'
          }
        },
        filename: 'schedule.json'
      };

      const validation = exportManager.validateExportOptions(options);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Time range must use HH:MM format');
    });
  });

  describe('getSupportedFormats', () => {
    it('should return all supported formats with details', () => {
      const formats = exportManager.getSupportedFormats();

      expect(formats).toHaveLength(5);
      
      const csvFormat = formats.find(f => f.format === ExportFormat.CSV);
      expect(csvFormat).toBeDefined();
      expect(csvFormat!.name).toBe('CSV (Comma Separated Values)');
      expect(csvFormat!.mimeType).toBe('text/csv');
      expect(csvFormat!.features).toContain('Pivot tables');

      const jsonFormat = formats.find(f => f.format === ExportFormat.JSON);
      expect(jsonFormat).toBeDefined();
      expect(jsonFormat!.features).toContain('Full metadata');

      const htmlFormat = formats.find(f => f.format === ExportFormat.HTML);
      expect(htmlFormat).toBeDefined();
      expect(htmlFormat!.features).toContain('Print-ready');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle export errors gracefully', async () => {
      // Mock an error by using invalid options
      const options: ExportOptions = {
        format: ExportFormat.CSV,
        encoding: 'invalid-encoding' as any,
        filename: 'error_schedule.csv'
      };

      const result = await exportManager.exportSchedule(sampleSchedule, options);

      // Should still return a result object even if export fails
      expect(result).toBeDefined();
      expect(result.filename).toBe('error_schedule.csv');
      expect(result.metadata).toBeDefined();
    });

    it('should handle very large schedules efficiently', async () => {
      const largeEntries: ScheduleEntry[] = [];
      for (let i = 0; i < 1000; i++) {
        largeEntries.push({
          batchId: `Batch-${i % 50}`,
          subjectId: `Subject-${i % 100}`,
          facultyId: `Faculty-${i % 30}`,
          timeSlot: {
            day: Object.values(DayOfWeek)[i % 5],
            startTime: `${(8 + (i % 10)).toString().padStart(2, '0')}:00`,
            endTime: `${(9 + (i % 10)).toString().padStart(2, '0')}:00`,
            isAvailable: true
          }
        });
      }

      const largeSchedule = new WeeklySchedule(largeEntries);
      const options: ExportOptions = {
        format: ExportFormat.CSV,
        filename: 'large_schedule.csv'
      };

      const startTime = Date.now();
      const result = await exportManager.exportSchedule(largeSchedule, options);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.metadata.entriesCount).toBe(1000);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle special characters in data', async () => {
      const specialCharEntries: ScheduleEntry[] = [{
        batchId: 'CS-A & B',
        subjectId: 'Math "Advanced"',
        facultyId: 'Dr. O\'Connor',
        timeSlot: {
          day: DayOfWeek.MONDAY,
          startTime: '09:00',
          endTime: '10:00',
          isAvailable: true
        }
      }];

      const specialCharSchedule = new WeeklySchedule(specialCharEntries);
      const options: ExportOptions = {
        format: ExportFormat.CSV,
        filename: 'special_chars.csv'
      };

      const result = await exportManager.exportSchedule(specialCharSchedule, options);

      expect(result.success).toBe(true);
      expect(result.data).toContain('CS-A & B');
      expect(result.data).toContain('Math "Advanced"');
      expect(result.data).toContain('Dr. O\'Connor');
    });
  });
});
