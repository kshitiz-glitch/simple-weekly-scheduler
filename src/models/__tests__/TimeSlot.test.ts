import { TimeSlot } from '../TimeSlot';
import { DayOfWeek } from '../index';

describe('TimeSlot', () => {
  describe('constructor', () => {
    it('should create a time slot with valid data', () => {
      const slot = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00');
      
      expect(slot.day).toBe(DayOfWeek.MONDAY);
      expect(slot.startTime).toBe('09:00');
      expect(slot.endTime).toBe('10:00');
      expect(slot.isAvailable).toBe(true);
    });

    it('should create a time slot with custom availability', () => {
      const slot = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00', false);
      
      expect(slot.isAvailable).toBe(false);
    });

    it('should throw error for invalid time format', () => {
      expect(() => new TimeSlot(DayOfWeek.MONDAY, '25:00', '10:00')).toThrow('Invalid time slot');
      expect(() => new TimeSlot(DayOfWeek.MONDAY, '09:60', '10:00')).toThrow('Invalid time slot');
      expect(() => new TimeSlot(DayOfWeek.MONDAY, 'invalid', '10:00')).toThrow('Invalid time slot');
    });

    it('should throw error for invalid time range', () => {
      expect(() => new TimeSlot(DayOfWeek.MONDAY, '10:00', '09:00')).toThrow('Invalid time slot');
      expect(() => new TimeSlot(DayOfWeek.MONDAY, '10:00', '10:00')).toThrow('Invalid time slot');
    });

    it('should throw error for too short duration', () => {
      expect(() => new TimeSlot(DayOfWeek.MONDAY, '09:00', '09:15')).toThrow('Invalid time slot');
    });
  });

  describe('validate', () => {
    it('should return valid result for valid time slot', () => {
      const slot = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00');
      
      const result = slot.validate();
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn for very long duration', () => {
      const slot = new TimeSlot(DayOfWeek.MONDAY, '09:00', '14:00'); // 5 hours
      
      const result = slot.validate();
      
      expect(result.warnings).toContain('Time slot duration exceeds 4 hours, which may be too long');
    });
  });

  describe('getDurationMinutes', () => {
    it('should calculate duration correctly', () => {
      const slot = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:30');
      
      expect(slot.lectureDuration).toBe(90);
    });

    it('should handle cross-hour boundaries', () => {
      const slot = new TimeSlot(DayOfWeek.MONDAY, '09:45', '10:15');
      
      expect(slot.lectureDuration).toBe(30);
    });
  });

  describe('getDurationHours', () => {
    it('should calculate duration in hours correctly', () => {
      const slot = new TimeSlot(DayOfWeek.MONDAY, '09:00', '11:00');
      
      expect(slot.getDurationHours()).toBe(2.0);
    });

    it('should round to 1 decimal place', () => {
      const slot = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:30');
      
      expect(slot.getDurationHours()).toBe(1.5);
    });
  });

  describe('canAccommodate', () => {
    it('should return true if slot can accommodate lecture', () => {
      const slot = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:30'); // 90 minutes
      
      expect(slot.canAccommodate(60)).toBe(true);
      expect(slot.canAccommodate(90)).toBe(true);
    });

    it('should return false if slot cannot accommodate lecture', () => {
      const slot = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00'); // 60 minutes
      
      expect(slot.canAccommodate(90)).toBe(false);
    });

    it('should return false if slot is not available', () => {
      const slot = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:30', false);
      
      expect(slot.canAccommodate(60)).toBe(false);
    });
  });

  describe('overlapsWith', () => {
    it('should return true for overlapping slots on same day', () => {
      const slot1 = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00');
      const slot2 = new TimeSlot(DayOfWeek.MONDAY, '09:30', '10:30');
      
      expect(slot1.overlapsWith(slot2)).toBe(true);
      expect(slot2.overlapsWith(slot1)).toBe(true);
    });

    it('should return false for non-overlapping slots on same day', () => {
      const slot1 = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00');
      const slot2 = new TimeSlot(DayOfWeek.MONDAY, '10:00', '11:00');
      
      expect(slot1.overlapsWith(slot2)).toBe(false);
      expect(slot2.overlapsWith(slot1)).toBe(false);
    });

    it('should return false for slots on different days', () => {
      const slot1 = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00');
      const slot2 = new TimeSlot(DayOfWeek.TUESDAY, '09:00', '10:00');
      
      expect(slot1.overlapsWith(slot2)).toBe(false);
    });
  });

  describe('isAdjacentTo', () => {
    it('should return true for adjacent slots', () => {
      const slot1 = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00');
      const slot2 = new TimeSlot(DayOfWeek.MONDAY, '10:00', '11:00');
      
      expect(slot1.isAdjacentTo(slot2)).toBe(true);
      expect(slot2.isAdjacentTo(slot1)).toBe(true);
    });

    it('should return false for non-adjacent slots', () => {
      const slot1 = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00');
      const slot2 = new TimeSlot(DayOfWeek.MONDAY, '10:30', '11:30');
      
      expect(slot1.isAdjacentTo(slot2)).toBe(false);
    });

    it('should return false for slots on different days', () => {
      const slot1 = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00');
      const slot2 = new TimeSlot(DayOfWeek.TUESDAY, '10:00', '11:00');
      
      expect(slot1.isAdjacentTo(slot2)).toBe(false);
    });
  });

  describe('containsTime', () => {
    it('should return true for time within slot', () => {
      const slot = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00');
      
      expect(slot.containsTime('09:00')).toBe(true);
      expect(slot.containsTime('09:30')).toBe(true);
      expect(slot.containsTime('09:59')).toBe(true);
    });

    it('should return false for time outside slot', () => {
      const slot = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00');
      
      expect(slot.containsTime('08:59')).toBe(false);
      expect(slot.containsTime('10:00')).toBe(false); // End time is exclusive
      expect(slot.containsTime('10:01')).toBe(false);
    });

    it('should return false for invalid time format', () => {
      const slot = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00');
      
      expect(slot.containsTime('invalid')).toBe(false);
    });
  });

  describe('availability methods', () => {
    let slot: TimeSlot;

    beforeEach(() => {
      slot = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00');
    });

    describe('setAvailable', () => {
      it('should set availability status', () => {
        slot.setAvailable(false);
        expect(slot.isAvailable).toBe(false);
        
        slot.setAvailable(true);
        expect(slot.isAvailable).toBe(true);
      });
    });

    describe('markOccupied', () => {
      it('should mark slot as occupied', () => {
        slot.markOccupied();
        expect(slot.isAvailable).toBe(false);
      });
    });

    describe('markFree', () => {
      it('should mark slot as free', () => {
        slot.markOccupied();
        slot.markFree();
        expect(slot.isAvailable).toBe(true);
      });
    });
  });

  describe('updateTimes', () => {
    it('should update times with valid input', () => {
      const slot = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00');
      
      slot.updateTimes('10:00', '11:00');
      
      expect(slot.startTime).toBe('10:00');
      expect(slot.endTime).toBe('11:00');
    });

    it('should throw error for invalid times', () => {
      const slot = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00');
      
      expect(() => slot.updateTimes('11:00', '10:00')).toThrow('Invalid time slot');
    });
  });

  describe('time period methods', () => {
    describe('isMorning', () => {
      it('should return true for morning slots', () => {
        const slot = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00');
        expect(slot.isMorning()).toBe(true);
      });

      it('should return false for afternoon slots', () => {
        const slot = new TimeSlot(DayOfWeek.MONDAY, '13:00', '14:00');
        expect(slot.isMorning()).toBe(false);
      });
    });

    describe('isAfternoon', () => {
      it('should return true for afternoon slots', () => {
        const slot = new TimeSlot(DayOfWeek.MONDAY, '14:00', '15:00');
        expect(slot.isAfternoon()).toBe(true);
      });

      it('should return false for morning slots', () => {
        const slot = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00');
        expect(slot.isAfternoon()).toBe(false);
      });

      it('should return false for evening slots', () => {
        const slot = new TimeSlot(DayOfWeek.MONDAY, '18:00', '19:00');
        expect(slot.isAfternoon()).toBe(false);
      });
    });

    describe('isEvening', () => {
      it('should return true for evening slots', () => {
        const slot = new TimeSlot(DayOfWeek.MONDAY, '18:00', '19:00');
        expect(slot.isEvening()).toBe(true);
      });

      it('should return false for afternoon slots', () => {
        const slot = new TimeSlot(DayOfWeek.MONDAY, '14:00', '15:00');
        expect(slot.isEvening()).toBe(false);
      });
    });
  });

  describe('getSummary', () => {
    it('should return correct summary', () => {
      const slot = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:30');
      
      const summary = slot.getSummary();
      
      expect(summary).toContain('Monday');
      expect(summary).toContain('09:00-10:30');
      expect(summary).toContain('1.5h');
      expect(summary).toContain('Available');
    });

    it('should show occupied status', () => {
      const slot = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00', false);
      
      const summary = slot.getSummary();
      
      expect(summary).toContain('Occupied');
    });
  });

  describe('getDetails', () => {
    it('should return detailed information', () => {
      const slot = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:30');
      
      const details = slot.getDetails();
      
      expect(details).toContain('Day: Monday');
      expect(details).toContain('Time: 09:00 - 10:30');
      expect(details).toContain('Duration: 90 minutes (1.5 hours)');
      expect(details).toContain('Status: Available');
    });
  });

  describe('clone', () => {
    it('should create a deep copy', () => {
      const slot = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00', false);
      
      const cloned = slot.clone();
      
      expect(cloned.day).toBe(slot.day);
      expect(cloned.startTime).toBe(slot.startTime);
      expect(cloned.endTime).toBe(slot.endTime);
      expect(cloned.isAvailable).toBe(slot.isAvailable);
      expect(cloned).not.toBe(slot); // Different object reference
    });
  });

  describe('JSON serialization', () => {
    it('should convert to JSON correctly', () => {
      const slot = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00', false);
      
      const json = slot.toJSON();
      
      expect(json.day).toBe(slot.day);
      expect(json.startTime).toBe(slot.startTime);
      expect(json.endTime).toBe(slot.endTime);
      expect(json.isAvailable).toBe(slot.isAvailable);
    });

    it('should create from JSON correctly', () => {
      const data = {
        day: DayOfWeek.MONDAY,
        startTime: '09:00',
        endTime: '10:00',
        isAvailable: false
      };
      
      const slot = TimeSlot.fromJSON(data);
      
      expect(slot.day).toBe(data.day);
      expect(slot.startTime).toBe(data.startTime);
      expect(slot.endTime).toBe(data.endTime);
      expect(slot.isAvailable).toBe(data.isAvailable);
    });
  });

  describe('utility methods', () => {
    describe('compareTo', () => {
      it('should compare by day first', () => {
        const monday = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00');
        const tuesday = new TimeSlot(DayOfWeek.TUESDAY, '09:00', '10:00');
        
        expect(monday.compareTo(tuesday)).toBeLessThan(0);
        expect(tuesday.compareTo(monday)).toBeGreaterThan(0);
      });

      it('should compare by time when same day', () => {
        const early = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00');
        const late = new TimeSlot(DayOfWeek.MONDAY, '11:00', '12:00');
        
        expect(early.compareTo(late)).toBeLessThan(0);
        expect(late.compareTo(early)).toBeGreaterThan(0);
      });

      it('should return 0 for same day and time', () => {
        const slot1 = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00');
        const slot2 = new TimeSlot(DayOfWeek.MONDAY, '09:00', '11:00'); // Different end time
        
        expect(slot1.compareTo(slot2)).toBe(0); // Only compares day and start time
      });
    });

    describe('equals', () => {
      it('should return true for identical slots', () => {
        const slot1 = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00');
        const slot2 = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00');
        
        expect(slot1.equals(slot2)).toBe(true);
      });

      it('should return false for different slots', () => {
        const slot1 = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00');
        const slot2 = new TimeSlot(DayOfWeek.MONDAY, '09:00', '11:00');
        
        expect(slot1.equals(slot2)).toBe(false);
      });
    });

    describe('hashCode', () => {
      it('should return consistent hash code', () => {
        const slot = new TimeSlot(DayOfWeek.MONDAY, '09:00', '10:00');
        
        expect(slot.hashCode()).toBe('Monday_09:00_10:00');
      });
    });
  });

  describe('static factory methods', () => {
    describe('createForDuration', () => {
      it('should create slot with specified duration', () => {
        const slot = TimeSlot.createForDuration(DayOfWeek.MONDAY, '09:00', 90);
        
        expect(slot.day).toBe(DayOfWeek.MONDAY);
        expect(slot.startTime).toBe('09:00');
        expect(slot.endTime).toBe('10:30');
        expect(slot.lectureDuration).toBe(90);
      });
    });

    describe('createDaySlots', () => {
      it('should create multiple slots for a day', () => {
        const slots = TimeSlot.createDaySlots(
          DayOfWeek.MONDAY,
          '09:00',
          '12:00',
          60, // 1 hour slots
          15  // 15 minute breaks
        );
        
        expect(slots).toHaveLength(2); // 09:00-10:00, 10:15-11:15
        expect(slots[0].startTime).toBe('09:00');
        expect(slots[0].endTime).toBe('10:00');
        expect(slots[1].startTime).toBe('10:15');
        expect(slots[1].endTime).toBe('11:15');
      });

      it('should create slots without breaks', () => {
        const slots = TimeSlot.createDaySlots(
          DayOfWeek.MONDAY,
          '09:00',
          '11:00',
          60 // 1 hour slots, no breaks
        );
        
        expect(slots).toHaveLength(2); // 09:00-10:00, 10:00-11:00
        expect(slots[0].endTime).toBe('10:00');
        expect(slots[1].startTime).toBe('10:00');
      });

      it('should handle partial slots correctly', () => {
        const slots = TimeSlot.createDaySlots(
          DayOfWeek.MONDAY,
          '09:00',
          '10:30',
          60 // 1 hour slots
        );
        
        expect(slots).toHaveLength(1); // Only 09:00-10:00 fits
        expect(slots[0].startTime).toBe('09:00');
        expect(slots[0].endTime).toBe('10:00');
      });
    });
  });
});
