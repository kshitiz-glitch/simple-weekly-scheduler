import { ScheduleGenerator } from '../algorithms/ScheduleGenerator';
import { Batch, Subject, DayOfWeek } from '../models';
import { FacultyConflictConstraint, TimeSlotAvailabilityConstraint } from '../services/constraints';

describe('ScheduleGenerator - Holiday Integration', () => {
  let scheduleGenerator: ScheduleGenerator;
  let sampleBatches: Batch[];
  let constraints: any[];

  beforeEach(() => {
    scheduleGenerator = new ScheduleGenerator({
      workingDays: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY],
      workingHours: { start: '09:00', end: '17:00' },
      slotDuration: 60,
      breakDuration: 0,
      maxAttemptsPerLecture: 50,
      allowPartialSchedules: true,
      prioritizeEvenDistribution: true
    });

    // Create sample batches
    const mathSubject = new Subject('math', 'Mathematics', 3, 60, 'faculty1');
    const physicsSubject = new Subject('physics', 'Physics', 2, 60, 'faculty2');
    
    const batch1 = new Batch('batch1', 'Computer Science A');
    batch1.addSubject(mathSubject);
    batch1.addSubject(physicsSubject);

    const englishSubject = new Subject('english', 'English', 2, 60, 'faculty3');
    const batch2 = new Batch('batch2', 'Computer Science B');
    batch2.addSubject(englishSubject);

    sampleBatches = [batch1, batch2];

    constraints = [
      new FacultyConflictConstraint(),
      new TimeSlotAvailabilityConstraint()
    ];
  });

  describe('generateTimetable with holidays', () => {
    it('should generate schedule and resolve holiday conflicts', async () => {
      const holidays = [new Date('2024-01-01')]; // Monday
      
      // Mock Date.prototype.getDay to return Monday (1)
      const originalGetDay = Date.prototype.getDay;
      Date.prototype.getDay = jest.fn().mockReturnValue(1);

      const result = await scheduleGenerator.generateTimetable(
        sampleBatches,
        constraints,
        holidays
      );

      expect(result).toBeDefined();
      expect(result.entries).toBeDefined();
      expect(result.conflicts).toBeDefined();
      expect(result.metadata).toBeDefined();
      
      // Should not have any entries scheduled on Monday due to holiday
      const mondayEntries = result.entries.filter(entry => 
        entry.timeSlot.day === DayOfWeek.MONDAY
      );
      expect(mondayEntries).toHaveLength(0);

      // Should have metadata about holiday conflicts
      expect(result.metadata.holidayConflictsResolved).toBeDefined();
      expect(result.metadata.unresolvableHolidayConflicts).toBeDefined();

      // Restore original method
      Date.prototype.getDay = originalGetDay;
    });

    it('should handle multiple holidays', async () => {
      const holidays = [
        new Date('2024-01-01'), // Monday
        new Date('2024-01-03')  // Wednesday
      ];
      
      // Mock Date.prototype.getDay to return appropriate days
      const originalGetDay = Date.prototype.getDay;
      let callCount = 0;
      Date.prototype.getDay = jest.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? 1 : 3; // Monday then Wednesday
      });

      const result = await scheduleGenerator.generateTimetable(
        sampleBatches,
        constraints,
        holidays
      );

      // Should not have entries on Monday or Wednesday
      const holidayEntries = result.entries.filter(entry => 
        entry.timeSlot.day === DayOfWeek.MONDAY || 
        entry.timeSlot.day === DayOfWeek.WEDNESDAY
      );
      expect(holidayEntries).toHaveLength(0);

      // Should still have some entries on other days
      const otherDayEntries = result.entries.filter(entry => 
        entry.timeSlot.day !== DayOfWeek.MONDAY && 
        entry.timeSlot.day !== DayOfWeek.WEDNESDAY
      );
      expect(otherDayEntries.length).toBeGreaterThan(0);

      // Restore original method
      Date.prototype.getDay = originalGetDay;
    });

    it('should generate schedule when no holidays conflict', async () => {
      const holidays = [new Date('2024-01-06')]; // Saturday (not a working day)
      
      // Mock Date.prototype.getDay to return Saturday (6)
      const originalGetDay = Date.prototype.getDay;
      Date.prototype.getDay = jest.fn().mockReturnValue(6);

      const result = await scheduleGenerator.generateTimetable(
        sampleBatches,
        constraints,
        holidays
      );

      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.metadata.holidayConflictsResolved).toBe(0);
      expect(result.metadata.unresolvableHolidayConflicts).toBe(0);

      // Restore original method
      Date.prototype.getDay = originalGetDay;
    });

    it('should handle empty holidays array', async () => {
      const result = await scheduleGenerator.generateTimetable(
        sampleBatches,
        constraints,
        []
      );

      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.metadata.holidayConflictsResolved).toBe(0);
      expect(result.metadata.unresolvableHolidayConflicts).toBe(0);
    });

    it('should report unresolvable conflicts when no alternatives available', async () => {
      // Create a scenario with very limited time slots and many holidays
      const restrictedGenerator = new ScheduleGenerator({
        workingDays: [DayOfWeek.MONDAY], // Only Monday
        workingHours: { start: '09:00', end: '10:00' }, // Only 1 hour
        slotDuration: 60,
        breakDuration: 0,
        maxAttemptsPerLecture: 10,
        allowPartialSchedules: true,
        prioritizeEvenDistribution: false
      });

      const holidays = [new Date('2024-01-01')]; // Monday (the only working day)
      
      // Mock Date.prototype.getDay to return Monday (1)
      const originalGetDay = Date.prototype.getDay;
      Date.prototype.getDay = jest.fn().mockReturnValue(1);

      const result = await restrictedGenerator.generateTimetable(
        sampleBatches,
        constraints,
        holidays
      );

      // Should have unresolvable conflicts since the only working day is a holiday
      expect(result.metadata.unresolvableHolidayConflicts).toBeGreaterThan(0);

      // Restore original method
      Date.prototype.getDay = originalGetDay;
    });
  });

  describe('analyzeHolidayImpact', () => {
    it('should provide accurate holiday impact analysis', () => {
      const holidays = [new Date('2024-01-01')]; // Monday
      
      // Mock Date.prototype.getDay to return Monday (1)
      const originalGetDay = Date.prototype.getDay;
      Date.prototype.getDay = jest.fn().mockReturnValue(1);

      const analysis = scheduleGenerator.analyzeHolidayImpact(sampleBatches, holidays);

      expect(analysis.affectedDays).toContain(DayOfWeek.MONDAY);
      expect(analysis.slotsLost).toBeGreaterThan(0);
      expect(analysis.feasibilityScore).toBeGreaterThanOrEqual(0);
      expect(analysis.feasibilityScore).toBeLessThanOrEqual(100);
      expect(analysis.alternativesAvailable).toBeGreaterThanOrEqual(0);

      // Restore original method
      Date.prototype.getDay = originalGetDay;
    });

    it('should show no impact when no holidays', () => {
      const analysis = scheduleGenerator.analyzeHolidayImpact(sampleBatches, []);

      expect(analysis.affectedDays).toHaveLength(0);
      expect(analysis.slotsLost).toBe(0);
      expect(analysis.feasibilityScore).toBeGreaterThan(50); // Should be high with no holidays
    });

    it('should show severe impact when all working days are holidays', () => {
      const holidays = [
        new Date('2024-01-01'), // Monday
        new Date('2024-01-02'), // Tuesday
        new Date('2024-01-03'), // Wednesday
        new Date('2024-01-04'), // Thursday
        new Date('2024-01-05')  // Friday
      ];
      
      // Mock Date.prototype.getDay to return appropriate days
      const originalGetDay = Date.prototype.getDay;
      let callCount = 0;
      Date.prototype.getDay = jest.fn().mockImplementation(() => {
        callCount++;
        return callCount; // 1, 2, 3, 4, 5 (Mon-Fri)
      });

      const analysis = scheduleGenerator.analyzeHolidayImpact(sampleBatches, holidays);

      expect(analysis.affectedDays).toHaveLength(5);
      expect(analysis.feasibilityScore).toBe(0); // Should be 0 when all days are holidays
      expect(analysis.alternativesAvailable).toBe(0);

      // Restore original method
      Date.prototype.getDay = originalGetDay;
    });
  });

  describe('suggestHolidayRescheduling', () => {
    it('should suggest rescheduling for holiday-conflicting entries', () => {
      const conflictingEntries = [
        {
          batchId: 'batch1',
          subjectId: 'math',
          facultyId: 'faculty1',
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '09:00',
            endTime: '10:00',
            isAvailable: true
          }
        }
      ];

      const holidays = [new Date('2024-01-01')]; // Monday
      
      // Mock Date.prototype.getDay to return Monday (1)
      const originalGetDay = Date.prototype.getDay;
      Date.prototype.getDay = jest.fn().mockReturnValue(1);

      const suggestions = scheduleGenerator.suggestHolidayRescheduling(
        conflictingEntries,
        holidays,
        constraints
      );

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].entry).toEqual(conflictingEntries[0]);
      expect(suggestions[0].suggestions).toBeDefined();
      
      // Suggestions should not include Monday slots
      suggestions[0].suggestions.forEach(suggestion => {
        expect(suggestion.timeSlot.day).not.toBe(DayOfWeek.MONDAY);
      });

      // Restore original method
      Date.prototype.getDay = originalGetDay;
    });

    it('should provide confidence scores for suggestions', () => {
      const conflictingEntries = [
        {
          batchId: 'batch1',
          subjectId: 'math',
          facultyId: 'faculty1',
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '09:00',
            endTime: '10:00',
            isAvailable: true
          }
        }
      ];

      const holidays = [new Date('2024-01-01')]; // Monday
      
      // Mock Date.prototype.getDay to return Monday (1)
      const originalGetDay = Date.prototype.getDay;
      Date.prototype.getDay = jest.fn().mockReturnValue(1);

      const suggestions = scheduleGenerator.suggestHolidayRescheduling(
        conflictingEntries,
        holidays,
        constraints
      );

      suggestions.forEach(entrysuggestion => {
        entrysuggestion.suggestions.forEach(suggestion => {
          expect(suggestion.confidence).toBeGreaterThanOrEqual(0);
          expect(suggestion.confidence).toBeLessThanOrEqual(1);
          expect(suggestion.reason).toBeDefined();
          expect(typeof suggestion.reason).toBe('string');
        });
      });

      // Restore original method
      Date.prototype.getDay = originalGetDay;
    });

    it('should handle empty conflicting entries', () => {
      const holidays = [new Date('2024-01-01')];
      
      const suggestions = scheduleGenerator.suggestHolidayRescheduling(
        [],
        holidays,
        constraints
      );

      expect(suggestions).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle constraint validation errors gracefully', async () => {
      const faultyConstraint = {
        isConstraintEnabled: () => true,
        validate: () => {
          throw new Error('Constraint validation failed');
        }
      };

      const faultyConstraints = [faultyConstraint];
      const holidays = [new Date('2024-01-01')];

      // Should not throw an error
      const result = await scheduleGenerator.generateTimetable(
        sampleBatches,
        faultyConstraints,
        holidays
      );

      expect(result).toBeDefined();
      expect(result.conflicts.length).toBeGreaterThan(0);
    });

    it('should handle invalid holiday dates', async () => {
      const invalidHolidays = [new Date('invalid-date')];

      // Should not throw an error
      const result = await scheduleGenerator.generateTimetable(
        sampleBatches,
        constraints,
        invalidHolidays
      );

      expect(result).toBeDefined();
    });

    it('should handle empty batches with holidays', async () => {
      const holidays = [new Date('2024-01-01')];

      const result = await scheduleGenerator.generateTimetable(
        [],
        constraints,
        holidays
      );

      expect(result.entries).toHaveLength(0);
      expect(result.metadata.holidayConflictsResolved).toBe(0);
    });
  });

  describe('performance with holidays', () => {
    it('should complete generation within reasonable time with many holidays', async () => {
      // Create many holidays
      const holidays: Date[] = [];
      for (let i = 1; i <= 10; i++) {
        holidays.push(new Date(`2024-01-${i.toString().padStart(2, '0')}`));
      }

      const startTime = Date.now();
      
      const result = await scheduleGenerator.generateTimetable(
        sampleBatches,
        constraints,
        holidays
      );

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should complete within 5 seconds
      expect(executionTime).toBeLessThan(5000);
      expect(result).toBeDefined();
    });
  });
});
