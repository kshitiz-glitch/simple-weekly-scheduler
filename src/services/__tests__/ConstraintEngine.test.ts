import { ConstraintEngine } from '../ConstraintEngine';
import { BaseConstraint, FacultyConflictConstraint, TimeSlotAvailabilityConstraint } from '../constraints';
import { ScheduleEntry, DayOfWeek, TimeSlot, ConstraintViolation } from '../../models';

// Mock constraint for testing
class MockConstraint extends BaseConstraint {
  private shouldViolate: boolean;

  constructor(shouldViolate: boolean = false, priority: number = 50) {
    super('mock-constraint', 'Mock constraint for testing', priority);
    this.shouldViolate = shouldViolate;
  }

  validate(entry: ScheduleEntry, existing: ScheduleEntry[]): ConstraintViolation | null {
    if (!this.isEnabled || !this.shouldViolate) {
      return null;
    }

    return this.createViolation(
      'Mock constraint violation',
      [entry],
      'error'
    );
  }

  setShouldViolate(shouldViolate: boolean): void {
    this.shouldViolate = shouldViolate;
  }

  clone(): MockConstraint {
    const cloned = new MockConstraint(this.shouldViolate, this.priority);
    cloned.setEnabled(this.isEnabled);
    return cloned;
  }
}

