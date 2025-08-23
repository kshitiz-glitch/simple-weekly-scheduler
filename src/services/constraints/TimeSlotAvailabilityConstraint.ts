import { ConstraintViolation, ScheduleEntry, DayOfWeek } from '../../models';
import { BaseConstraint } from './BaseConstraint';

/**
 * Constraint to ensure lectures are only scheduled during available time slots and working days
 */
export class TimeSlotAvailabilityConstraint extends BaseConstraint {
  private holidays: Set<string>; // Dates in YYYY-MM-DD format
  private workingDays: Set<DayOfWeek>;
  private workingHours: { start: string; end: string };
  private excludedTimeSlots: Set<string>; // Day_StartTime_EndTime format

  constructor(
    holidays: Date[] = [],
    workingDays: DayOfWeek[] = [
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY
    ],
    workingHours: { start: string; end: string } = { start: '08:00', end: '18:00' },
    priority: number = 90
  ) {
    super(
      'timeslot-availability',
      'Lectures can only be scheduled during available time slots and working days',
      priority
    );

    this.holidays = new Set(holidays.map(date => this.formatDate(date)));
    this.workingDays = new Set(workingDays);
    this.workingHours = workingHours;
    this.excludedTimeSlots = new Set();
  }

  /**
   * Validate that the time slot is available
   */
  validate(entry: ScheduleEntry, existing: ScheduleEntry[]): ConstraintViolation | null {
    if (!this.isEnabled) {
      return null;
    }

    const violations: string[] = [];

    // Check if day is a working day
    if (!this.workingDays.has(entry.timeSlot.day)) {
      violations.push(`${entry.timeSlot.day} is not a working day`);
    }

    // Check if time is within working hours
    if (!this.isWithinWorkingHours(entry.timeSlot.startTime, entry.timeSlot.endTime)) {
      violations.push(
        `Time slot ${entry.timeSlot.startTime}-${entry.timeSlot.endTime} is outside working hours ` +
        `(${this.workingHours.start}-${this.workingHours.end})`
      );
    }

    // Check if time slot is explicitly excluded
    const slotKey = this.getTimeSlotKey(entry.timeSlot);
    if (this.excludedTimeSlots.has(slotKey)) {
      violations.push(`Time slot ${slotKey} is explicitly excluded`);
    }

    // Check if the time slot is available (not occupied by another lecture)
    if (!entry.timeSlot.isAvailable) {
      violations.push(`Time slot is marked as unavailable`);
    }

    if (violations.length > 0) {
      return this.createViolation(
        `Time slot availability violation: ${violations.join('; ')}`,
        [entry],
        'error'
      );
    }

    return null;
  }

  /**
   * Check if a specific date is a holiday
   */
  isHoliday(date: Date): boolean {
    return this.holidays.has(this.formatDate(date));
  }

  /**
   * Add a holiday
   */
  addHoliday(date: Date): void {
    this.holidays.add(this.formatDate(date));
  }

  /**
   * Remove a holiday
   */
  removeHoliday(date: Date): void {
    this.holidays.delete(this.formatDate(date));
  }

  /**
   * Get all holidays
   */
  getHolidays(): Date[] {
    return Array.from(this.holidays).map(dateStr => new Date(dateStr + 'T00:00:00.000Z'));
  }

  /**
   * Set working days
   */
  setWorkingDays(days: DayOfWeek[]): void {
    this.workingDays = new Set(days);
  }

  /**
   * Get working days
   */
  getWorkingDays(): DayOfWeek[] {
    return Array.from(this.workingDays);
  }

  /**
   * Check if a day is a working day
   */
  isWorkingDay(day: DayOfWeek): boolean {
    return this.workingDays.has(day);
  }

  /**
   * Set working hours
   */
  setWorkingHours(start: string, end: string): void {
    if (!this.isValidTimeFormat(start) || !this.isValidTimeFormat(end)) {
      throw new Error('Invalid time format. Use HH:MM format.');
    }
    
    if (this.timeToMinutes(start) >= this.timeToMinutes(end)) {
      throw new Error('Start time must be before end time');
    }

    this.workingHours = { start, end };
  }

  /**
   * Get working hours
   */
  getWorkingHours(): { start: string; end: string } {
    return { ...this.workingHours };
  }

  /**
   * Exclude a specific time slot
   */
  excludeTimeSlot(day: DayOfWeek, startTime: string, endTime: string): void {
    const slotKey = `${day}_${startTime}_${endTime}`;
    this.excludedTimeSlots.add(slotKey);
  }

  /**
   * Include a previously excluded time slot
   */
  includeTimeSlot(day: DayOfWeek, startTime: string, endTime: string): void {
    const slotKey = `${day}_${startTime}_${endTime}`;
    this.excludedTimeSlots.delete(slotKey);
  }

