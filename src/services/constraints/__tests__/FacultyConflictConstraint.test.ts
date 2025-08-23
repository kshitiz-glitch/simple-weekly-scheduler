import { FacultyConflictConstraint } from '../FacultyConflictConstraint';
import { ScheduleEntry, DayOfWeek, TimeSlot } from '../../../models';

describe('FacultyConflictConstraint', () => {
  let constraint: FacultyConflictConstraint;
  let mockTimeSlot1: TimeSlot;
  let mockTimeSlot2: TimeSlot;
  let mockTimeSlot3: TimeSlot;

  beforeEach(() => {
    constraint = new FacultyConflictConstraint();
    
    mockTimeSlot1 = {
      day: DayOfWeek.MONDAY,
      startTime: '09:00',
      endTime: '10:00',
      isAvailable: true
    };

    mockTimeSlot2 = {
      day: DayOfWeek.MONDAY,
      startTime: '09:30',
      endTime: '10:30',
      isAvailable: true
    };

    mockTimeSlot3 = {
      day: DayOfWeek.MONDAY,
      startTime: '11:00',
      endTime: '12:00',
      isAvailable: true
    };
  });

  describe('validate', () => {
    it('should return null for no conflicts', () => {
      const entry: ScheduleEntry = {
        batchId: 'batch_1',
        subjectId: 'subject_1',
        facultyId: 'faculty_1',
        timeSlot: mockTimeSlot1
      };

      const existing: ScheduleEntry[] = [{
        batchId: 'batch_2',
        subjectId: 'subject_2',
        facultyId: 'faculty_2', // Different faculty
        timeSlot: mockTimeSlot2
      }];

      const result = constraint.validate(entry, existing);

      expect(result).toBeNull();
    });

    it('should detect faculty conflict with overlapping time slots', () => {
      const entry: ScheduleEntry = {
        batchId: 'batch_1',
        subjectId: 'subject_1',
        facultyId: 'faculty_1',
        timeSlot: mockTimeSlot1
      };

      const existing: ScheduleEntry[] = [{
        batchId: 'batch_2',
        subjectId: 'subject_2',
        facultyId: 'faculty_1', // Same faculty
        timeSlot: mockTimeSlot2 // Overlapping time
      }];

      const result = constraint.validate(entry, existing);

      expect(result).not.toBeNull();
      expect(result!.type).toBe('faculty-conflict');
      expect(result!.message).toContain('Faculty conflict detected');
      expect(result!.affectedEntries).toHaveLength(2);
      expect(result!.severity).toBe('error');
    });

    it('should allow same faculty at different times', () => {
      const entry: ScheduleEntry = {
        batchId: 'batch_1',
        subjectId: 'subject_1',
        facultyId: 'faculty_1',
        timeSlot: mockTimeSlot1
      };

      const existing: ScheduleEntry[] = [{
        batchId: 'batch_2',
        subjectId: 'subject_2',
        facultyId: 'faculty_1', // Same faculty
        timeSlot: mockTimeSlot3 // Non-overlapping time
      }];

      const result = constraint.validate(entry, existing);

      expect(result).toBeNull();
    });

    it('should return null when constraint is disabled', () => {
      constraint.setEnabled(false);

      const entry: ScheduleEntry = {
        batchId: 'batch_1',
        subjectId: 'subject_1',
        facultyId: 'faculty_1',
        timeSlot: mockTimeSlot1
      };

      const existing: ScheduleEntry[] = [{
        batchId: 'batch_2',
        subjectId: 'subject_2',
        facultyId: 'faculty_1', // Same faculty
        timeSlot: mockTimeSlot2 // Overlapping time
      }];

      const result = constraint.validate(entry, existing);

      expect(result).toBeNull();
    });
  });

  describe('checkFacultyAvailability', () => {
    it('should return true when faculty is available', () => {
      const existing: ScheduleEntry[] = [{
        batchId: 'batch_1',
        subjectId: 'subject_1',
        facultyId: 'faculty_1',
        timeSlot: mockTimeSlot3
      }];

      const isAvailable = constraint.checkFacultyAvailability(
        'faculty_1',
        { day: 'Monday', startTime: '09:00', endTime: '10:00' },
        existing
      );

      expect(isAvailable).toBe(true);
    });

    it('should return false when faculty is busy', () => {
      const existing: ScheduleEntry[] = [{
        batchId: 'batch_1',
        subjectId: 'subject_1',
        facultyId: 'faculty_1',
        timeSlot: mockTimeSlot1
      }];

      const isAvailable = constraint.checkFacultyAvailability(
        'faculty_1',
        { day: 'Monday', startTime: '09:30', endTime: '10:30' },
        existing
      );

      expect(isAvailable).toBe(false);
    });
  });

  describe('getFacultyBusySlots', () => {
    it('should return all slots where faculty is busy', () => {
      const existing: ScheduleEntry[] = [
        {
          batchId: 'batch_1',
          subjectId: 'subject_1',
          facultyId: 'faculty_1',
          timeSlot: mockTimeSlot1
        },
        {
          batchId: 'batch_2',
          subjectId: 'subject_2',
          facultyId: 'faculty_1',
          timeSlot: mockTimeSlot3
        },
        {
          batchId: 'batch_3',
          subjectId: 'subject_3',
          facultyId: 'faculty_2',
          timeSlot: mockTimeSlot2
        }
      ];

      const busySlots = constraint.getFacultyBusySlots('faculty_1', existing);

      expect(busySlots).toHaveLength(2);
      expect(busySlots.every(slot => slot.facultyId === 'faculty_1')).toBe(true);
    });
  });

  describe('getFacultyWorkload', () => {
    it('should calculate faculty workload correctly', () => {
      const existing: ScheduleEntry[] = [
        {
          batchId: 'batch_1',
          subjectId: 'subject_1',
          facultyId: 'faculty_1',
          timeSlot: mockTimeSlot1
        },
        {
          batchId: 'batch_2',
          subjectId: 'subject_2',
          facultyId: 'faculty_1',
          timeSlot: mockTimeSlot3
        }
      ];

      const workload = constraint.getFacultyWorkload('faculty_1', existing);

      expect(workload).toBe(2);
    });

    it('should return 0 for faculty with no assignments', () => {
      const existing: ScheduleEntry[] = [];

      const workload = constraint.getFacultyWorkload('faculty_1', existing);

      expect(workload).toBe(0);
    });
  });

  describe('findLeastBusyFaculty', () => {
    it('should find faculty with least workload', () => {
      const existing: ScheduleEntry[] = [
        {
          batchId: 'batch_1',
          subjectId: 'subject_1',
          facultyId: 'faculty_1',
          timeSlot: mockTimeSlot1
        },
        {
          batchId: 'batch_2',
          subjectId: 'subject_2',
          facultyId: 'faculty_1',
          timeSlot: mockTimeSlot3
        },
        {
          batchId: 'batch_3',
          subjectId: 'subject_3',
          facultyId: 'faculty_2',
          timeSlot: mockTimeSlot2
        }
      ];

      const leastBusy = constraint.findLeastBusyFaculty(
        ['faculty_1', 'faculty_2', 'faculty_3'],
        existing
      );

      expect(leastBusy).toBe('faculty_3'); // No assignments
    });

    it('should return null for empty faculty list', () => {
      const leastBusy = constraint.findLeastBusyFaculty([], []);

      expect(leastBusy).toBeNull();
    });
  });

  describe('getFacultyUtilization', () => {
    it('should calculate utilization statistics', () => {
      const existing: ScheduleEntry[] = [
        {
          batchId: 'batch_1',
          subjectId: 'subject_1',
          facultyId: 'faculty_1',
          timeSlot: { ...mockTimeSlot1, day: DayOfWeek.MONDAY }
        },
        {
          batchId: 'batch_2',
          subjectId: 'subject_2',
          facultyId: 'faculty_1',
          timeSlot: { ...mockTimeSlot3, day: DayOfWeek.TUESDAY }
        }
      ];

      const utilization = constraint.getFacultyUtilization(existing);

      expect(utilization.has('faculty_1')).toBe(true);
      
      const faculty1Stats = utilization.get('faculty_1')!;
      expect(faculty1Stats.totalLectures).toBe(2);
      expect(faculty1Stats.uniqueDays).toBe(2);
      expect(faculty1Stats.averageLecturesPerDay).toBe(1.0);
      expect(faculty1Stats.busySlots).toHaveLength(2);
    });
  });

  describe('suggestAlternativeSlots', () => {
    it('should suggest available alternative slots', () => {
      const entry: ScheduleEntry = {
        batchId: 'batch_1',
        subjectId: 'subject_1',
        facultyId: 'faculty_1',
        timeSlot: mockTimeSlot1
      };

      const existing: ScheduleEntry[] = [{
        batchId: 'batch_2',
        subjectId: 'subject_2',
        facultyId: 'faculty_1',
        timeSlot: mockTimeSlot1
      }];

      const availableSlots = [
        { day: 'Monday', startTime: '11:00', endTime: '12:00' },
        { day: 'Monday', startTime: '09:00', endTime: '10:00' }, // Conflicts
        { day: 'Tuesday', startTime: '09:00', endTime: '10:00' }
      ];

      const suggestions = constraint.suggestAlternativeSlots(entry, existing, availableSlots);

      expect(suggestions).toHaveLength(2);
      expect(suggestions).not.toContainEqual({ day: 'Monday', startTime: '09:00', endTime: '10:00' });
    });
  });

  describe('getConflictReport', () => {
    it('should generate conflict report', () => {
      const existing: ScheduleEntry[] = [
        {
          batchId: 'batch_1',
          subjectId: 'subject_1',
          facultyId: 'faculty_1',
          timeSlot: mockTimeSlot1
        },
        {
          batchId: 'batch_2',
          subjectId: 'subject_2',
          facultyId: 'faculty_1',
          timeSlot: mockTimeSlot2 // Overlaps with mockTimeSlot1
        }
      ];

      const report = constraint.getConflictReport(existing);

      expect(report.totalConflicts).toBe(1);
      expect(report.conflictsByFaculty.has('faculty_1')).toBe(true);
      expect(report.mostConflictedFaculty).toBe('faculty_1');
    });

    it('should handle no conflicts', () => {
      const existing: ScheduleEntry[] = [
        {
          batchId: 'batch_1',
          subjectId: 'subject_1',
          facultyId: 'faculty_1',
          timeSlot: mockTimeSlot1
        },
        {
          batchId: 'batch_2',
          subjectId: 'subject_2',
          facultyId: 'faculty_1',
          timeSlot: mockTimeSlot3 // No overlap
        }
      ];

      const report = constraint.getConflictReport(existing);

      expect(report.totalConflicts).toBe(0);
      expect(report.conflictsByFaculty.size).toBe(0);
      expect(report.mostConflictedFaculty).toBeNull();
    });
  });

  describe('constraint management', () => {
    it('should clone constraint correctly', () => {
      constraint.setEnabled(false);
      
      const cloned = constraint.clone();

      expect(cloned.type).toBe(constraint.type);
      expect(cloned.getDescription()).toBe(constraint.getDescription());
      expect(cloned.getPriority()).toBe(constraint.getPriority());
      expect(cloned.isConstraintEnabled()).toBe(constraint.isConstraintEnabled());
    });

    it('should compare constraints correctly', () => {
      const constraint2 = new FacultyConflictConstraint(50);

      expect(constraint.compareTo(constraint2)).toBeLessThan(0); // Higher priority first
    });

    it('should check equality correctly', () => {
      const constraint2 = new FacultyConflictConstraint(100);

      expect(constraint.equals(constraint2)).toBe(true);
    });

    it('should provide string representation', () => {
      const str = constraint.toString();

      expect(str).toContain('faculty-conflict');
      expect(str).toContain('priority: 100');
      expect(str).toContain('enabled');
    });
  });
});
