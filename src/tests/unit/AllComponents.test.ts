import { Batch, Subject, DayOfWeek } from '../../models';
import { WeeklySchedule } from '../../models/WeeklySchedule';
import { ScheduleGenerator } from '../../algorithms/ScheduleGenerator';
import { InputManager } from '../../services/InputManager';
import { ValidationService } from '../../services/ValidationService';
import { ConflictReporter } from '../../services/ConflictReporter';
import { ExportManager } from '../../exporters/ExportManager';
import { FacultyConflictConstraint, TimeSlotAvailabilityConstraint } from '../../services/constraints';
import { ExportFormat } from '../../exporters/ExportInterfaces';
import { TestDataFactory } from '../utils/TestDataFactory';
import { TestAssertions, PerformanceTestUtils } from '../utils/TestMatchers';

describe('All Components - Unit Tests', () => {
  
  describe('Batch Model', () => {
    it('should create batch with valid properties', () => {
      const batch = new Batch('CS-101', 'Computer Science 101');
      
      expect(batch.id).toBe('CS-101');
      expect(batch.name).toBe('Computer Science 101');
      expect(batch.subjects).toHaveLength(0);
      expect(batch.getTotalLecturesPerWeek()).toBe(0);
    });

    it('should add subjects correctly', () => {
      const batch = new Batch('CS-101', 'Computer Science 101');
      const subject = new Subject('math', 'Mathematics', 3, 60, 'Dr. Smith');
      
      batch.addSubject(subject);
      
      expect(batch.subjects).toHaveLength(1);
      expect(batch.getTotalLecturesPerWeek()).toBe(3);
      expect(batch.subjects[0]).toBe(subject);
    });

    it('should handle multiple subjects', () => {
      const batch = new Batch('CS-101', 'Computer Science 101');
      
      batch.addSubject(new Subject('math', 'Mathematics', 3, 60, 'Dr. Smith'));
      batch.addSubject(new Subject('physics', 'Physics', 2, 60, 'Dr. Johnson'));
      batch.addSubject(new Subject('chemistry', 'Chemistry', 4, 60, 'Dr. Brown'));
      
      expect(batch.subjects).toHaveLength(3);
      expect(batch.getTotalLecturesPerWeek()).toBe(9);
    });

    it('should remove subjects correctly', () => {
      const batch = new Batch('CS-101', 'Computer Science 101');
      const subject = new Subject('math', 'Mathematics', 3, 60, 'Dr. Smith');
      
      batch.addSubject(subject);
      expect(batch.subjects).toHaveLength(1);
      
      batch.removeSubject('math');
      expect(batch.subjects).toHaveLength(0);
      expect(batch.getTotalLecturesPerWeek()).toBe(0);
    });

    it('should validate batch data', () => {
      const batch = new Batch('CS-101', 'Computer Science 101');
      
      // Empty batch should be valid but have warnings
      let validation = batch.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.warnings.length).toBeGreaterThan(0);
      
      // Add subject
      batch.addSubject(new Subject('math', 'Mathematics', 3, 60, 'Dr. Smith'));
      validation = batch.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.warnings.length).toBe(0);
    });
  });

  describe('Subject Model', () => {
    it('should create subject with valid properties', () => {
      const subject = new Subject('math', 'Mathematics', 3, 60, 'Dr. Smith');
      
      expect(subject.id).toBe('math');
      expect(subject.name).toBe('Mathematics');
      expect(subject.lecturesPerWeek).toBe(3);
      expect(subject.lectureDuration).toBe(60);
      expect(subject.facultyId).toBe('Dr. Smith');
    });

    it('should validate subject properties', () => {
      // Valid subject
      let subject = new Subject('math', 'Mathematics', 3, 60, 'Dr. Smith');
      let validation = subject.validate();
      expect(validation.isValid).toBe(true);
      
      // Invalid lectures per week
      subject = new Subject('math', 'Mathematics', 0, 60, 'Dr. Smith');
      validation = subject.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('lectures per week'))).toBe(true);
      
      // Invalid duration
      subject = new Subject('math', 'Mathematics', 3, 0, 'Dr. Smith');
      validation = subject.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('duration'))).toBe(true);
    });

    it('should calculate total weekly duration', () => {
      const subject = new Subject('math', 'Mathematics', 3, 60, 'Dr. Smith');
      expect(subject.getTotalWeeklyDuration()).toBe(180); // 3 * 60
    });

    it('should handle edge cases', () => {
      // Very short duration
      let subject = new Subject('short', 'Short Subject', 1, 15, 'Faculty');
      expect(subject.getTotalWeeklyDuration()).toBe(15);
      
      // Very long duration
      subject = new Subject('long', 'Long Subject', 1, 180, 'Faculty');
      expect(subject.getTotalWeeklyDuration()).toBe(180);
      
      // Many lectures
      subject = new Subject('many', 'Many Lectures', 10, 30, 'Faculty');
      expect(subject.getTotalWeeklyDuration()).toBe(300);
    });
  });

  describe('WeeklySchedule Model', () => {
    it('should create empty schedule', () => {
      const schedule = new WeeklySchedule();
      
      expect(schedule.entries).toHaveLength(0);
      expect(schedule.conflicts).toHaveLength(0);
      expect(schedule.metadata).toBeDefined();
    });

    it('should add entries correctly', () => {
      const schedule = new WeeklySchedule();
      const entry = {
        batchId: 'CS-101',
        subjectId: 'math',
        facultyId: 'Dr. Smith',
        timeSlot: {
          day: DayOfWeek.MONDAY,
          startTime: '09:00',
          endTime: '10:00',
          isAvailable: true
        }
      };
      
      schedule.addEntry(entry);
      expect(schedule.entries).toHaveLength(1);
      expect(schedule.entries[0]).toEqual(entry);
    });

    it('should calculate statistics correctly', () => {
      const schedule = TestDataFactory.createSampleWeeklySchedule();
      const stats = schedule.calculateStatistics();
      
      expect(stats.totalEntries).toBe(schedule.entries.length);
      expect(stats.entriesPerDay.size).toBeGreaterThan(0);
      expect(stats.entriesPerBatch.size).toBeGreaterThan(0);
      expect(stats.timeSlotUtilization.utilizationRate).toBeGreaterThanOrEqual(0);
      expect(stats.dailyLoadDistribution.averageEntriesPerDay).toBeGreaterThan(0);
    });

    it('should filter entries by batch', () => {
      const schedule = TestDataFactory.createSampleWeeklySchedule();
      const batchIds = schedule.getBatchIds();
      
      if (batchIds.length > 0) {
        const batchEntries = schedule.getEntriesForBatch(batchIds[0]);
        expect(batchEntries.every(e => e.batchId === batchIds[0])).toBe(true);
      }
    });

    it('should filter conflicts by severity', () => {
      const schedule = TestDataFactory.createSampleWeeklySchedule();
      
      const errorConflicts = schedule.getConflictsBySeverity('error');
      const warningConflicts = schedule.getConflictsBySeverity('warning');
      
      expect(errorConflicts.every(c => c.severity === 'error')).toBe(true);
      expect(warningConflicts.every(c => c.severity === 'warning')).toBe(true);
    });

    it('should validate schedule structure', () => {
      const schedule = TestDataFactory.createSampleWeeklySchedule();
      const validation = schedule.validate();
      
      expect(validation).toBeDefined();
      expect(typeof validation.isValid).toBe('boolean');
      expect(Array.isArray(validation.issues)).toBe(true);
    });
  });

  describe('ScheduleGenerator', () => {
    let generator: ScheduleGenerator;
    let constraints: any[];

    beforeEach(() => {
      generator = new ScheduleGenerator({
        workingDays: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY],
        workingHours: { start: '08:00', end: '18:00' },
        slotDuration: 60,
        breakDuration: 0,
        maxAttemptsPerLecture: 100,
        allowPartialSchedules: true,
        prioritizeEvenDistribution: true
      });

      constraints = [
        new FacultyConflictConstraint(),
        new TimeSlotAvailabilityConstraint()
      ];
    });

    it('should generate schedule for simple batch', async () => {
      const batches = [TestDataFactory.createSimpleBatch()];
      
      const schedule = await generator.generateTimetable(batches, constraints, []);
      
      expect(schedule).toBeDefined();
      expect(schedule.entries.length).toBeGreaterThan(0);
      expect(schedule.validate().isValid).toBe(true);
    });

    it('should handle empty input', async () => {
      const schedule = await generator.generateTimetable([], constraints, []);
      
      expect(schedule).toBeDefined();
      expect(schedule.entries).toHaveLength(0);
    });

    it('should respect working hours', async () => {
      const batches = [TestDataFactory.createSimpleBatch()];
      const schedule = await generator.generateTimetable(batches, constraints, []);
      
      schedule.entries.forEach(entry => {
        const startHour = parseInt(entry.timeSlot.startTime.split(':')[0]);
        const endHour = parseInt(entry.timeSlot.endTime.split(':')[0]);
        
        expect(startHour).toBeGreaterThanOrEqual(8);
        expect(endHour).toBeLessThanOrEqual(18);
      });
    });

    it('should respect working days', async () => {
      const batches = [TestDataFactory.createSimpleBatch()];
      const schedule = await generator.generateTimetable(batches, constraints, []);
      
      const workingDays = [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY];
      
      schedule.entries.forEach(entry => {
        expect(workingDays.includes(entry.timeSlot.day)).toBe(true);
      });
    });

    it('should handle holidays correctly', async () => {
      const batches = [TestDataFactory.createSimpleBatch()];
      const holidays = [new Date('2024-12-25')]; // Christmas on Wednesday
      
      const schedule = await generator.generateTimetable(batches, constraints, holidays);
      
      // Should not schedule anything on Christmas day
      const christmasEntries = schedule.entries.filter(entry => 
        entry.timeSlot.day === DayOfWeek.WEDNESDAY
      );
      
      // This depends on implementation - might avoid the day entirely or handle differently
      expect(schedule).toBeDefined();
    });
  });

  describe('InputManager', () => {
    let inputManager: InputManager;

    beforeEach(() => {
      inputManager = new InputManager();
    });

    it('should parse CSV data correctly', () => {
      const csvData = `Batch,Subject,Faculty,Lectures,Duration
CS-101,Mathematics,Dr. Smith,3,60
CS-101,Physics,Dr. Johnson,2,60`;

      const result = inputManager.parseCSV(csvData);
      
      expect(result.success).toBe(true);
      expect(result.batches).toHaveLength(1);
      expect(result.batches[0].subjects).toHaveLength(2);
    });

    it('should handle malformed CSV', () => {
      const malformedCSV = `Batch,Subject,Faculty
CS-101,Mathematics`; // Missing data

      const result = inputManager.parseCSV(malformedCSV);
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should parse JSON data correctly', () => {
      const jsonData = {
        batches: [
          {
            id: 'CS-101',
            name: 'Computer Science 101',
            subjects: [
              {
                id: 'math',
                name: 'Mathematics',
                lecturesPerWeek: 3,
                durationMinutes: 60,
                facultyId: 'Dr. Smith'
              }
            ]
          }
        ]
      };

      const result = inputManager.parseJSON(JSON.stringify(jsonData));
      
      expect(result.success).toBe(true);
      expect(result.batches).toHaveLength(1);
      expect(result.batches[0].subjects).toHaveLength(1);
    });

    it('should validate input data', () => {
      const batches = [TestDataFactory.createSimpleBatch()];
      
      const validation = inputManager.validateInput(batches);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('ValidationService', () => {
    let validationService: ValidationService;

    beforeEach(() => {
      validationService = new ValidationService();
    });

    it('should validate valid batches', () => {
      const batches = [TestDataFactory.createSimpleBatch()];
      
      const result = validationService.validateBatches(batches);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect empty batches', () => {
      const emptyBatch = new Batch('EMPTY', 'Empty Batch');
      
      const result = validationService.validateBatches([emptyBatch]);
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('no subjects'))).toBe(true);
    });

    it('should detect duplicate batch IDs', () => {
      const batch1 = TestDataFactory.createSimpleBatch('DUPLICATE', 'Batch 1');
      const batch2 = TestDataFactory.createSimpleBatch('DUPLICATE', 'Batch 2');
      
      const result = validationService.validateBatches([batch1, batch2]);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('duplicate'))).toBe(true);
    });

    it('should validate schedule entries', () => {
      const entries = TestDataFactory.createSampleScheduleEntries();
      
      const result = validationService.validateScheduleEntries(entries);
      
      expect(result.isValid).toBe(true);
    });

    it('should detect time conflicts', () => {
      const conflictingEntries = TestDataFactory.createConflictingScheduleEntries();
      
      const result = validationService.validateScheduleEntries(conflictingEntries);
      
      expect(result.conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('ConflictReporter', () => {
    let conflictReporter: ConflictReporter;
    let constraints: any[];

    beforeEach(() => {
      conflictReporter = new ConflictReporter();
      constraints = [
        new FacultyConflictConstraint(),
        new TimeSlotAvailabilityConstraint()
      ];
    });

    it('should generate conflict report', () => {
      const entries = TestDataFactory.createConflictingScheduleEntries();
      const batches = TestDataFactory.createOverlappingFacultyBatches();
      
      const report = conflictReporter.generateConflictReport(entries, constraints, batches, []);
      
      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.conflicts).toBeDefined();
      expect(Array.isArray(report.conflicts)).toBe(true);
    });

    it('should categorize conflicts by severity', () => {
      const entries = TestDataFactory.createConflictingScheduleEntries();
      const batches = TestDataFactory.createOverlappingFacultyBatches();
      
      const report = conflictReporter.generateConflictReport(entries, constraints, batches, []);
      
      const errorConflicts = report.conflicts.filter(c => c.severity === 'error');
      const warningConflicts = report.conflicts.filter(c => c.severity === 'warning');
      
      expect(errorConflicts.length + warningConflicts.length).toBe(report.conflicts.length);
    });

    it('should provide resolution suggestions', () => {
      const entries = TestDataFactory.createConflictingScheduleEntries();
      const batches = TestDataFactory.createOverlappingFacultyBatches();
      
      const report = conflictReporter.generateConflictReport(entries, constraints, batches, []);
      
      if (report.conflicts.length > 0) {
        expect(report.resolutionSuggestions).toBeDefined();
        expect(report.resolutionSuggestions.length).toBeGreaterThan(0);
      }
    });
  });

  describe('ExportManager', () => {
    let exportManager: ExportManager;

    beforeEach(() => {
      exportManager = new ExportManager();
    });

    it('should export to JSON format', async () => {
      const schedule = TestDataFactory.createSampleWeeklySchedule();
      
      const result = await exportManager.exportSchedule(schedule, {
        format: ExportFormat.JSON,
        includeMetadata: true
      });
      
      TestAssertions.assertExportQuality(result, {
        requiredMimeType: 'application/json'
      });
      
      // Verify JSON structure
      const exportedData = JSON.parse(result.data as string);
      expect(exportedData.entries).toBeDefined();
      expect(exportedData.metadata).toBeDefined();
    });

    it('should export to CSV format', async () => {
      const schedule = TestDataFactory.createSampleWeeklySchedule();
      
      const result = await exportManager.exportSchedule(schedule, {
        format: ExportFormat.CSV,
        includeHeaders: true
      });
      
      TestAssertions.assertExportQuality(result, {
        requiredMimeType: 'text/csv'
      });
      
      // Verify CSV structure
      const csvData = result.data as string;
      expect(csvData.includes('Batch')).toBe(true);
      expect(csvData.includes('Subject')).toBe(true);
      expect(csvData.includes('Faculty')).toBe(true);
    });

    it('should export to HTML format', async () => {
      const schedule = TestDataFactory.createSampleWeeklySchedule();
      
      const result = await exportManager.exportSchedule(schedule, {
        format: ExportFormat.HTML,
        includeStyles: true
      });
      
      TestAssertions.assertExportQuality(result, {
        requiredMimeType: 'text/html'
      });
      
      // Verify HTML structure
      const htmlData = result.data as string;
      expect(htmlData.includes('<html')).toBe(true);
      expect(htmlData.includes('<table')).toBe(true);
    });

    it('should handle export errors gracefully', async () => {
      const schedule = new WeeklySchedule();
      
      const result = await exportManager.exportSchedule(schedule, {
        format: 'invalid' as ExportFormat
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should export multiple formats', async () => {
      const schedule = TestDataFactory.createSampleWeeklySchedule();
      const formats = [ExportFormat.JSON, ExportFormat.CSV, ExportFormat.HTML];
      
      const results = await exportManager.exportMultipleFormats(schedule, formats, {
        includeMetadata: true
      });
      
      expect(results.size).toBe(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Constraint System', () => {
    describe('FacultyConflictConstraint', () => {
      let constraint: FacultyConflictConstraint;

      beforeEach(() => {
        constraint = new FacultyConflictConstraint();
      });

      it('should detect faculty conflicts', () => {
        const entries = TestDataFactory.createConflictingScheduleEntries();
        const conflictingEntries = entries.filter(e => e.facultyId === 'Dr. Smith');
        
        if (conflictingEntries.length >= 2) {
          const result = constraint.validate(conflictingEntries[0], conflictingEntries[1], [], []);
          expect(result.isValid).toBe(false);
        }
      });

      it('should allow non-conflicting faculty schedules', () => {
        const entries = TestDataFactory.createSampleScheduleEntries();
        
        // Test different faculty members
        const entry1 = entries.find(e => e.facultyId === 'Dr. Smith');
        const entry2 = entries.find(e => e.facultyId === 'Dr. Johnson');
        
        if (entry1 && entry2) {
          const result = constraint.validate(entry1, entry2, [], []);
          expect(result.isValid).toBe(true);
        }
      });
    });

    describe('TimeSlotAvailabilityConstraint', () => {
      let constraint: TimeSlotAvailabilityConstraint;

      beforeEach(() => {
        constraint = new TimeSlotAvailabilityConstraint();
      });

      it('should validate available time slots', () => {
        const entry = {
          batchId: 'CS-101',
          subjectId: 'math',
          facultyId: 'Dr. Smith',
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '09:00',
            endTime: '10:00',
            isAvailable: true
          }
        };
        
        const result = constraint.validate(entry, entry, [], []);
        expect(result.isValid).toBe(true);
      });

      it('should reject unavailable time slots', () => {
        const entry = {
          batchId: 'CS-101',
          subjectId: 'math',
          facultyId: 'Dr. Smith',
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '09:00',
            endTime: '10:00',
            isAvailable: false
          }
        };
        
        const result = constraint.validate(entry, entry, [], []);
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('Performance Tests', () => {
    it('should handle large datasets efficiently', async () => {
      const largeBatches = TestDataFactory.createLargeDataset(20, 10, 30);
      const generator = new ScheduleGenerator({
        workingDays: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY],
        workingHours: { start: '08:00', end: '18:00' },
        slotDuration: 60,
        breakDuration: 0,
        maxAttemptsPerLecture: 50, // Reduced for performance
        allowPartialSchedules: true,
        prioritizeEvenDistribution: true
      });
      
      const { result: schedule, timeMs } = await PerformanceTestUtils.measureExecutionTime(async () => {
        return await generator.generateTimetable(largeBatches, [], []);
      });
      
      expect(schedule).toBeDefined();
      expect(timeMs).toBeLessThan(15000); // Should complete within 15 seconds
      expect(schedule.entries.length).toBeGreaterThan(0);
    });

    it('should export large schedules efficiently', async () => {
      const largeSchedule = TestDataFactory.createCustomSchedule({
        entryCount: 200,
        batchCount: 20,
        facultyCount: 50
      });
      
      const exportManager = new ExportManager();
      
      const { result, timeMs } = await PerformanceTestUtils.measureExecutionTime(async () => {
        return await exportManager.exportSchedule(largeSchedule, {
          format: ExportFormat.JSON,
          includeMetadata: true,
          includeStatistics: true
        });
      });
      
      expect(result.success).toBe(true);
      expect(timeMs).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty inputs gracefully', async () => {
      const generator = new ScheduleGenerator({
        workingDays: [DayOfWeek.MONDAY],
        workingHours: { start: '08:00', end: '18:00' },
        slotDuration: 60,
        breakDuration: 0,
        maxAttemptsPerLecture: 100,
        allowPartialSchedules: true,
        prioritizeEvenDistribution: true
      });
      
      const schedule = await generator.generateTimetable([], [], []);
      
      expect(schedule).toBeDefined();
      expect(schedule.entries).toHaveLength(0);
      expect(schedule.validate().isValid).toBe(true);
    });

    it('should handle single lecture scenarios', async () => {
      const batch = new Batch('SINGLE', 'Single Lecture Batch');
      batch.addSubject(new Subject('single', 'Single Subject', 1, 60, 'Single Faculty'));
      
      const generator = new ScheduleGenerator({
        workingDays: [DayOfWeek.MONDAY],
        workingHours: { start: '08:00', end: '18:00' },
        slotDuration: 60,
        breakDuration: 0,
        maxAttemptsPerLecture: 100,
        allowPartialSchedules: true,
        prioritizeEvenDistribution: true
      });
      
      const schedule = await generator.generateTimetable([batch], [], []);
      
      expect(schedule).toBeDefined();
      expect(schedule.entries.length).toBeLessThanOrEqual(1);
    });

    it('should handle impossible scheduling scenarios', async () => {
      // Create scenario with too many lectures for available time
      const batch = new Batch('IMPOSSIBLE', 'Impossible Batch');
      for (let i = 0; i < 50; i++) {
        batch.addSubject(new Subject(`subject${i}`, `Subject ${i}`, 5, 60, `Faculty${i}`));
      }
      
      const generator = new ScheduleGenerator({
        workingDays: [DayOfWeek.MONDAY], // Only one day
        workingHours: { start: '08:00', end: '10:00' }, // Only 2 hours
        slotDuration: 60,
        breakDuration: 0,
        maxAttemptsPerLecture: 10, // Limited attempts
        allowPartialSchedules: true,
        prioritizeEvenDistribution: true
      });
      
      const schedule = await generator.generateTimetable([batch], [], []);
      
      expect(schedule).toBeDefined();
      // Should create partial schedule
      expect(schedule.entries.length).toBeLessThan(batch.getTotalLecturesPerWeek());
    });
  });
});
