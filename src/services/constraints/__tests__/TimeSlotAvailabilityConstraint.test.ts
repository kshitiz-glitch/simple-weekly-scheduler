import { TimeSlotAvailabilityConstraint } from '../TimeSlotAvailabilityConstraint';
import { ScheduleEntry, DayOfWeek, TimeSlot } from '../../../models';

describe('TimeSlotAvailabilityConstraint', () => {
  let constraint: TimeSlotAvailabilityConstraint;
  let mockTimeSlot: TimeSlot;

  beforeEach(() => {
    constraint = new TimeSlotAvailabilityConstraint();
    
    mockTimeSlot = {
      day: DayOfWeek.MONDAY,
      startTime: '09:00',
      endTime: '10:00',
      isAvailable: true
    };
  });

  describe('validate', () => {
    it('should return null for valid time slot', () => {
      const entry: ScheduleEntry = {
        batchId: 'batch_1',
        subjectId: 'subject_1',
        facultyId: 'faculty_1',
        timeSlot: mockTimeSlot
      };

      const result = constraint.validate(entry, []);

      expect(result).toBeNull();
    });

    it('should detect non-working day', () => {
      const entry: ScheduleEntry = {
        batchId: 'batch_1',
        subjectId: 'subject_1',
        facultyId: 'faculty_1',
        timeSlot: {
          ...mockTimeSlot,
          day: DayOfWeek.SATURDAY
        }
      };

      const result = constraint.validate(entry, []);

      expect(result).not.toBeNull();
      expect(result!.message).toContain('Saturday is not a working day');
    });

    it('should detect time outside working hours', () => {
      const entry: ScheduleEntry = {
        batchId: 'batch_1',
        subjectId: 'subject_1',
        facultyId: 'faculty_1',
        timeSlot: {
          ...mockTimeSlot,
          startTime: '19:00',
          endTime: '20:00'
        }
      };

      const result = constraint.validate(entry, []);

      expect(result).not.toBeNull();
      expect(result!.message).toContain('outside working hours');
    });

    it('should detect unavailable time slot', () => {
      const entry: ScheduleEntry = {
        batchId: 'batch_1',
        subjectId: 'subject_1',
        facultyId: 'faculty_1',
        timeSlot: {
          ...mockTimeSlot,
          isAvailable: false
        }
      };

      const result = constraint.validate(entry, []);

      expect(result).not.toBeNull();
      expect(result!.message).toContain('marked as unavailable');
    });

    it('should detect excluded time slot', () => {
      constraint.excludeTimeSlot(DayOfWeek.MONDAY, '09:00', '10:00');

      const entry: ScheduleEntry = {
        batchId: 'batch_1',
        subjectId: 'subject_1',
        facultyId: 'faculty_1',
        timeSlot: mockTimeSlot
      };

      const result = constraint.validate(entry, []);

      expect(result).not.toBeNull();
      expect(result!.message).toContain('explicitly excluded');
    });

    it('should return null when constraint is disabled', () => {
      constraint.setEnabled(false);

      const entry: ScheduleEntry = {
        batchId: 'batch_1',
        subjectId: 'subject_1',
        facultyId: 'faculty_1',
        timeSlot: {
          ...mockTimeSlot,
          day: DayOfWeek.SATURDAY
        }
      };

      const result = constraint.validate(entry, []);

      expect(result).toBeNull();
    });
  });

  describe('holiday management', () => {
    it('should detect holidays', () => {
      const holiday = new Date('2024-12-25');
      constraint.addHoliday(holiday);

      expect(constraint.isHoliday(holiday)).toBe(true);
      expect(constraint.isHoliday(new Date('2024-12-24'))).toBe(false);
    });

    it('should add and remove holidays', () => {
      const holiday = new Date('2024-12-25');
      
      constraint.addHoliday(holiday);
      expect(constraint.isHoliday(holiday)).toBe(true);
      
      constraint.removeHoliday(holiday);
      expect(constraint.isHoliday(holiday)).toBe(false);
    });

    it('should get all holidays', () => {
      const holiday1 = new Date('2024-12-25');
      const holiday2 = new Date('2024-01-01');
      
      constraint.addHoliday(holiday1);
      constraint.addHoliday(holiday2);

      const holidays = constraint.getHolidays();
      expect(holidays).toHaveLength(2);
    });
  });

  describe('working days management', () => {
    it('should set and get working days', () => {
      const workingDays = [DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY];
      constraint.setWorkingDays(workingDays);

      expect(constraint.getWorkingDays()).toEqual(expect.arrayContaining(workingDays));
      expect(constraint.isWorkingDay(DayOfWeek.MONDAY)).toBe(true);
      expect(constraint.isWorkingDay(DayOfWeek.TUESDAY)).toBe(false);
    });
  });

  describe('working hours management', () => {
    it('should set and get working hours', () => {
      constraint.setWorkingHours('08:30', '17:30');

      const workingHours = constraint.getWorkingHours();
      expect(workingHours.start).toBe('08:30');
      expect(workingHours.end).toBe('17:30');
    });

    it('should validate working hours format', () => {
      expect(() => constraint.setWorkingHours('invalid', '17:00')).toThrow('Invalid time format');
      expect(() => constraint.setWorkingHours('10:00', '09:00')).toThrow('Start time must be before end time');
    });

    it('should check if time is within working hours', () => {
      constraint.setWorkingHours('09:00', '17:00');

      expect(constraint.isWithinWorkingHours('10:00', '11:00')).toBe(true);
      expect(constraint.isWithinWorkingHours('08:00', '09:00')).toBe(false);
      expect(constraint.isWithinWorkingHours('16:00', '18:00')).toBe(false);
    });
  });

  describe('time slot exclusion', () => {
    it('should exclude and include time slots', () => {
      constraint.excludeTimeSlot(DayOfWeek.MONDAY, '12:00', '13:00');

      expect(constraint.isTimeSlotExcluded(DayOfWeek.MONDAY, '12:00', '13:00')).toBe(true);
      expect(constraint.isTimeSlotExcluded(DayOfWeek.MONDAY, '11:00', '12:00')).toBe(false);

      constraint.includeTimeSlot(DayOfWeek.MONDAY, '12:00', '13:00');
      expect(constraint.isTimeSlotExcluded(DayOfWeek.MONDAY, '12:00', '13:00')).toBe(false);
    });

    it('should get all excluded time slots', () => {
      constraint.excludeTimeSlot(DayOfWeek.MONDAY, '12:00', '13:00');
      constraint.excludeTimeSlot(DayOfWeek.TUESDAY, '14:00', '15:00');

      const excluded = constraint.getExcludedTimeSlots();
      expect(excluded).toHaveLength(2);
      expect(excluded).toContainEqual({
        day: DayOfWeek.MONDAY,
        startTime: '12:00',
        endTime: '13:00'
      });
    });
  });

  describe('available time slots', () => {
    it('should get available time slots for a working day', () => {
      const existing: ScheduleEntry[] = [{
        batchId: 'batch_1',
        subjectId: 'subject_1',
        facultyId: 'faculty_1',
        timeSlot: {
          day: DayOfWeek.MONDAY,
          startTime: '10:00',
          endTime: '11:00',
          isAvailable: true
        }
      }];

      const availableSlots = constraint.getAvailableTimeSlotsForDay(
        DayOfWeek.MONDAY,
        60, // 1 hour slots
        existing
      );

      expect(availableSlots.length).toBeGreaterThan(0);
      // Should not include the occupied 10:00-11:00 slot
      expect(availableSlots).not.toContainEqual({
        startTime: '10:00',
        endTime: '11:00'
      });
    });

    it('should return empty array for non-working day', () => {
      const availableSlots = constraint.getAvailableTimeSlotsForDay(
        DayOfWeek.SATURDAY,
        60
      );

      expect(availableSlots).toHaveLength(0);
    });

    it('should respect excluded time slots', () => {
      constraint.excludeTimeSlot(DayOfWeek.MONDAY, '09:00', '10:00');

      const availableSlots = constraint.getAvailableTimeSlotsForDay(
        DayOfWeek.MONDAY,
        60
      );

      expect(availableSlots).not.toContainEqual({
        startTime: '09:00',
        endTime: '10:00'
      });
    });
  });

  describe('utility methods', () => {
    it('should calculate total available hours per week', () => {
      // Default: Mon-Fri, 08:00-18:00 = 5 days * 10 hours = 50 hours
      const totalHours = constraint.getTotalAvailableHoursPerWeek();
      expect(totalHours).toBe(50);
    });

    it('should clone constraint correctly', () => {
      const holiday = new Date('2024-12-25');
      constraint.addHoliday(holiday);
      constraint.excludeTimeSlot(DayOfWeek.MONDAY, '12:00', '13:00');
      constraint.setWorkingHours('09:00', '17:00');
      constraint.setEnabled(false);

      const cloned = constraint.clone();

      expect(cloned.isHoliday(holiday)).toBe(true);
      expect(cloned.isTimeSlotExcluded(DayOfWeek.MONDAY, '12:00', '13:00')).toBe(true);
      expect(cloned.getWorkingHours()).toEqual({ start: '09:00', end: '17:00' });
      expect(cloned.isConstraintEnabled()).toBe(false);
    });

    it('should get detailed configuration', () => {
      const holiday = new Date('2024-12-25');
      constraint.addHoliday(holiday);
      constraint.excludeTimeSlot(DayOfWeek.MONDAY, '12:00', '13:00');

      const config = constraint.getDetailedConfiguration();

      expect(config.type).toBe('timeslot-availability');
      expect(config.holidays).toContain('2024-12-25');
      expect(config.workingDays).toContain('Monday');
      expect(config.excludedTimeSlots).toContainEqual({
        day: DayOfWeek.MONDAY,
        startTime: '12:00',
        endTime: '13:00'
      });
    });
  });

  describe('constructor options', () => {
    it('should accept custom holidays in constructor', () => {
      const holidays = [new Date('2024-12-25'), new Date('2024-01-01')];
      const customConstraint = new TimeSlotAvailabilityConstraint(holidays);

      expect(customConstraint.getHolidays()).toHaveLength(2);
    });

    it('should accept custom working days in constructor', () => {
      const workingDays = [DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY];
      const customConstraint = new TimeSlotAvailabilityConstraint([], workingDays);

      expect(customConstraint.getWorkingDays()).toEqual(expect.arrayContaining(workingDays));
    });

    it('should accept custom working hours in constructor', () => {
      const workingHours = { start: '09:30', end: '16:30' };
      const customConstraint = new TimeSlotAvailabilityConstraint([], [], workingHours);

      expect(customConstraint.getWorkingHours()).toEqual(workingHours);
    });

    it('should accept custom priority in constructor', () => {
      const customConstraint = new TimeSlotAvailabilityConstraint([], [], undefined, 75);

      expect(customConstraint.getPriority()).toBe(75);
    });
  });
});