describe('ConstraintEngine', () => {
  let engine: ConstraintEngine;
  let mockTimeSlot: TimeSlot;
  let mockEntry: ScheduleEntry;

  beforeEach(() => {
    engine = new ConstraintEngine();
    
    mockTimeSlot = {
      day: DayOfWeek.MONDAY,
      startTime: '09:00',
      endTime: '10:00',
      isAvailable: true
    };

    mockEntry = {
      batchId: 'batch_1',
      subjectId: 'subject_1',
      facultyId: 'faculty_1',
      timeSlot: mockTimeSlot
    };
  });

  describe('constraint management', () => {
    it('should initialize with default constraints', () => {
      const constraints = engine.getAllConstraints();
      
      expect(constraints.length).toBe(2);
      expect(constraints.some(c => c.type === 'faculty-conflict')).toBe(true);
      expect(constraints.some(c => c.type === 'timeslot-availability')).toBe(true);
    });

    it('should add and remove constraints', () => {
      const mockConstraint = new MockConstraint();
      
      engine.addConstraint(mockConstraint);
      expect(engine.getConstraint('mock-constraint')).toBe(mockConstraint);
      
      const removed = engine.removeConstraint('mock-constraint');
      expect(removed).toBe(true);
      expect(engine.getConstraint('mock-constraint')).toBeUndefined();
    });

    it('should return false when removing non-existent constraint', () => {
      const removed = engine.removeConstraint('non-existent');
      expect(removed).toBe(false);
    });

    it('should get enabled constraints sorted by priority', () => {
      const highPriorityConstraint = new MockConstraint(false, 100);
      const lowPriorityConstraint = new MockConstraint(false, 10);
      
      engine.addConstraint(highPriorityConstraint);
      engine.addConstraint(lowPriorityConstraint);
      
      const enabledConstraints = engine.getEnabledConstraints();
      
      // Should be sorted by priority (high to low)
      expect(enabledConstraints[0].getPriority()).toBeGreaterThanOrEqual(
        enabledConstraints[1].getPriority()
      );
    });

    it('should filter out disabled constraints', () => {
      const mockConstraint = new MockConstraint();
      mockConstraint.setEnabled(false);
      
      engine.addConstraint(mockConstraint);
      
      const enabledConstraints = engine.getEnabledConstraints();
      expect(enabledConstraints.some(c => c.type === 'mock-constraint')).toBe(false);
    });
  });

  describe('schedule validation', () => {
    it('should validate schedule with no violations', () => {
      const schedule: ScheduleEntry[] = [
        {
          batchId: 'batch_1',
          subjectId: 'subject_1',
          facultyId: 'faculty_1',
          timeSlot: mockTimeSlot
        },
        {
          batchId: 'batch_2',
          subjectId: 'subject_2',
          facultyId: 'faculty_2',
          timeSlot: {
            day: DayOfWeek.TUESDAY,
            startTime: '10:00',
            endTime: '11:00',
            isAvailable: true
          }
        }
      ];

      const violations = engine.validateSchedule(schedule);
      expect(violations).toHaveLength(0);
    });

    it('should detect faculty conflicts', () => {
      const schedule: ScheduleEntry[] = [
        {
          batchId: 'batch_1',
          subjectId: 'subject_1',
          facultyId: 'faculty_1',
          timeSlot: mockTimeSlot
        },
        {
          batchId: 'batch_2',
          subjectId: 'subject_2',
          facultyId: 'faculty_1', // Same faculty
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '09:30',
            endTime: '10:30',
            isAvailable: true
          }
        }
      ];

      const violations = engine.validateSchedule(schedule);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some(v => v.type === 'faculty-conflict')).toBe(true);
    });

    it('should return empty array when engine is disabled', () => {
      engine.setEnabled(false);
      
      const schedule: ScheduleEntry[] = [mockEntry];
      const violations = engine.validateSchedule(schedule);
      
      expect(violations).toHaveLength(0);
    });

    it('should handle constraint execution errors', () => {
      // Create a constraint that throws an error
      class FaultyConstraint extends BaseConstraint {
        constructor() {
          super('faulty-constraint', 'Faulty constraint', 50);
        }

        validate(): ConstraintViolation | null {
          throw new Error('Constraint execution failed');
        }

        clone(): FaultyConstraint {
          return new FaultyConstraint();
        }
      }

      engine.addConstraint(new FaultyConstraint());
      
      const violations = engine.validateSchedule([mockEntry]);
      
      expect(violations.some(v => v.type === 'constraint-error')).toBe(true);
      expect(violations.some(v => v.message.includes('Constraint execution failed'))).toBe(true);
    });
  });

  describe('faculty conflict checking', () => {
    it('should check faculty conflicts correctly', () => {
      const existing: ScheduleEntry[] = [{
        batchId: 'batch_2',
        subjectId: 'subject_2',
        facultyId: 'faculty_1',
        timeSlot: {
          day: DayOfWeek.MONDAY,
          startTime: '09:30',
          endTime: '10:30',
          isAvailable: true
        }
      }];

      const hasConflict = engine.checkFacultyConflict(mockEntry, existing);
      expect(hasConflict).toBe(true);
    });

    it('should return false when faculty constraint is disabled', () => {
      engine.disableConstraint('faculty-conflict');
      
      const existing: ScheduleEntry[] = [{
        batchId: 'batch_2',
        subjectId: 'subject_2',
        facultyId: 'faculty_1',
        timeSlot: {
          day: DayOfWeek.MONDAY,
          startTime: '09:30',
          endTime: '10:30',
          isAvailable: true
        }
      }];

      const hasConflict = engine.checkFacultyConflict(mockEntry, existing);
      expect(hasConflict).toBe(false);
    });
  });

  describe('time slot availability checking', () => {
    it('should check time slot availability', () => {
      const isAvailable = engine.checkTimeSlotAvailability(mockTimeSlot, []);
      expect(isAvailable).toBe(true);
    });

    it('should check availability with holidays', () => {
      const holidays = [new Date('2024-12-25')];
      const isAvailable = engine.checkTimeSlotAvailability(mockTimeSlot, holidays);
      expect(isAvailable).toBe(true);
    });

    it('should return slot availability when constraint is disabled', () => {
      engine.disableConstraint('timeslot-availability');
      
      const unavailableSlot: TimeSlot = {
        ...mockTimeSlot,
        isAvailable: false
      };

      const isAvailable = engine.checkTimeSlotAvailability(unavailableSlot, []);
      expect(isAvailable).toBe(false); // Returns slot's own availability
    });
  });

  describe('violation analysis', () => {
    it('should find violations for specific entry', () => {
      const mockConstraint = new MockConstraint(true);
      engine.addConstraint(mockConstraint);

      const violations = engine.findViolationsForEntry(mockEntry, []);
      
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some(v => v.type === 'mock-constraint')).toBe(true);
    });

    it('should provide suggestions for violations', () => {
      const violations: ConstraintViolation[] = [
        {
          type: 'faculty-conflict',
          message: 'Faculty conflict',
          affectedEntries: [mockEntry],
          severity: 'error'
        },
        {
          type: 'timeslot-availability',
          message: 'Time slot unavailable',
          affectedEntries: [mockEntry],
          severity: 'error'
        }
      ];

      const suggestions = engine.getSuggestions(violations);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('rescheduling'))).toBe(true);
      expect(suggestions.some(s => s.includes('time slot'))).toBe(true);
    });

    it('should remove duplicate suggestions', () => {
      const violations: ConstraintViolation[] = [
        {
          type: 'faculty-conflict',
          message: 'Faculty conflict 1',
          affectedEntries: [mockEntry],
          severity: 'error'
        },
        {
          type: 'faculty-conflict',
          message: 'Faculty conflict 2',
          affectedEntries: [mockEntry],
          severity: 'error'
        }
      ];

      const suggestions = engine.getSuggestions(violations);
      const uniqueSuggestions = [...new Set(suggestions)];
      
      expect(suggestions.length).toBe(uniqueSuggestions.length);
    });
  });

  describe('statistics and reporting', () => {
    it('should provide constraint statistics', () => {
      const mockConstraint = new MockConstraint();
      engine.addConstraint(mockConstraint);
      
      // Generate some violations
      engine.validateSchedule([mockEntry]);

      const stats = engine.getConstraintStatistics();
      
      expect(stats.totalConstraints).toBe(3); // 2 default + 1 mock
      expect(stats.enabledConstraints).toBe(3);
      expect(stats.disabledConstraints).toBe(0);
      expect(stats.constraintTypes).toContain('mock-constraint');
    });

    it('should track violation history', () => {
      const mockConstraint = new MockConstraint(true);
      engine.addConstraint(mockConstraint);
      
      engine.validateSchedule([mockEntry]);
      
      const history = engine.getViolationHistory();
      expect(history.length).toBeGreaterThan(0);
      
      engine.clearViolationHistory();
      expect(engine.getViolationHistory()).toHaveLength(0);
    });

    it('should generate detailed violation report', () => {
      const mockConstraint = new MockConstraint(true);
      engine.addConstraint(mockConstraint);
      
      const schedule = [mockEntry];
      const report = engine.getViolationReport(schedule);
      
      expect(report.totalViolations).toBeGreaterThan(0);
      expect(report.errorViolations).toBeGreaterThan(0);
      expect(report.violationsByType.has('mock-constraint')).toBe(true);
      expect(report.affectedEntries.has(mockEntry)).toBe(true);
    });
  });

  describe('constraint control', () => {
    it('should enable and disable specific constraints', () => {
      expect(engine.enableConstraint('faculty-conflict')).toBe(true);
      expect(engine.disableConstraint('faculty-conflict')).toBe(true);
      expect(engine.enableConstraint('non-existent')).toBe(false);
      expect(engine.disableConstraint('non-existent')).toBe(false);
    });

    it('should validate single entry', () => {
      const mockConstraint = new MockConstraint(true);
      engine.addConstraint(mockConstraint);

      const result = engine.validateEntry(mockEntry, []);
      
      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('alternative time slot finding', () => {
    it('should find valid alternative time slots', () => {
      const candidateSlots: TimeSlot[] = [
        {
          day: DayOfWeek.MONDAY,
          startTime: '11:00',
          endTime: '12:00',
          isAvailable: true
        },
        {
          day: DayOfWeek.SATURDAY, // Non-working day
          startTime: '09:00',
          endTime: '10:00',
          isAvailable: true
        }
      ];

      const validSlots = engine.findAlternativeTimeSlots(mockEntry, [], candidateSlots);
      
      expect(validSlots.length).toBeGreaterThan(0);
      expect(validSlots.every(slot => slot.day !== DayOfWeek.SATURDAY)).toBe(true);
    });
  });

  describe('configuration management', () => {
    it('should get and load configuration', () => {
      const config = engine.getConfiguration();
      
      expect(config.engineEnabled).toBe(true);
      expect(config.constraints.length).toBeGreaterThan(0);

      // Modify configuration
      const newConfig = {
        engineEnabled: false,
        constraints: config.constraints.map(c => ({
          type: c.type,
          enabled: false
        }))
      };

      engine.loadConfiguration(newConfig);
      
      expect(engine.isEngineEnabled()).toBe(false);
      expect(engine.getEnabledConstraints()).toHaveLength(0);
    });

    it('should reset to defaults', () => {
      const mockConstraint = new MockConstraint();
      engine.addConstraint(mockConstraint);
      engine.setEnabled(false);
      
      engine.resetToDefaults();
      
      expect(engine.isEngineEnabled()).toBe(true);
      expect(engine.getAllConstraints()).toHaveLength(2); // Only default constraints
      expect(engine.getConstraint('mock-constraint')).toBeUndefined();
    });
  });

  describe('cloning', () => {
    it('should clone constraint engine correctly', () => {
      const mockConstraint = new MockConstraint();
      engine.addConstraint(mockConstraint);
      engine.setEnabled(false);
      
      const cloned = engine.clone();
      
      expect(cloned.isEngineEnabled()).toBe(engine.isEngineEnabled());
      expect(cloned.getAllConstraints().length).toBe(engine.getAllConstraints().length);
      expect(cloned.getConstraint('mock-constraint')).toBeDefined();
      
      // Ensure they are separate instances
      expect(cloned).not.toBe(engine);
    });
  });

  describe('edge cases', () => {
    it('should handle empty schedule validation', () => {
      const violations = engine.validateSchedule([]);
      expect(violations).toHaveLength(0);
    });

    it('should handle constraint with no violations', () => {
      const mockConstraint = new MockConstraint(false);
      engine.addConstraint(mockConstraint);

      const violations = engine.validateSchedule([mockEntry]);
      expect(violations.every(v => v.type !== 'mock-constraint')).toBe(true);
    });

    it('should handle missing constraint gracefully', () => {
      // Remove all constraints
      engine.removeConstraint('faculty-conflict');
      engine.removeConstraint('timeslot-availability');
      
      const hasConflict = engine.checkFacultyConflict(mockEntry, []);
      const isAvailable = engine.checkTimeSlotAvailability(mockTimeSlot, []);
      
      expect(hasConflict).toBe(false);
      expect(isAvailable).toBe(true);
    });
  });
});
