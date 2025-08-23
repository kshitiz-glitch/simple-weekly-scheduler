import { TimeSlotManager } from '../algorithms/TimeSlotManager';
import { TimeSlot, DayOfWeek } from '../models';

describe('TimeSlotManager - Holiday Functionality', () => {
  let timeSlotManager: TimeSlotManager;
  let sampleSlots: TimeSlot[];

  beforeEach(() => {
    timeSlotManager = new TimeSlotManager();
    
    // Create sample slots for Monday through Friday
    sampleSlots = [];
    const days = [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY];
    
    days.forEach(day => {
      for (let hour = 9; hour < 17; hour++) {
        sampleSlots.push({
          day,
          startTime: `${hour.toString().padStart(2, '0')}:00`,
          endTime: `${(hour + 1).toString().padStart(2, '0')}:00`,
          isAvailable: true
        });
      }
    });
  });

  describe('excludeHolidays', () => {
    it('should exclude slots on holiday days', () => {
      const holidays = [new Date('2024-01-01')]; // Monday
      
      // Mock Date.prototype.getDay to return Monday (1)
      const originalGetDay = Date.prototype.getDay;
      Date.prototype.getDay = jest.fn().mockReturnValue(1);

      const result = timeSlotManager.excludeHolidays(sampleSlots, holidays);
      
      // Should exclude all Monday slots
      const mondaySlots = result.filter(slot => slot.day === DayOfWeek.MONDAY);
      expect(mondaySlots).toHaveLength(0);
      
      // Should keep other day slots
      const tuesdaySlots = result.filter(slot => slot.day === DayOfWeek.TUESDAY);
      expect(tuesdaySlots.length).toBeGreaterThan(0);

      // Restore original method
      Date.prototype.getDay = originalGetDay;
    });

    it('should handle multiple holidays on different days', () => {
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

      const result = timeSlotManager.excludeHolidays(sampleSlots, holidays);
      
      // Should exclude Monday and Wednesday slots
      const mondaySlots = result.filter(slot => slot.day === DayOfWeek.MONDAY);
      const wednesdaySlots = result.filter(slot => slot.day === DayOfWeek.WEDNESDAY);
      expect(mondaySlots).toHaveLength(0);
      expect(wednesdaySlots).toHaveLength(0);
      
      // Should keep other day slots
      const tuesdaySlots = result.filter(slot => slot.day === DayOfWeek.TUESDAY);
      expect(tuesdaySlots.length).toBeGreaterThan(0);

      // Restore original method
      Date.prototype.getDay = originalGetDay;
    });

    it('should return original slots when no holidays', () => {
      const result = timeSlotManager.excludeHolidays(sampleSlots, []);
      expect(result).toEqual(sampleSlots);
    });

    it('should handle empty slots array', () => {
      const holidays = [new Date('2024-01-01')];
      const result = timeSlotManager.excludeHolidays([], holidays);
      expect(result).toEqual([]);
    });
  });

  describe('getHolidayExclusionInfo', () => {
    it('should provide detailed holiday exclusion information', () => {
      const holidays = [new Date('2024-01-01')]; // Monday
      
      // Mock Date.prototype.getDay to return Monday (1)
      const originalGetDay = Date.prototype.getDay;
      Date.prototype.getDay = jest.fn().mockReturnValue(1);

      const result = timeSlotManager.getHolidayExclusionInfo(sampleSlots, holidays);
      
      expect(result.affectedDays).toContain(DayOfWeek.MONDAY);
      expect(result.holidaysByDay.has(DayOfWeek.MONDAY)).toBe(true);
      expect(result.totalSlotsLost).toBeGreaterThan(0);
      
      // Should exclude all Monday slots
      const mondaySlotCount = sampleSlots.filter(slot => slot.day === DayOfWeek.MONDAY).length;
      expect(result.totalSlotsLost).toBe(mondaySlotCount);

      // Restore original method
      Date.prototype.getDay = originalGetDay;
    });

    it('should handle multiple holidays on same day', () => {
      const holidays = [
        new Date('2024-01-01'), // Monday
        new Date('2024-01-08')  // Another Monday
      ];
      
      // Mock Date.prototype.getDay to return Monday (1) for both
      const originalGetDay = Date.prototype.getDay;
      Date.prototype.getDay = jest.fn().mockReturnValue(1);

      const result = timeSlotManager.getHolidayExclusionInfo(sampleSlots, holidays);
      
      expect(result.affectedDays).toContain(DayOfWeek.MONDAY);
      expect(result.affectedDays).toHaveLength(1); // Should not duplicate days
      expect(result.holidaysByDay.get(DayOfWeek.MONDAY)).toHaveLength(2);

      // Restore original method
      Date.prototype.getDay = originalGetDay;
    });

    it('should return empty info when no holidays', () => {
      const result = timeSlotManager.getHolidayExclusionInfo(sampleSlots, []);
      
      expect(result.affectedDays).toHaveLength(0);
      expect(result.excludedSlots).toHaveLength(0);
      expect(result.totalSlotsLost).toBe(0);
      expect(result.holidaysByDay.size).toBe(0);
    });
  });

  describe('findHolidayAlternatives', () => {
    it('should find alternative slots for holiday-affected lectures', () => {
      const holidays = [new Date('2024-01-01')]; // Monday
      const requiredDuration = 60; // 1 hour
      
      // Mock Date.prototype.getDay to return Monday (1)
      const originalGetDay = Date.prototype.getDay;
      Date.prototype.getDay = jest.fn().mockReturnValue(1);

      const result = timeSlotManager.findHolidayAlternatives(
        sampleSlots,
        holidays,
        requiredDuration
      );
      
      expect(result.availableAlternatives).toBeDefined();
      expect(result.suggestedRescheduling).toBeDefined();
      
      // Should have alternatives from non-holiday days
      const hasNonMondayAlternatives = result.availableAlternatives.some(
        slot => slot.day !== DayOfWeek.MONDAY
      );
      expect(hasNonMondayAlternatives).toBe(true);
      
      // Should have rescheduling suggestions for Monday
      const mondayRescheduling = result.suggestedRescheduling.find(
        suggestion => suggestion.originalDay === DayOfWeek.MONDAY
      );
      expect(mondayRescheduling).toBeDefined();
      expect(mondayRescheduling?.alternativeSlots.length).toBeGreaterThan(0);

      // Restore original method
      Date.prototype.getDay = originalGetDay;
    });

    it('should limit alternative suggestions to 5 per day', () => {
      const holidays = [new Date('2024-01-01')]; // Monday
      const requiredDuration = 60;
      
      // Mock Date.prototype.getDay to return Monday (1)
      const originalGetDay = Date.prototype.getDay;
      Date.prototype.getDay = jest.fn().mockReturnValue(1);

      const result = timeSlotManager.findHolidayAlternatives(
        sampleSlots,
        holidays,
        requiredDuration
      );
      
      result.suggestedRescheduling.forEach(suggestion => {
        expect(suggestion.alternativeSlots.length).toBeLessThanOrEqual(5);
      });

      // Restore original method
      Date.prototype.getDay = originalGetDay;
    });

    it('should handle multiple holiday days', () => {
      const holidays = [
        new Date('2024-01-01'), // Monday
        new Date('2024-01-03')  // Wednesday
      ];
      const requiredDuration = 60;
      
      // Mock Date.prototype.getDay to return appropriate days
      const originalGetDay = Date.prototype.getDay;
      let callCount = 0;
      Date.prototype.getDay = jest.fn().mockImplementation(() => {
        callCount++;
        return callCount === 1 ? 1 : 3; // Monday then Wednesday
      });

      const result = timeSlotManager.findHolidayAlternatives(
        sampleSlots,
        holidays,
        requiredDuration
      );
      
      // Should have rescheduling suggestions for both Monday and Wednesday
      const mondayRescheduling = result.suggestedRescheduling.find(
        suggestion => suggestion.originalDay === DayOfWeek.MONDAY
      );
      const wednesdayRescheduling = result.suggestedRescheduling.find(
        suggestion => suggestion.originalDay === DayOfWeek.WEDNESDAY
      );
      
      expect(mondayRescheduling).toBeDefined();
      expect(wednesdayRescheduling).toBeDefined();

      // Restore original method
      Date.prototype.getDay = originalGetDay;
    });

    it('should filter alternatives by required duration', () => {
      const holidays = [new Date('2024-01-01')]; // Monday
      const requiredDuration = 120; // 2 hours
      
      // Create slots with different durations
      const mixedDurationSlots = [
        ...sampleSlots, // 1-hour slots
        {
          day: DayOfWeek.TUESDAY,
          startTime: '14:00',
          endTime: '16:00', // 2-hour slot
          isAvailable: true
        }
      ];
      
      // Mock Date.prototype.getDay to return Monday (1)
      const originalGetDay = Date.prototype.getDay;
      Date.prototype.getDay = jest.fn().mockReturnValue(1);

      const result = timeSlotManager.findHolidayAlternatives(
        mixedDurationSlots,
        holidays,
        requiredDuration
      );
      
      // All alternatives should be at least 2 hours long
      result.availableAlternatives.forEach(slot => {
        const startMinutes = parseInt(slot.startTime.split(':')[0]) * 60 + 
                            parseInt(slot.startTime.split(':')[1]);
        const endMinutes = parseInt(slot.endTime.split(':')[0]) * 60 + 
                          parseInt(slot.endTime.split(':')[1]);
        const duration = endMinutes - startMinutes;
        expect(duration).toBeGreaterThanOrEqual(requiredDuration);
      });

      // Restore original method
      Date.prototype.getDay = originalGetDay;
    });
  });

  describe('edge cases', () => {
    it('should handle weekend holidays', () => {
      const holidays = [new Date('2024-01-06')]; // Saturday
      
      // Mock Date.prototype.getDay to return Saturday (6)
      const originalGetDay = Date.prototype.getDay;
      Date.prototype.getDay = jest.fn().mockReturnValue(6);

      const result = timeSlotManager.excludeHolidays(sampleSlots, holidays);
      
      // Should not affect weekday slots since Saturday is not in working days
      expect(result).toEqual(sampleSlots);

      // Restore original method
      Date.prototype.getDay = originalGetDay;
    });

    it('should handle invalid dates', () => {
      const invalidDate = new Date('invalid');
      const holidays = [invalidDate];
      
      // This should not crash the system
      expect(() => {
        timeSlotManager.excludeHolidays(sampleSlots, holidays);
      }).not.toThrow();
    });

    it('should handle very long duration requirements', () => {
      const holidays = [new Date('2024-01-01')]; // Monday
      const requiredDuration = 480; // 8 hours (longer than any single slot)
      
      // Mock Date.prototype.getDay to return Monday (1)
      const originalGetDay = Date.prototype.getDay;
      Date.prototype.getDay = jest.fn().mockReturnValue(1);

      const result = timeSlotManager.findHolidayAlternatives(
        sampleSlots,
        holidays,
        requiredDuration
      );
      
      // Should return empty alternatives since no slot is 8 hours long
      expect(result.availableAlternatives).toHaveLength(0);

      // Restore original method
      Date.prototype.getDay = originalGetDay;
    });

    it('should handle all days being holidays', () => {
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

      const result = timeSlotManager.excludeHolidays(sampleSlots, holidays);
      
      // Should exclude all slots
      expect(result).toHaveLength(0);

      // Restore original method
      Date.prototype.getDay = originalGetDay;
    });
  });
});
