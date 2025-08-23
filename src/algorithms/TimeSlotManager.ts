import { TimeSlotManager as ITimeSlotManager } from './index';
import { TimeSlot, DayOfWeek, ScheduleEntry } from '../models';
import { TimeUtils } from '../utils';

export class TimeSlotManager implements ITimeSlotManager {
  
  /**
   * Initialize time slots for the given parameters
   */
  initializeSlots(
    workingDays: string[],
    startTime: string,
    endTime: string,
    slotDuration: number
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];

    workingDays.forEach(dayStr => {
      const day = this.stringToDayOfWeek(dayStr);
      if (day) {
        const daySlots = this.createDaySlots(day, startTime, endTime, slotDuration);
        slots.push(...daySlots);
      }
    });

    return slots;
  }

  /**
   * Exclude holidays from available slots with detailed tracking
   */
  excludeHolidays(slots: TimeSlot[], holidays: Date[]): TimeSlot[] {
    if (holidays.length === 0) {
      return slots;
    }

    // Create a map of holiday dates for more precise exclusion
    const holidayMap = new Map<string, Date[]>();
    
    holidays.forEach(holiday => {
      const dayOfWeek = this.getDateDayOfWeek(holiday);
      const dayKey = dayOfWeek.toString();
      
      if (!holidayMap.has(dayKey)) {
        holidayMap.set(dayKey, []);
      }
      holidayMap.get(dayKey)!.push(holiday);
    });

    // Filter out slots that fall on holiday days
    return slots.filter(slot => {
      const dayKey = slot.day.toString();
      return !holidayMap.has(dayKey);
    });
  }

  /**
   * Get detailed information about excluded holidays
   */
  getHolidayExclusionInfo(slots: TimeSlot[], holidays: Date[]): {
    excludedSlots: TimeSlot[];
    affectedDays: DayOfWeek[];
    holidaysByDay: Map<DayOfWeek, Date[]>;
    totalSlotsLost: number;
  } {
    const excludedSlots: TimeSlot[] = [];
    const affectedDays: DayOfWeek[] = [];
    const holidaysByDay = new Map<DayOfWeek, Date[]>();

    holidays.forEach(holiday => {
      const dayOfWeek = this.getDateDayOfWeek(holiday);
      
      if (!holidaysByDay.has(dayOfWeek)) {
        holidaysByDay.set(dayOfWeek, []);
        affectedDays.push(dayOfWeek);
      }
      holidaysByDay.get(dayOfWeek)!.push(holiday);
    });

    // Find all slots that would be excluded
    slots.forEach(slot => {
      if (holidaysByDay.has(slot.day)) {
        excludedSlots.push(slot);
      }
    });

    return {
      excludedSlots,
      affectedDays,
      holidaysByDay,
      totalSlotsLost: excludedSlots.length
    };
  }

  /**
   * Find alternative slots for holiday-affected lectures
   */
  findHolidayAlternatives(
    originalSlots: TimeSlot[],
    holidays: Date[],
    requiredDuration: number
  ): {
    availableAlternatives: TimeSlot[];
    suggestedRescheduling: {
      originalDay: DayOfWeek;
      alternativeSlots: TimeSlot[];
    }[];
  } {
    const workingSlots = this.excludeHolidays(originalSlots, holidays);
    const availableAlternatives = this.findAvailableSlots(workingSlots, requiredDuration);
    
    const holidayInfo = this.getHolidayExclusionInfo(originalSlots, holidays);
    const suggestedRescheduling: {
      originalDay: DayOfWeek;
      alternativeSlots: TimeSlot[];
    }[] = [];

    // For each affected day, suggest alternatives
    holidayInfo.affectedDays.forEach(affectedDay => {
      const alternativesForDay = availableAlternatives.filter(slot => 
        slot.day !== affectedDay
      );
      
      suggestedRescheduling.push({
        originalDay: affectedDay,
        alternativeSlots: alternativesForDay.slice(0, 5) // Top 5 alternatives
      });
    });

    return {
      availableAlternatives,
      suggestedRescheduling
    };
  }

  /**
   * Find available slots that can accommodate the given duration
   */
  findAvailableSlots(slots: TimeSlot[], duration: number): TimeSlot[] {
    return slots.filter(slot => {
      if (!slot.isAvailable) {
        return false;
      }

      const slotDuration = this.calculateSlotDuration(slot);
      return slotDuration >= duration;
    });
  }

  /**
   * Check if a slot is available (not occupied by existing schedule entries)
   */
  isSlotAvailable(slot: TimeSlot, existing: ScheduleEntry[]): boolean {
    if (!slot.isAvailable) {
      return false;
    }

    // Check if any existing entry conflicts with this slot
    return !existing.some(entry => this.slotsOverlap(slot, entry.timeSlot));
  }

  /**
   * Create time slots for a specific day
   */
  private createDaySlots(
    day: DayOfWeek,
    startTime: string,
    endTime: string,
    slotDuration: number,
    breakDuration: number = 0
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    let currentTime = startTime;
    const endMinutes = this.timeToMinutes(endTime);

    while (true) {
      const currentMinutes = this.timeToMinutes(currentTime);
      const slotEndMinutes = currentMinutes + slotDuration;

      // Check if the slot would exceed the end time
      if (slotEndMinutes > endMinutes) {
        break;
      }

      const slotEndTime = this.minutesToTime(slotEndMinutes);
      
      slots.push({
        day,
        startTime: currentTime,
        endTime: slotEndTime,
        isAvailable: true
      });

      // Move to next slot (including break time)
      const nextSlotMinutes = slotEndMinutes + breakDuration;
      currentTime = this.minutesToTime(nextSlotMinutes);
    }

    return slots;
  }

  /**
   * Check if two time slots overlap
   */
  private slotsOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
    if (slot1.day !== slot2.day) {
      return false;
    }

    const start1 = this.timeToMinutes(slot1.startTime);
    const end1 = this.timeToMinutes(slot1.endTime);
    const start2 = this.timeToMinutes(slot2.startTime);
    const end2 = this.timeToMinutes(slot2.endTime);

    return start1 < end2 && start2 < end1;
  }

  /**
   * Calculate duration of a time slot in minutes
   */
  private calculateSlotDuration(slot: TimeSlot): number {
    const startMinutes = this.timeToMinutes(slot.startTime);
    const endMinutes = this.timeToMinutes(slot.endTime);
    return endMinutes - startMinutes;
  }

  /**
   * Convert time string to minutes since midnight
   */
  private timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Convert minutes to time string
   */
  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Convert string to DayOfWeek enum
   */
  private stringToDayOfWeek(dayStr: string): DayOfWeek | null {
    const normalizedDay = dayStr.toLowerCase();
    
    switch (normalizedDay) {
      case 'monday':
        return DayOfWeek.MONDAY;
      case 'tuesday':
        return DayOfWeek.TUESDAY;
      case 'wednesday':
        return DayOfWeek.WEDNESDAY;
      case 'thursday':
        return DayOfWeek.THURSDAY;
      case 'friday':
        return DayOfWeek.FRIDAY;
      case 'saturday':
        return DayOfWeek.SATURDAY;
      case 'sunday':
        return DayOfWeek.SUNDAY;
      default:
        return null;
    }
  }

  /**
   * Get day of week from a date
   */
  private getDateDayOfWeek(date: Date): DayOfWeek {
    const dayIndex = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    switch (dayIndex) {
      case 0: return DayOfWeek.SUNDAY;
      case 1: return DayOfWeek.MONDAY;
      case 2: return DayOfWeek.TUESDAY;
      case 3: return DayOfWeek.WEDNESDAY;
      case 4: return DayOfWeek.THURSDAY;
      case 5: return DayOfWeek.FRIDAY;
      case 6: return DayOfWeek.SATURDAY;
      default: return DayOfWeek.MONDAY; // fallback
    }
  }

  /**
   * Get all time slots for a specific day
   */
  getSlotsForDay(slots: TimeSlot[], day: DayOfWeek): TimeSlot[] {
    return slots.filter(slot => slot.day === day);
  }

  /**
   * Get time slots within a specific time range
   */
  getSlotsInTimeRange(
    slots: TimeSlot[],
    startTime: string,
    endTime: string
  ): TimeSlot[] {
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    return slots.filter(slot => {
      const slotStart = this.timeToMinutes(slot.startTime);
      const slotEnd = this.timeToMinutes(slot.endTime);
      
      // Slot must be completely within the time range
      return slotStart >= startMinutes && slotEnd <= endMinutes;
    });
  }

  /**
   * Mark time slots as occupied
   */
  markSlotsOccupied(slots: TimeSlot[], occupiedSlots: TimeSlot[]): void {
    occupiedSlots.forEach(occupiedSlot => {
      const matchingSlot = slots.find(slot => 
        slot.day === occupiedSlot.day &&
        slot.startTime === occupiedSlot.startTime &&
        slot.endTime === occupiedSlot.endTime
      );
      
      if (matchingSlot) {
        matchingSlot.isAvailable = false;
      }
    });
  }

  /**
   * Reset all slots to available
   */
  resetSlotAvailability(slots: TimeSlot[]): void {
    slots.forEach(slot => {
      slot.isAvailable = true;
    });
  }

  /**
   * Get slot utilization statistics
   */
  getSlotUtilization(slots: TimeSlot[]): {
    total: number;
    available: number;
    occupied: number;
    utilizationRate: number;
  } {
    const total = slots.length;
    const available = slots.filter(slot => slot.isAvailable).length;
    const occupied = total - available;
    const utilizationRate = total > 0 ? occupied / total : 0;

    return {
      total,
      available,
      occupied,
      utilizationRate: Math.round(utilizationRate * 1000) / 10 // Round to 1 decimal place
    };
  }

  /**
   * Find the next available slot after a given time
   */
  findNextAvailableSlot(
    slots: TimeSlot[],
    afterTime: { day: DayOfWeek; time: string },
    duration: number
  ): TimeSlot | null {
    const afterMinutes = this.timeToMinutes(afterTime.time);
    
    // Sort slots by day and time
    const sortedSlots = [...slots].sort((a, b) => {
      const dayOrder = Object.values(DayOfWeek);
      const dayA = dayOrder.indexOf(a.day);
      const dayB = dayOrder.indexOf(b.day);
      
      if (dayA !== dayB) {
        return dayA - dayB;
      }
      
      return this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime);
    });

    // Find first available slot after the given time
    for (const slot of sortedSlots) {
      const dayOrder = Object.values(DayOfWeek);
      const slotDayIndex = dayOrder.indexOf(slot.day);
      const afterDayIndex = dayOrder.indexOf(afterTime.day);
      const slotStartMinutes = this.timeToMinutes(slot.startTime);

      // Check if slot is after the specified time
      const isAfterTime = slotDayIndex > afterDayIndex || 
        (slotDayIndex === afterDayIndex && slotStartMinutes > afterMinutes);

      if (isAfterTime && slot.isAvailable && this.calculateSlotDuration(slot) >= duration) {
        return slot;
      }
    }

    return null;
  }

  /**
   * Group slots by day
   */
  groupSlotsByDay(slots: TimeSlot[]): Map<DayOfWeek, TimeSlot[]> {
    const grouped = new Map<DayOfWeek, TimeSlot[]>();

    slots.forEach(slot => {
      if (!grouped.has(slot.day)) {
        grouped.set(slot.day, []);
      }
      grouped.get(slot.day)!.push(slot);
    });

    // Sort slots within each day
    grouped.forEach((daySlots, day) => {
      daySlots.sort((a, b) => a.startTime.localeCompare(b.startTime));
    });

    return grouped;
  }
}
