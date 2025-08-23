import { 
  TabularScheduleFormatter, 
  CompactScheduleFormatter, 
  DetailedScheduleFormatter 
} from '../formatters/ScheduleFormatter';
import { WeeklySchedule } from '../models/WeeklySchedule';
import { ScheduleEntry, DayOfWeek, ConstraintViolation } from '../models';

describe('ScheduleFormatters', () => {
  let sampleSchedule: WeeklySchedule;
  let sampleEntries: ScheduleEntry[];
  let sampleConflicts: ConstraintViolation[];

  beforeEach(() => {
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
      },
      {
        batchId: 'CS-A',
        subjectId: 'English',
        facultyId: 'Dr. Davis',
        timeSlot: {
          day: DayOfWeek.MONDAY,
          startTime: '14:00',
          endTime: '15:00',
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
      },
      {
        type: 'batch_overload',
        message: 'CS-A has too many lectures on Monday',
        affectedEntries: [sampleEntries[0], sampleEntries[3]],
        severity: 'warning'
      }
    ];

    sampleSchedule = new WeeklySchedule(sampleEntries, sampleConflicts, {
      optimizationScore: 0.85,
      generationTimeMs: 1200
    });
  });

  describe('TabularScheduleFormatter', () => {
    let formatter: TabularScheduleFormatter;

    beforeEach(() => {
      formatter = new TabularScheduleFormatter();
    });

    it('should format schedule in tabular format', () => {
      const result = formatter.format(sampleSchedule);

      expect(result).toContain('Time');
      expect(result).toContain('Monday');
      expect(result).toContain('Tuesday');
      expect(result).toContain('Wednesday');
      expect(result).toContain('Thursday');
      expect(result).toContain('Friday');
      expect(result).toContain('Mathematics');
      expect(result).toContain('Physics');
      expect(result).toContain('Chemistry');
    });

    it('should include metadata when option is enabled', () => {
      const formatterWithMetadata = new TabularScheduleFormatter({
        includeMetadata: true
      });

      const result = formatterWithMetadata.format(sampleSchedule);

      expect(result).toContain('Schedule Metadata');
      expect(result).toContain('Generated:');
      expect(result).toContain('Total Lectures: 4');
      expect(result).toContain('Batch Count: 2');
      expect(result).toContain('Optimization Score: 85.0%');
    });

    it('should include conflicts when option is enabled', () => {
      const formatterWithConflicts = new TabularScheduleFormatter({
        includeConflicts: true
      });

      const result = formatterWithConflicts.format(sampleSchedule);

      expect(result).toContain('Conflicts:');
      expect(result).toContain('faculty_conflict');
      expect(result).toContain('batch_overload');
    });

    it('should include statistics when option is enabled', () => {
      const formatterWithStats = new TabularScheduleFormatter({
        includeStatistics: true
      });

      const result = formatterWithStats.format(sampleSchedule);

      expect(result).toContain('Schedule Statistics');
      expect(result).toContain('Total Entries: 4');
      expect(result).toContain('Entries per Day:');
    });

    it('should format time in 12-hour format when specified', () => {
      const formatter12h = new TabularScheduleFormatter({
        timeFormat: '12h'
      });

      const result = formatter12h.format(sampleSchedule);

      expect(result).toContain('9:00 AM');
      expect(result).toContain('2:00 PM');
    });

    it('should highlight conflicts when option is enabled', () => {
      const formatterWithHighlight = new TabularScheduleFormatter({
        highlightConflicts: true
      });

      const result = formatterWithHighlight.format(sampleSchedule);

      expect(result).toContain('⚠️');
    });

    it('should show empty slots when option is enabled', () => {
      const formatterWithEmpty = new TabularScheduleFormatter({
        showEmptySlots: true
      });

      const result = formatterWithEmpty.format(sampleSchedule);

      expect(result).toContain('-');
    });

    it('should format batch view correctly', () => {
      const result = formatter.formatBatchView(sampleSchedule, 'CS-A');

      expect(result).toContain('Schedule for Batch: CS-A');
      expect(result).toContain('Mathematics');
      expect(result).toContain('Physics');
      expect(result).toContain('English');
      expect(result).not.toContain('Chemistry'); // This is for CS-B
    });

    it('should format faculty view correctly', () => {
      const result = formatter.formatFacultyView(sampleSchedule, 'Dr. Smith');

      expect(result).toContain('Schedule for Faculty: Dr. Smith');
      expect(result).toContain('Mathematics');
      expect(result).not.toContain('Physics'); // This is taught by Dr. Johnson
    });

    it('should handle empty schedule gracefully', () => {
      const emptySchedule = new WeeklySchedule();
      const result = formatter.format(emptySchedule);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle non-existent batch in batch view', () => {
      const result = formatter.formatBatchView(sampleSchedule, 'NonExistent');

      expect(result).toContain('No entries found for batch: NonExistent');
    });

    it('should handle non-existent faculty in faculty view', () => {
      const result = formatter.formatFacultyView(sampleSchedule, 'NonExistent');

      expect(result).toContain('No entries found for faculty: NonExistent');
    });
  });

  describe('CompactScheduleFormatter', () => {
    let formatter: CompactScheduleFormatter;

    beforeEach(() => {
      formatter = new CompactScheduleFormatter();
    });

    it('should format schedule in compact format', () => {
      const result = formatter.format(sampleSchedule);

      expect(result).toContain('Monday: 2 lectures');
      expect(result).toContain('Tuesday: 1 lectures');
      expect(result).toContain('Wednesday: 1 lectures');
      expect(result).toContain('09:00(Mathematics)');
      expect(result).toContain('14:00(English)');
    });

    it('should include conflicts when option is enabled', () => {
      const formatterWithConflicts = new CompactScheduleFormatter({
        includeConflicts: true
      });

      const result = formatterWithConflicts.format(sampleSchedule);

      expect(result).toContain('Conflicts: 2');
    });

    it('should handle empty schedule', () => {
      const emptySchedule = new WeeklySchedule();
      const result = formatter.format(emptySchedule);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should format time in 12-hour format when specified', () => {
      const formatter12h = new CompactScheduleFormatter({
        timeFormat: '12h'
      });

      const result = formatter12h.format(sampleSchedule);

      expect(result).toContain('9:00 AM(Mathematics)');
      expect(result).toContain('2:00 PM(English)');
    });
  });

  describe('DetailedScheduleFormatter', () => {
    let formatter: DetailedScheduleFormatter;

    beforeEach(() => {
      formatter = new DetailedScheduleFormatter();
    });

    it('should format schedule in detailed format', () => {
      const result = formatter.format(sampleSchedule);

      expect(result).toContain('DETAILED TIMETABLE SCHEDULE');
      expect(result).toContain('WEEKLY SCHEDULE:');
      expect(result).toContain('MONDAY (2 lectures):');
      expect(result).toContain('📖 Mathematics | 🎓 CS-A | 👨‍🏫 Dr. Smith');
      expect(result).toContain('📖 English | 🎓 CS-A | 👨‍🏫 Dr. Davis');
    });

    it('should include detailed metadata when option is enabled', () => {
      const formatterWithMetadata = new DetailedScheduleFormatter({
        includeMetadata: true
      });

      const result = formatterWithMetadata.format(sampleSchedule);

      expect(result).toContain('SCHEDULE OVERVIEW:');
      expect(result).toContain('📅 Generated:');
      expect(result).toContain('📚 Total Lectures: 4');
      expect(result).toContain('🎓 Batches: 2');
      expect(result).toContain('👨‍🏫 Faculty Members: 4');
      expect(result).toContain('📖 Subjects: 4');
      expect(result).toContain('📊 Optimization Score: 85.0%');
    });

    it('should include detailed conflicts when option is enabled', () => {
      const formatterWithConflicts = new DetailedScheduleFormatter({
        includeConflicts: true
      });

      const result = formatterWithConflicts.format(sampleSchedule);

      expect(result).toContain('CONFLICT ANALYSIS:');
      expect(result).toContain('🚨 CRITICAL ERRORS (1):');
      expect(result).toContain('⚠️ WARNINGS (1):');
      expect(result).toContain('faculty_conflict');
      expect(result).toContain('batch_overload');
    });

    it('should include detailed statistics when option is enabled', () => {
      const formatterWithStats = new DetailedScheduleFormatter({
        includeStatistics: true
      });

      const result = formatterWithStats.format(sampleSchedule);

      expect(result).toContain('DETAILED STATISTICS:');
      expect(result).toContain('📊 Daily Distribution:');
      expect(result).toContain('🎓 Batch Distribution:');
      expect(result).toContain('👨‍🏫 Faculty Workload:');
      expect(result).toContain('⏰ Time Slot Utilization:');
      expect(result).toContain('📈 Load Distribution:');
    });

    it('should show no conflicts message when schedule is clean', () => {
      const cleanSchedule = new WeeklySchedule(sampleEntries, []);
      const formatterWithConflicts = new DetailedScheduleFormatter({
        includeConflicts: true
      });

      const result = formatterWithConflicts.format(cleanSchedule);

      expect(result).toContain('✅ No conflicts detected');
    });

    it('should handle empty days gracefully', () => {
      const result = formatter.format(sampleSchedule);

      expect(result).toContain('THURSDAY (0 lectures):');
      expect(result).toContain('No lectures scheduled');
      expect(result).toContain('FRIDAY (0 lectures):');
    });

    it('should format time in 12-hour format when specified', () => {
      const formatter12h = new DetailedScheduleFormatter({
        timeFormat: '12h'
      });

      const result = formatter12h.format(sampleSchedule);

      expect(result).toContain('9:00 AM - 10:00 AM');
      expect(result).toContain('2:00 PM - 3:00 PM');
    });
  });

  describe('formatter options', () => {
    it('should respect compactView option', () => {
      const compactFormatter = new TabularScheduleFormatter({
        compactView: true
      });

      const result = compactFormatter.format(sampleSchedule);

      // In compact view, faculty names should be omitted from the table cells
      expect(result).toBeDefined();
    });

    it('should handle all options together', () => {
      const fullFormatter = new DetailedScheduleFormatter({
        includeConflicts: true,
        includeStatistics: true,
        includeMetadata: true,
        timeFormat: '12h',
        showEmptySlots: true,
        highlightConflicts: true,
        compactView: false
      });

      const result = fullFormatter.format(sampleSchedule);

      expect(result).toContain('DETAILED TIMETABLE SCHEDULE');
      expect(result).toContain('SCHEDULE OVERVIEW:');
      expect(result).toContain('CONFLICT ANALYSIS:');
      expect(result).toContain('DETAILED STATISTICS:');
      expect(result).toContain('9:00 AM');
    });
  });

  describe('edge cases', () => {
    it('should handle schedule with only one entry', () => {
      const singleEntrySchedule = new WeeklySchedule([sampleEntries[0]]);
      const formatter = new TabularScheduleFormatter();

      const result = formatter.format(singleEntrySchedule);

      expect(result).toContain('Mathematics');
      expect(result).toBeDefined();
    });

    it('should handle schedule with conflicts but no entries', () => {
      const conflictOnlySchedule = new WeeklySchedule([], sampleConflicts);
      const formatter = new DetailedScheduleFormatter({
        includeConflicts: true
      });

      const result = formatter.format(conflictOnlySchedule);

      expect(result).toContain('CONFLICT ANALYSIS:');
      expect(result).toBeDefined();
    });

    it('should handle very long subject and faculty names', () => {
      const longNameEntries = [{
        ...sampleEntries[0],
        subjectId: 'Very Long Subject Name That Might Break Formatting',
        facultyId: 'Dr. Very Long Faculty Name That Might Also Break Formatting'
      }];

      const longNameSchedule = new WeeklySchedule(longNameEntries);
      const formatter = new TabularScheduleFormatter();

      const result = formatter.format(longNameSchedule);

      expect(result).toBeDefined();
      expect(result).toContain('Very Long Subject Name');
    });

    it('should handle special characters in names', () => {
      const specialCharEntries = [{
        ...sampleEntries[0],
        subjectId: 'Math & Physics (Advanced)',
        facultyId: 'Dr. O\'Connor-Smith'
      }];

      const specialCharSchedule = new WeeklySchedule(specialCharEntries);
      const formatter = new TabularScheduleFormatter();

      const result = formatter.format(specialCharSchedule);

      expect(result).toBeDefined();
      expect(result).toContain('Math & Physics');
      expect(result).toContain('O\'Connor-Smith');
    });

    it('should handle large schedules efficiently', () => {
      const largeEntries: ScheduleEntry[] = [];
      for (let i = 0; i < 100; i++) {
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
      const formatter = new TabularScheduleFormatter();

      const startTime = Date.now();
      const result = formatter.format(largeSchedule);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });
});