  /**
   * Check if a time slot is excluded
   */
  isTimeSlotExcluded(day: DayOfWeek, startTime: string, endTime: string): boolean {
    const slotKey = `${day}_${startTime}_${endTime}`;
    return this.excludedTimeSlots.has(slotKey);
  }

  /**
   * Get all excluded time slots
   */
  getExcludedTimeSlots(): { day: DayOfWeek; startTime: string; endTime: string }[] {
    return Array.from(this.excludedTimeSlots).map(slotKey => {
      const [day, startTime, endTime] = slotKey.split('_');
      return { day: day as DayOfWeek, startTime, endTime };
    });
  }

  /**
   * Check if time range is within working hours
   */
  isWithinWorkingHours(startTime: string, endTime: string): boolean {
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);
    const workStartMinutes = this.timeToMinutes(this.workingHours.start);
    const workEndMinutes = this.timeToMinutes(this.workingHours.end);

    return startMinutes >= workStartMinutes && endMinutes <= workEndMinutes;
  }

  /**
   * Get available time slots for a specific day
   */
  getAvailableTimeSlotsForDay(
    day: DayOfWeek,
    slotDuration: number,
    existing: ScheduleEntry[] = []
  ): { startTime: string; endTime: string }[] {
    if (!this.isWorkingDay(day)) {
      return [];
    }

    const availableSlots: { startTime: string; endTime: string }[] = [];
    const workStartMinutes = this.timeToMinutes(this.workingHours.start);
    const workEndMinutes = this.timeToMinutes(this.workingHours.end);

    // Get occupied time slots for this day
    const occupiedSlots = existing
      .filter(entry => entry.timeSlot.day === day)
      .map(entry => ({
        start: this.timeToMinutes(entry.timeSlot.startTime),
        end: this.timeToMinutes(entry.timeSlot.endTime)
      }))
      .sort((a, b) => a.start - b.start);

    let currentTime = workStartMinutes;

    // Check each potential slot
    while (currentTime + slotDuration <= workEndMinutes) {
      const slotEnd = currentTime + slotDuration;
      
      // Check if this slot conflicts with any occupied slot
      const hasConflict = occupiedSlots.some(occupied => 
        currentTime < occupied.end && slotEnd > occupied.start
      );

      if (!hasConflict) {
        const startTime = this.minutesToTime(currentTime);
        const endTime = this.minutesToTime(slotEnd);
        
        // Check if this slot is explicitly excluded
        if (!this.isTimeSlotExcluded(day, startTime, endTime)) {
          availableSlots.push({ startTime, endTime });
        }
      }

      currentTime += 30; // Check every 30 minutes
    }

    return availableSlots;
  }

  /**
   * Get total available hours per week
   */
  getTotalAvailableHoursPerWeek(): number {
    const workingDayCount = this.workingDays.size;
    const hoursPerDay = (this.timeToMinutes(this.workingHours.end) - 
                        this.timeToMinutes(this.workingHours.start)) / 60;
    return workingDayCount * hoursPerDay;
  }

  /**
   * Clone this constraint
   */
  clone(): TimeSlotAvailabilityConstraint {
    const cloned = new TimeSlotAvailabilityConstraint(
      this.getHolidays(),
      this.getWorkingDays(),
      this.getWorkingHours(),
      this.priority
    );
    
    cloned.setEnabled(this.isEnabled);
    
    // Copy excluded time slots
    this.excludedTimeSlots.forEach(slotKey => {
      const [day, startTime, endTime] = slotKey.split('_');
      cloned.excludeTimeSlot(day as DayOfWeek, startTime, endTime);
    });

    return cloned;
  }

  /**
   * Format date to YYYY-MM-DD string
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get time slot key for exclusion tracking
   */
  private getTimeSlotKey(timeSlot: { day: DayOfWeek; startTime: string; endTime: string }): string {
    return `${timeSlot.day}_${timeSlot.startTime}_${timeSlot.endTime}`;
  }

  /**
   * Check if time format is valid (HH:MM)
   */
  private isValidTimeFormat(time: string): boolean {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
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
   * Get constraint configuration including holidays and working hours
   */
  getDetailedConfiguration(): {
    type: string;
    description: string;
    priority: number;
    enabled: boolean;
    holidays: string[];
    workingDays: string[];
    workingHours: { start: string; end: string };
    excludedTimeSlots: { day: string; startTime: string; endTime: string }[];
  } {
    const baseConfig = this.getConfiguration();
    return {
      ...baseConfig,
      holidays: Array.from(this.holidays),
      workingDays: Array.from(this.workingDays),
      workingHours: { ...this.workingHours },
      excludedTimeSlots: this.getExcludedTimeSlots()
    };
  }
}
