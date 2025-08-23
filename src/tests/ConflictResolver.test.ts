import { ConflictResolver } from '../services/ConflictResolver';
import { ScheduleEntry, TimeSlot, DayOfWeek } from '../models';
import { FacultyConflictConstraint, TimeSlotAvailabilityConstraint } from '../services/constraints';

describe('ConflictResolver', () => {
  let conflictResolver: ConflictResolver;
  let mockConstraints: any[];
  let sampleSchedule: ScheduleEntry[];
  let availableSlots: TimeSlot[];

  beforeEach(() => {
    conflictResolver = new ConflictResolver();
    
    mockConstraints = [
      new FacultyConflictConstraint(),
      new TimeSlotAvailabilityConstraint()
    ];

    sampleSchedule = [
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
      },
      {
        batchId: 'batch2',
        subjectId: 'physics',
        facultyId: 'faculty2',
        timeSlot: {
          day: DayOfWeek.TUESDAY,
          startTime: '10:00',
          endTime: '11:00',
          isAvailable: true
        }
      }
    ];

    availableSlots = [
      {
        day: DayOfWeek.MONDAY,
        startTime: '08:00',
        endTime: '09:00',
        isAvailable: true
      },
      {
        day: DayOfWeek.WEDNESDAY,
        startTime: '09:00',
        endTime: '10:00',
        isAvailable: true
      },
      {
        day: DayOfWeek.THURSDAY,
        startTime: '11:00',
        endTime: '12:00',
        isAvailable: true
      },
      {
        day: DayOfWeek.FRIDAY,
        startTime: '14:00',
        endTime: '15:00',
        isAvailable: true
      }
    ];
  });

  describe('resolveHolidayConflicts', () => {
    it('should identify and resolve holiday conflicts', () => {
      const holidays = [new Date('2024-01-01')]; // Assuming this is a Monday
      
      // Mock the date to return Monday for the holiday
      const originalGetDay = Date.prototype.getDay;
      Date.prototype.getDay = jest.fn().mockReturnValue(1); // Monday

      const result = conflictResolver.resolveHolidayConflicts(
        sampleSchedule,
        holidays,
        availableSlots,
        mockConstraints
      );

      expect(result.conflicts).toBeDefined();
      expect(result.resolvedSchedule).toBeDefined();
      expect(result.unresolvableConflicts).toBeDefined();

      // Restore original method
      Date.prototype.getDay = originalGetDay;
    });

    it('should return original schedule when no holidays conflict', () => {
      const holidays = [new Date('2024-01-07')]; // Assuming this is a Sunday
      
      // Mock the date to return Sunday for the holiday
      const originalGetDay = Date.prototype.getDay;
      Date.prototype.getDay = jest.fn().mockReturnValue(0); // Sunday

      const result = conflictResolver.resolveHolidayConflicts(
        sampleSchedule,
        holidays,
        availableSlots,
        mockConstraints
      );

      expect(result.conflicts).toHaveLength(0);
      expect(result.resolvedSchedule).toEqual(sampleSchedule);
      expect(result.unresolvableConflicts).toHaveLength(0);

      // Restore original method
      Date.prototype.getDay = originalGetDay;
    });

    it('should handle empty schedule', () => {
      const holidays = [new Date('2024-01-01')];

      const result = conflictResolver.resolveHolidayConflicts(
        [],
        holidays,
        availableSlots,
        mockConstraints
      );

      expect(result.conflicts).toHaveLength(0);
      expect(result.resolvedSchedule).toHaveLength(0);
      expect(result.unresolvableConflicts).toHaveLength(0);
    });

    it('should handle empty holidays list', () => {
      const result = conflictResolver.resolveHolidayConflicts(
        sampleSchedule,
        [],
        availableSlots,
        mockConstraints
      );

      expect(result.conflicts).toHaveLength(0);
      expect(result.resolvedSchedule).toEqual(sampleSchedule);
      expect(result.unresolvableConflicts).toHaveLength(0);
    });
  });

  describe('findAlternativeSlots', () => {
    it('should find valid alternative slots for a conflicting entry', () => {
      const conflictingEntry = sampleSchedule[0];

      const result = conflictResolver.findAlternativeSlots(
        conflictingEntry,
        sampleSchedule,
        availableSlots,
        mockConstraints
      );

      expect(result.originalEntry).toEqual(conflictingEntry);
      expect(result.suggestedAlternatives).toBeDefined();
      expect(result.resolutionType).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should return empty alternatives when no valid slots available', () => {
      const conflictingEntry = sampleSchedule[0];
      const emptySlots: TimeSlot[] = [];

      const result = conflictResolver.findAlternativeSlots(
        conflictingEntry,
        sampleSchedule,
        emptySlots,
        mockConstraints
      );

      expect(result.suggestedAlternatives).toHaveLength(0);
      expect(result.resolutionType).toBe('impossible');
      expect(result.confidence).toBe(0);
    });

    it('should prioritize alternatives with higher scores', () => {
      const conflictingEntry = sampleSchedule[0];

      const result = conflictResolver.findAlternativeSlots(
        conflictingEntry,
        sampleSchedule,
        availableSlots,
        mockConstraints
      );

      if (result.suggestedAlternatives.length > 1) {
        for (let i = 0; i < result.suggestedAlternatives.length - 1; i++) {
          expect(result.suggestedAlternatives[i].score)
            .toBeGreaterThanOrEqual(result.suggestedAlternatives[i + 1].score);
        }
      }
    });

    it('should limit alternatives to maximum of 5', () => {
      const conflictingEntry = sampleSchedule[0];
      
      // Create many available slots
      const manySlots: TimeSlot[] = [];
      for (let day = 0; day < 5; day++) {
        for (let hour = 8; hour < 18; hour++) {
          manySlots.push({
            day: day as DayOfWeek,
            startTime: `${hour.toString().padStart(2, '0')}:00`,
            endTime: `${(hour + 1).toString().padStart(2, '0')}:00`,
            isAvailable: true
          });
        }
      }

      const result = conflictResolver.findAlternativeSlots(
        conflictingEntry,
        sampleSchedule,
        manySlots,
        mockConstraints
      );

      expect(result.suggestedAlternatives.length).toBeLessThanOrEqual(5);
    });
  });

  describe('suggestScheduleSwaps', () => {
    it('should suggest valid schedule swaps', () => {
      const conflictingEntry = sampleSchedule[0];

      const result = conflictResolver.suggestScheduleSwaps(
        conflictingEntry,
        sampleSchedule,
        mockConstraints
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      result.forEach(suggestion => {
        expect(suggestion.swapPartner).toBeDefined();
        expect(typeof suggestion.feasible).toBe('boolean');
        expect(typeof suggestion.benefitScore).toBe('number');
      });
    });

    it('should prioritize feasible swaps', () => {
      const conflictingEntry = sampleSchedule[0];

      const result = conflictResolver.suggestScheduleSwaps(
        conflictingEntry,
        sampleSchedule,
        mockConstraints
      );

      if (result.length > 1) {
        // Check that feasible swaps come before infeasible ones
        let foundInfeasible = false;
        for (const suggestion of result) {
          if (foundInfeasible && suggestion.feasible) {
            fail('Feasible swap found after infeasible swap');
          }
          if (!suggestion.feasible) {
            foundInfeasible = true;
          }
        }
      }
    });

    it('should limit suggestions to maximum of 3', () => {
      const conflictingEntry = sampleSchedule[0];
      
      // Create a larger schedule for more swap options
      const largerSchedule = [
        ...sampleSchedule,
        {
          batchId: 'batch3',
          subjectId: 'chemistry',
          facultyId: 'faculty3',
          timeSlot: {
            day: DayOfWeek.WEDNESDAY,
            startTime: '11:00',
            endTime: '12:00',
            isAvailable: true
          }
        },
        {
          batchId: 'batch4',
          subjectId: 'biology',
          facultyId: 'faculty4',
          timeSlot: {
            day: DayOfWeek.THURSDAY,
            startTime: '13:00',
            endTime: '14:00',
            isAvailable: true
          }
        },
        {
          batchId: 'batch5',
          subjectId: 'english',
          facultyId: 'faculty5',
          timeSlot: {
            day: DayOfWeek.FRIDAY,
            startTime: '15:00',
            endTime: '16:00',
            isAvailable: true
          }
        }
      ];

      const result = conflictResolver.suggestScheduleSwaps(
        conflictingEntry,
        largerSchedule,
        mockConstraints
      );

      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should not suggest swapping with itself', () => {
      const conflictingEntry = sampleSchedule[0];

      const result = conflictResolver.suggestScheduleSwaps(
        conflictingEntry,
        sampleSchedule,
        mockConstraints
      );

      result.forEach(suggestion => {
        expect(suggestion.swapPartner).not.toEqual(conflictingEntry);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle schedule with single entry', () => {
      const singleEntrySchedule = [sampleSchedule[0]];
      const holidays = [new Date('2024-01-01')];

      // Mock the date to return Monday for the holiday
      const originalGetDay = Date.prototype.getDay;
      Date.prototype.getDay = jest.fn().mockReturnValue(1); // Monday

      const result = conflictResolver.resolveHolidayConflicts(
        singleEntrySchedule,
        holidays,
        availableSlots,
        mockConstraints
      );

      expect(result).toBeDefined();
      expect(result.resolvedSchedule).toBeDefined();

      // Restore original method
      Date.prototype.getDay = originalGetDay;
    });

    it('should handle multiple holidays on same day', () => {
      const holidays = [
        new Date('2024-01-01'), // Monday
        new Date('2024-01-08')  // Another Monday
      ];

      // Mock the date to return Monday for both holidays
      const originalGetDay = Date.prototype.getDay;
      Date.prototype.getDay = jest.fn().mockReturnValue(1); // Monday

      const result = conflictResolver.resolveHolidayConflicts(
        sampleSchedule,
        holidays,
        availableSlots,
        mockConstraints
      );

      expect(result).toBeDefined();

      // Restore original method
      Date.prototype.getDay = originalGetDay;
    });

    it('should handle constraints that always fail', () => {
      const alwaysFailConstraint = {
        isConstraintEnabled: () => true,
        validate: () => ({
          type: 'always-fail',
          message: 'This constraint always fails',
          affectedEntries: [],
          severity: 'error' as const
        })
      };

      const failingConstraints = [alwaysFailConstraint];
      const conflictingEntry = sampleSchedule[0];

      const result = conflictResolver.findAlternativeSlots(
        conflictingEntry,
        sampleSchedule,
        availableSlots,
        failingConstraints
      );

      expect(result.suggestedAlternatives).toHaveLength(0);
      expect(result.resolutionType).toBe('impossible');
    });

    it('should handle disabled constraints', () => {
      const disabledConstraint = {
        isConstraintEnabled: () => false,
        validate: () => ({
          type: 'disabled',
          message: 'This constraint is disabled',
          affectedEntries: [],
          severity: 'error' as const
        })
      };

      const disabledConstraints = [disabledConstraint];
      const conflictingEntry = sampleSchedule[0];

      const result = conflictResolver.findAlternativeSlots(
        conflictingEntry,
        sampleSchedule,
        availableSlots,
        disabledConstraints
      );

      // Should find alternatives since constraint is disabled
      expect(result.suggestedAlternatives.length).toBeGreaterThan(0);
      expect(result.resolutionType).toBe('reschedule');
    });
  });

  describe('scoring and prioritization', () => {
    it('should give higher scores to same-day alternatives', () => {
      const conflictingEntry = {
        batchId: 'batch1',
        subjectId: 'math',
        facultyId: 'faculty1',
        timeSlot: {
          day: DayOfWeek.MONDAY,
          startTime: '09:00',
          endTime: '10:00',
          isAvailable: true
        }
      };

      const slotsWithSameDay = [
        {
          day: DayOfWeek.MONDAY,
          startTime: '10:00',
          endTime: '11:00',
          isAvailable: true
        },
        {
          day: DayOfWeek.TUESDAY,
          startTime: '09:00',
          endTime: '10:00',
          isAvailable: true
        }
      ];

      const result = conflictResolver.findAlternativeSlots(
        conflictingEntry,
        [],
        slotsWithSameDay,
        []
      );

      if (result.suggestedAlternatives.length >= 2) {
        const sameDayAlternative = result.suggestedAlternatives.find(alt => 
          alt.timeSlot.day === DayOfWeek.MONDAY
        );
        const differentDayAlternative = result.suggestedAlternatives.find(alt => 
          alt.timeSlot.day === DayOfWeek.TUESDAY
        );

        if (sameDayAlternative && differentDayAlternative) {
          expect(sameDayAlternative.score).toBeGreaterThan(differentDayAlternative.score);
        }
      }
    });

    it('should provide meaningful reasons for alternatives', () => {
      const conflictingEntry = sampleSchedule[0];

      const result = conflictResolver.findAlternativeSlots(
        conflictingEntry,
        sampleSchedule,
        availableSlots,
        mockConstraints
      );

      result.suggestedAlternatives.forEach(alternative => {
        expect(alternative.reason).toBeDefined();
        expect(typeof alternative.reason).toBe('string');
        expect(alternative.reason.length).toBeGreaterThan(0);
      });
    });
  });
});
