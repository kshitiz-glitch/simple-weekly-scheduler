import { Subject as ISubject, ValidationResult } from './index';
import { IdGenerator, ValidationUtils } from '../utils';

export class Subject implements ISubject {
  public readonly id: string;
  public name: string;
  public readonly batchId: string;
  public lecturesPerWeek: number;
  public lectureDuration: number; // in minutes
  public facultyId: string;

  constructor(
    name: string,
    batchId: string,
    lecturesPerWeek: number,
    lectureDuration: number,
    facultyId: string,
    id?: string
  ) {
    this.id = id || IdGenerator.generateSubjectId();
    this.name = name;
    this.batchId = batchId;
    this.lecturesPerWeek = lecturesPerWeek;
    this.lectureDuration = lectureDuration;
    this.facultyId = facultyId;

    const validation = this.validate();
    if (!validation.isValid) {
      throw new Error(`Invalid subject: ${validation.errors.join(', ')}`);
    }
  }

  /**
   * Validate the subject
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate name
    if (!ValidationUtils.isValidSubjectName(this.name)) {
      errors.push('Subject name must be between 1 and 100 characters');
    }

    // Validate batch ID
    if (!this.batchId || this.batchId.trim().length === 0) {
      errors.push('Batch ID is required');
    }

    // Validate lectures per week
    if (!ValidationUtils.isValidLectureCount(this.lecturesPerWeek)) {
      errors.push('Lectures per week must be a positive integer between 1 and 20');
    }

    // Validate lecture duration
    if (!ValidationUtils.isValidLectureDuration(this.lectureDuration)) {
      errors.push('Lecture duration must be between 30 and 180 minutes');
    }

    // Validate faculty ID
    if (!this.facultyId || this.facultyId.trim().length === 0) {
      errors.push('Faculty ID is required');
    }

    // Warnings for potentially problematic values
    if (this.lecturesPerWeek > 10) {
      warnings.push('More than 10 lectures per week may be difficult to schedule');
    }

    if (this.lectureDuration > 120) {
      warnings.push('Lectures longer than 2 hours may be too long for students');
    }

    if (this.lectureDuration < 45) {
      warnings.push('Lectures shorter than 45 minutes may be too brief for effective learning');
    }

    // Check for reasonable total weekly duration
    const totalWeeklyDuration = this.getTotalWeeklyDuration();
    if (totalWeeklyDuration > 600) { // 10 hours
      warnings.push('Total weekly duration for this subject exceeds 10 hours');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get total weekly duration for this subject in minutes
   */
  getTotalWeeklyDuration(): number {
    return this.lecturesPerWeek * this.lectureDuration;
  }

  /**
   * Get total weekly duration in hours (rounded to 1 decimal place)
   */
  getTotalWeeklyHours(): number {
    return Math.round(this.getTotalWeeklyDuration() / 60 * 10) / 10;
  }

  /**
   * Update subject name with validation
   */
  updateName(newName: string): void {
    if (!ValidationUtils.isValidSubjectName(newName)) {
      throw new Error('Invalid subject name: must be between 1 and 100 characters');
    }
    this.name = newName;
  }

  /**
   * Update lectures per week with validation
   */
  updateLecturesPerWeek(count: number): void {
    if (!ValidationUtils.isValidLectureCount(count)) {
      throw new Error('Invalid lecture count: must be a positive integer between 1 and 20');
    }
    this.lecturesPerWeek = count;
  }

  /**
   * Update lecture duration with validation
   */
  updateLectureDuration(duration: number): void {
    if (!ValidationUtils.isValidLectureDuration(duration)) {
      throw new Error('Invalid lecture duration: must be between 30 and 180 minutes');
    }
    this.lectureDuration = duration;
  }

  /**
   * Update faculty ID with validation
   */
  updateFacultyId(facultyId: string): void {
    if (!facultyId || facultyId.trim().length === 0) {
      throw new Error('Faculty ID cannot be empty');
    }
    this.facultyId = facultyId;
  }

  /**
   * Check if this subject can fit in the given time slot duration
   */
  canFitInTimeSlot(slotDurationMinutes: number): boolean {
    return this.lectureDuration <= slotDurationMinutes;
  }

  /**
   * Calculate how many time slots this subject needs per week
   */
  getRequiredTimeSlots(): number {
    return this.lecturesPerWeek;
  }

  /**
   * Get subject summary
   */
  getSummary(): string {
    const hours = this.getTotalWeeklyHours();
    return `${this.name}: ${this.lecturesPerWeek} lectures/week × ${this.lectureDuration}min = ${hours}h/week`;
  }

  /**
   * Get detailed subject information
   */
  getDetails(): string {
    return [
      `Subject: ${this.name}`,
      `Batch ID: ${this.batchId}`,
      `Faculty ID: ${this.facultyId}`,
      `Lectures per week: ${this.lecturesPerWeek}`,
      `Duration per lecture: ${this.lectureDuration} minutes`,
      `Total weekly time: ${this.getTotalWeeklyHours()} hours`
    ].join('\n');
  }

  /**
   * Check if two subjects have conflicting requirements
   */
  hasConflictWith(other: Subject): boolean {
    // Same faculty cannot teach at the same time
    return this.facultyId === other.facultyId && this.id !== other.id;
  }

  /**
   * Create a copy of this subject
   */
  clone(): Subject {
    return new Subject(
      this.name,
      this.batchId,
      this.lecturesPerWeek,
      this.lectureDuration,
      this.facultyId,
      this.id
    );
  }

  /**
   * Convert to plain object
   */
  toJSON(): ISubject {
    return {
      id: this.id,
      name: this.name,
      batchId: this.batchId,
      lecturesPerWeek: this.lecturesPerWeek,
      lectureDuration: this.lectureDuration,
      facultyId: this.facultyId
    };
  }

  /**
   * Create subject from plain object
   */
  static fromJSON(data: ISubject): Subject {
    return new Subject(
      data.name,
      data.batchId,
      data.lecturesPerWeek,
      data.lectureDuration,
      data.facultyId,
      data.id
    );
  }

  /**
   * Compare subjects for sorting (by name)
   */
  compareTo(other: Subject): number {
    return this.name.localeCompare(other.name);
  }

  /**
   * Check if subject equals another subject (by ID)
   */
  equals(other: Subject): boolean {
    return this.id === other.id;
  }

  /**
   * Get a hash code for this subject (useful for collections)
   */
  hashCode(): string {
    return this.id;
  }
}
