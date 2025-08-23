import { TimeSlot as ITimeSlot, DayOfWeek, ValidationResult } from './index';
import { TimeUtils } from '../utils';

export class TimeSlot implements ITimeSlot {
  public day: DayOfWeek;
  public startTime: string; // HH:MM format
  public endTime: string;   // HH:MM format
  public isAvailable: boolean;

  constructor(day: DayOfWeek, startTime: string, endTime: string, isAvailable: boolean = true) {
    this.day = day;
    this.startTime = startTime;
    this.endTime = endTime;
    this.isAvailable = isAvailable;

    const validation = this.validate();
    if (!validation.isValid) {
      throw new Error(`Invalid time slot: ${validation.errors.join(', ')}`);
    }
  }

  /**
   * Validate the time slot
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate time format
    if (!this.isValidTimeFormat(this.startTime)) {
      errors.push('Start time must be in HH:MM format');
    }

    if (!this.isValidTimeFormat(this.endTime)) {
      errors.push('End time must be in HH:MM format');
    }

    // Validate time range
    if (this.isValidTimeFormat(this.startTime) && this.isValidTimeFormat(this.endTime)) {
      if (!this.isValidTimeRange()) {
        errors.push('End time must be after start time');
      }

      const duration = this.lectureDuration;
      if (duration < 30) {
        errors.push('Time slot duration must be at least 30 minutes');
      }

      if (duration > 240) { // 4 hours
        warnings.push('Time slot duration exceeds 4 hours, which may be too long');
      }
    }

    // Validate day
    if (!Object.values(DayOfWeek).includes(this.day)) {
      errors.push('Invalid day of week');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if time format is valid (HH:MM)
   */
  private isValidTimeFormat(time: string): boolean {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  /**
   * Check if time range is valid (end time after start time)
   */
  private isValidTimeRange(): boolean {
    const startMinutes = this.timeToMinutes(this.startTime);
    const endMinutes = this.timeToMinutes(this.endTime);
    return endMinutes > startMinutes;
  }

  /**
   * Convert time string to minutes since midnight
   */
  private timeToMinutes(timeStr: string): number {
    const { hours, minutes } = TimeUtils.parseTime(timeStr);
    return hours * 60 + minutes;
  }

  /**
   * Get duration of this time slot in minutes
   */
  getDurationMinutes(): number {
    const startMinutes = this.timeToMinutes(this.startTime);
    const endMinutes = this.timeToMinutes(this.endTime);
    return endMinutes - startMinutes;
  }

  /**
   * Get duration of this time slot in hours
   */
  getDurationHours(): number {
    return Math.round(this.lectureDuration / 60 * 10) / 10;
  }

  /**
   * Check if this time slot can accommodate a lecture of given duration
   */
  canAccommodate(lectureDurationMinutes: number): boolean {
    return this.isAvailable && this.lectureDuration >= lectureDurationMinutes;
  }

  /**
   * Check if this time slot overlaps with another time slot
   */
  overlapsWith(other: TimeSlot): boolean {
    if (this.day !== other.day) {
      return false;
    }

    const thisStart = this.timeToMinutes(this.startTime);
    const thisEnd = this.timeToMinutes(this.endTime);
    const otherStart = this.timeToMinutes(other.startTime);
    const otherEnd = this.timeToMinutes(other.endTime);

    return thisStart < otherEnd && thisEnd > otherStart;
  }

  /**
   * Check if this time slot is adjacent to another time slot
   */
  isAdjacentTo(other: TimeSlot): boolean {
    if (this.day !== other.day) {
      return false;
    }

    const thisStart = this.timeToMinutes(this.startTime);
    const thisEnd = this.timeToMinutes(this.endTime);
    const otherStart = this.timeToMinutes(other.startTime);
    const otherEnd = this.timeToMinutes(other.endTime);

    return thisEnd === otherStart || thisStart === otherEnd;
  }

  /**
   * Check if this time slot contains a specific time
   */
  containsTime(time: string): boolean {
    if (!this.isValidTimeFormat(time)) {
      return false;
    }

    const timeMinutes = this.timeToMinutes(time);
    const startMinutes = this.timeToMinutes(this.startTime);
    const endMinutes = this.timeToMinutes(this.endTime);

    return timeMinutes >= startMinutes && timeMinutes < endMinutes;
  }

  /**
   * Set availability status
   */
  setAvailable(available: boolean): void {
    this.isAvailable = available;
  }

  /**
   * Mark time slot as occupied
   */
  markOccupied(): void {
    this.setAvailable(false);
  }

  /**
   * Mark time slot as free
   */
  markFree(): void {
    this.setAvailable(true);
  }

  /**
   * Update time slot times with validation
   */
  updateTimes(startTime: string, endTime: string): void {
    const tempSlot = new TimeSlot(this.day, startTime, endTime, this.isAvailable);
    // If validation passes, update the times
    this.startTime = startTime;
    this.endTime = endTime;
  }

  /**
   * Get time slot summary
   */
  getSummary(): string {
    const duration = this.getDurationHours();
    const status = this.isAvailable ? 'Available' : 'Occupied';
    return `${this.day} ${this.startTime}-${this.endTime} (${duration}h) - ${status}`;
  }

  /**
   * Get detailed time slot information
   */
  getDetails(): string {
    return [
      `Day: ${this.day}`,
      `Time: ${this.startTime} - ${this.endTime}`,
      `Duration: ${this.lectureDuration} minutes (${this.getDurationHours()} hours)`,
      `Status: ${this.isAvailable ? 'Available' : 'Occupied'}`
    ].join('\n');
  }

  /**
   * Check if this is a morning time slot (before 12:00)
   */
  isMorning(): boolean {
    const startMinutes = this.timeToMinutes(this.startTime);
    return startMinutes < 12 * 60; // Before 12:00
  }

  /**
   * Check if this is an afternoon time slot (12:00 - 17:00)
   */
  isAfternoon(): boolean {
    const startMinutes = this.timeToMinutes(this.startTime);
    return startMinutes >= 12 * 60 && startMinutes < 17 * 60;
  }

  /**
   * Check if this is an evening time slot (after 17:00)
   */
  isEvening(): boolean {
    const startMinutes = this.timeToMinutes(this.startTime);
    return startMinutes >= 17 * 60;
  }

  /**
   * Create a copy of this time slot
   */
  clone(): TimeSlot {
    return new TimeSlot(this.day, this.startTime, this.endTime, this.isAvailable);
  }

  /**
   * Convert to plain object
   */
  toJSON(): ITimeSlot {
    return {
      day: this.day,
      startTime: this.startTime,
      endTime: this.endTime,
      isAvailable: this.isAvailable
    };
  }

  /**
   * Create time slot from plain object
   */
  static fromJSON(data: ITimeSlot): TimeSlot {
    return new TimeSlot(data.day, data.startTime, data.endTime, data.isAvailable);
  }

  /**
   * Compare time slots for sorting (by day, then by start time)
   */
  compareTo(other: TimeSlot): number {
    // First compare by day
    const dayOrder = Object.values(DayOfWeek);
    const thisDayIndex = dayOrder.indexOf(this.day);
    const otherDayIndex = dayOrder.indexOf(other.day);
    
    if (thisDayIndex !== otherDayIndex) {
      return thisDayIndex - otherDayIndex;
    }

    // Then compare by start time
    const thisStart = this.timeToMinutes(this.startTime);
    const otherStart = this.timeToMinutes(other.startTime);
    return thisStart - otherStart;
  }

  /**
   * Check if time slot equals another time slot
   */
  equals(other: TimeSlot): boolean {
    return this.day === other.day &&
           this.startTime === other.startTime &&
           this.endTime === other.endTime;
  }

  /**
   * Get a hash code for this time slot (useful for collections)
   */
  hashCode(): string {
    return `${this.day}_${this.startTime}_${this.endTime}`;
  }

  /**
   * Create a time slot for a specific duration starting at given time
   */
  static createForDuration(day: DayOfWeek, startTime: string, durationMinutes: number): TimeSlot {
    const endTime = TimeUtils.addMinutes(startTime, durationMinutes);
    return new TimeSlot(day, startTime, endTime);
  }

  /**
   * Create multiple time slots for a day with given parameters
   */
  static createDaySlots(
    day: DayOfWeek,
    dayStartTime: string,
    dayEndTime: string,
    slotDurationMinutes: number,
    breakDurationMinutes: number = 0
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    let currentTime = dayStartTime;
    const dayEndMinutes = TimeUtils.parseTime(dayEndTime).hours * 60 + TimeUtils.parseTime(dayEndTime).minutes;

    while (true) {
      const currentMinutes = TimeUtils.parseTime(currentTime).hours * 60 + TimeUtils.parseTime(currentTime).minutes;
      const slotEndMinutes = currentMinutes + slotDurationMinutes;

      if (slotEndMinutes > dayEndMinutes) {
        break;
      }

      const endTime = TimeUtils.addMinutes(currentTime, slotDurationMinutes);
      slots.push(new TimeSlot(day, currentTime, endTime));

      // Move to next slot (including break time)
      currentTime = TimeUtils.addMinutes(currentTime, slotDurationMinutes + breakDurationMinutes);
    }

    return slots;
  }
}
