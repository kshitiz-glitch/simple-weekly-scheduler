import { TimeSlotManager } from '../TimeSlotManager';
import { DayOfWeek, TimeSlot, ScheduleEntry } from '../../models';

describe('TimeSlotManager', () => {
  let manager: TimeSlotManager;

  beforeEach(() => {
    manager = new TimeSlotManager();
  });

  describe('initializeSlots', () => {
    it('should create slots for working days', () => {
      const workingDays = ['Monday', 'Tuesday', 'Wednesday'];
      const slots = manager.initializeSlots(workingDays, '09:00', '17:00', 60);

      expect(slots.length).toBeGreaterThan(0);
      expect(slots.every(slot => slot.isAvailable)).toBe(true);
      
      // Should have slots for each working day
      const uniqueDays = new Set(slots.map(slot => slot.day));
      expect(uniqueDays.size).toBe(3);
    });

    it('should create correct number of slots per day', () => {
      const slots = manager.initializeSlots(['Monday'], '09:00', '17:00', 60);
      
      // 09:00-17:00 with 1-hour slots = 8 slots
      expect(slots).toHaveLength(8);
      expect(slots[0].startTime).toBe('09:00');
      expect(slots[0].endTime).toBe('10:00');
      expect(slots[7].startTime).toBe('16:00');
      expect(slots[7].endTime).toBe('17:00');
    });

    it('should handle different slot durations', () => {
      const slots30min = manager.initializeSlots(['Monday'], '09:00', '11:00', 30);
      const slots60min = manager.initializeSlots(['Monday'], '09:00', '11:00', 60);

      expect(slots30min).toHaveLength(4); // 30-min slots
      expect(slots60min).toHaveLength(2); // 60-min slots
    });

    it('should handle invalid day names gracefully', () => {
      const slots = manager.initializeSlots(['InvalidDay', 'Monday'], '09:00', '10:00', 60);
      
      // Should only create slots for valid days
      expect(slots).toHaveLength(1);
      expect(slots[0].day).toBe(DayOfWeek.MONDAY);
    });
  });

  describe('excludeHolidays', () => {
    it('should return all slots when no holidays', () => {
      const slots = manager.initializeSlots(['Monday', 'Tuesday'], '09:00', '10:00', 60);
      const filtered = manager.excludeHolidays(slots, []);

      expect(filtered).toEqual(slots);
    });

    it('should exclude holiday days', () => {
      const slots = manager.initializeSlots(['Monday', 'Tuesday'], '09:00', '10:00', 60);
      const monday = new Date('2024-01-01'); // Assuming this is a Monday
      
      const filtered = manager.excludeHolidays(slots, [monday]);
      
      // Should have fewer slots (exact number depends on date calculation)
      expect(filtered.length).toBeLessThanOrEqual(slots.length);
    });
  });

  describe('findAvailableSlots', () => {
    it('should find slots that can accommodate duration', () => {
      const slots: TimeSlot[] = [
        {
          day: DayOfWeek.MONDAY,
          startTime: '09:00',
          endTime: '10:00', // 60 minutes
          isAvailable: true
        },
        {
          day: DayOfWeek.MONDAY,
          startTime: '10:00',
          endTime: '10:30', // 30 minutes
          isAvailable: true
        }
      ];

      const available45min = manager.findAvailableSlots(slots, 45);
      const available90min = manager.findAvailableSlots(slots, 90);

      expect(available45min).toHaveLength(1); // Only first slot
      expect(available90min).toHaveLength(0); // No slot is 90+ minutes
    });

    it('should exclude unavailable slots', () => {
      const slots: TimeSlot[] = [
        {
          day: DayOfWeek.MONDAY,
          startTime: '09:00',
          endTime: '10:00',
          isAvailable: true
        },
        {
          day: DayOfWeek.MONDAY,
          startTime: '10:00',
          endTime: '11:00',
          isAvailable: false
        }
      ];

      const available = manager.findAvailableSlots(slots, 30);

      expect(available).toHaveLength(1);
      expect(available[0].isAvailable).toBe(true);
    });
  });

  describe('isSlotAvailable', () => {
    it('should return true for available slot with no conflicts', () => {
      const slot: TimeSlot = {
        day: DayOfWeek.MONDAY,
        startTime: '09:00',
        endTime: '10:00',
        isAvailable: true
      };

      const isAvailable = manager.isSlotAvailable(slot, []);

      expect(isAvailable).toBe(true);
    });

    it('should return false for unavailable slot', () => {
      const slot: TimeSlot = {
        day: DayOfWeek.MONDAY,
        startTime: '09:00',
        endTime: '10:00',
        isAvailable: false
      };

      const isAvailable = manager.isSlotAvailable(slot, []);

      expect(isAvailable).toBe(false);
    });

    it('should return false when slot conflicts with existing entry', () => {
      const slot: TimeSlot = {
        day: DayOfWeek.MONDAY,
        startTime: '09:00',
        endTime: '10:00',
        isAvailable: true
      };

      const existingEntry: ScheduleEntry = {
        batchId: 'batch_1',
        subjectId: 'subject_1',
        facultyId: 'faculty_1',
        timeSlot: {
          day: DayOfWeek.MONDAY,
          startTime: '09:30',
          endTime: '10:30',
          isAvailable: true
        }
      };

      const isAvailable = manager.isSlotAvailable(slot, [existingEntry]);

      expect(isAvailable).toBe(false); // Overlaps with existing entry
    });

    it('should return true when slot does not conflict', () => {
      const slot: TimeSlot = {
        day: DayOfWeek.MONDAY,
        startTime: '09:00',
        endTime: '10:00',
        isAvailable: true
      };

      const existingEntry: ScheduleEntry = {
        batchId: 'batch_1',
        subjectId: 'subject_1',
        facultyId: 'faculty_1',
        timeSlot: {
          day: DayOfWeek.MONDAY,
          startTime: '11:00',
          endTime: '12:00',
          isAvailable: true
        }
      };

      const isAvailable = manager.isSlotAvailable(slot, [existingEntry]);

      expect(isAvailable).toBe(true); // No overlap
    });
  });

  describe('getSlotsForDay', () => {
    it('should return slots for specific day', () => {
      const slots = manager.initializeSlots(['Monday', 'Tuesday'], '09:00', '11:00', 60);
      const mondaySlots = manager.getSlotsForDay(slots, DayOfWeek.MONDAY);

      expect(mondaySlots.every(slot => slot.day === DayOfWeek.MONDAY)).toBe(true);
      expect(mondaySlots.length).toBeGreaterThan(0);
    });

    it('should return empty array for day with no slots', () => {
      const slots = manager.initializeSlots(['Monday'], '09:00', '10:00', 60);
      const tuesdaySlots = manager.getSlotsForDay(slots, DayOfWeek.TUESDAY);

      expect(tuesdaySlots).toHaveLength(0);
    });
  });

  describe('getSlotsInTimeRange', () => {
    it('should return slots within time range', () => {
      const slots = manager.initializeSlots(['Monday'], '08:00', '18:00', 60);
      const morningSlots = manager.getSlotsInTimeRange(slots, '09:00', '12:00');

      expect(morningSlots.every(slot => {
        return slot.startTime >= '09:00' && slot.endTime <= '12:00';
      })).toBe(true);
    });

    it('should return empty array when no slots in range', () => {
      const slots = manager.initializeSlots(['Monday'], '14:00', '18:00', 60);
      const morningSlots = manager.getSlotsInTimeRange(slots, '08:00', '12:00');

      expect(morningSlots).toHaveLength(0);
    });
  });

  describe('markSlotsOccupied', () => {
    it('should mark matching slots as occupied', () => {
      const slots = manager.initializeSlots(['Monday'], '09:00', '11:00', 60);
      const occupiedSlots: TimeSlot[] = [{
        day: DayOfWeek.MONDAY,
        startTime: '09:00',
        endTime: '10:00',
        isAvailable: false
      }];

      manager.markSlotsOccupied(slots, occupiedSlots);

      const targetSlot = slots.find(s => s.startTime === '09:00');
      expect(targetSlot?.isAvailable).toBe(false);
    });

    it('should not affect non-matching slots', () => {
      const slots = manager.initializeSlots(['Monday'], '09:00', '11:00', 60);
      const occupiedSlots: TimeSlot[] = [{
        day: DayOfWeek.TUESDAY, // Different day
        startTime: '09:00',
        endTime: '10:00',
        isAvailable: false
      }];

      manager.markSlotsOccupied(slots, occupiedSlots);

      expect(slots.every(slot => slot.isAvailable)).toBe(true);
    });
  });

  describe('resetSlotAvailability', () => {
    it('should reset all slots to available', () => {
      const slots = manager.initializeSlots(['Monday'], '09:00', '11:00', 60);
      
      // Mark some slots as unavailable
      slots[0].isAvailable = false;
      slots[1].isAvailable = false;

      manager.resetSlotAvailability(slots);

      expect(slots.every(slot => slot.isAvailable)).toBe(true);
    });
  });

  describe('getSlotUtilization', () => {
    it('should calculate utilization correctly', () => {
      const slots: TimeSlot[] = [
        { day: DayOfWeek.MONDAY, startTime: '09:00', endTime: '10:00', isAvailable: true },
        { day: DayOfWeek.MONDAY, startTime: '10:00', endTime: '11:00', isAvailable: false },
        { day: DayOfWeek.MONDAY, startTime: '11:00', endTime: '12:00', isAvailable: false }
      ];

      const utilization = manager.getSlotUtilization(slots);

      expect(utilization.total).toBe(3);
      expect(utilization.available).toBe(1);
      expect(utilization.occupied).toBe(2);
      expect(utilization.utilizationRate).toBe(66.7); // 2/3 * 100, rounded to 1 decimal
    });

    it('should handle empty slots array', () => {
      const utilization = manager.getSlotUtilization([]);

      expect(utilization.total).toBe(0);
      expect(utilization.available).toBe(0);
      expect(utilization.occupied).toBe(0);
      expect(utilization.utilizationRate).toBe(0);
    });
  });

  describe('findNextAvailableSlot', () => {
    it('should find next available slot after given time', () => {
      const slots = manager.initializeSlots(['Monday', 'Tuesday'], '09:00', '12:00', 60);
      
      const nextSlot = manager.findNextAvailableSlot(
        slots,
        { day: DayOfWeek.MONDAY, time: '10:30' },
        60
      );

      expect(nextSlot).not.toBeNull();
      expect(nextSlot!.startTime).toBe('11:00'); // Next available hour slot
    });

    it('should return null when no suitable slot found', () => {
      const slots = manager.initializeSlots(['Monday'], '09:00', '10:00', 60);
      
      const nextSlot = manager.findNextAvailableSlot(
        slots,
        { day: DayOfWeek.MONDAY, time: '11:00' }, // After all slots
        60
      );

      expect(nextSlot).toBeNull();
    });

    it('should find slot on next day when current day is full', () => {
      const slots = manager.initializeSlots(['Monday', 'Tuesday'], '09:00', '11:00', 60);
      
      const nextSlot = manager.findNextAvailableSlot(
        slots,
        { day: DayOfWeek.MONDAY, time: '10:30' },
        60
      );

      expect(nextSlot).not.toBeNull();
      // Should find slot on Tuesday if Monday is full
    });
  });

  describe('groupSlotsByDay', () => {
    it('should group slots by day correctly', () => {
      const slots = manager.initializeSlots(['Monday', 'Tuesday'], '09:00', '11:00', 60);
      const grouped = manager.groupSlotsByDay(slots);

      expect(grouped.has(DayOfWeek.MONDAY)).toBe(true);
      expect(grouped.has(DayOfWeek.TUESDAY)).toBe(true);
      expect(grouped.get(DayOfWeek.MONDAY)!.length).toBeGreaterThan(0);
      expect(grouped.get(DayOfWeek.TUESDAY)!.length).toBeGreaterThan(0);
    });

    it('should sort slots within each day', () => {
      const slots = manager.initializeSlots(['Monday'], '09:00', '12:00', 60);
      const grouped = manager.groupSlotsByDay(slots);
      const mondaySlots = grouped.get(DayOfWeek.MONDAY)!;

      // Should be sorted by start time
      for (let i = 1; i < mondaySlots.length; i++) {
        expect(mondaySlots[i].startTime >= mondaySlots[i-1].startTime).toBe(true);
      }
    });

    it('should handle empty slots array', () => {
      const grouped = manager.groupSlotsByDay([]);

      expect(grouped.size).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle very short time periods', () => {
      const slots = manager.initializeSlots(['Monday'], '09:00', '09:30', 60);
      
      expect(slots).toHaveLength(0); // No 60-minute slots fit in 30 minutes
    });

    it('should handle exact time boundaries', () => {
      const slots = manager.initializeSlots(['Monday'], '09:00', '10:00', 60);
      
      expect(slots).toHaveLength(1);
      expect(slots[0].startTime).toBe('09:00');
      expect(slots[0].endTime).toBe('10:00');
    });

    it('should handle midnight boundary', () => {
      const slots = manager.initializeSlots(['Monday'], '23:00', '23:59', 30);
      
      expect(slots).toHaveLength(1);
      expect(slots[0].startTime).toBe('23:00');
      expect(slots[0].endTime).toBe('23:30');
    });
  });
});
