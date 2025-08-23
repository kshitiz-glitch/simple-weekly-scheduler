import { Batch as IBatch, Subject, ValidationResult } from './index';
import { IdGenerator, ValidationUtils } from '../utils';

export class Batch implements IBatch {
  public readonly id: string;
  public name: string;
  public subjects: Subject[];

  constructor(name: string, id?: string) {
    this.id = id || IdGenerator.generateBatchId();
    this.name = name;
    this.subjects = [];
    
    const validation = this.validate();
    if (!validation.isValid) {
      throw new Error(`Invalid batch: ${validation.errors.join(', ')}`);
    }
  }

  /**
   * Add a subject to this batch
   */
  addSubject(subject: Subject): void {
    if (this.hasSubject(subject.name)) {
      throw new Error(`Subject '${subject.name}' already exists in batch '${this.name}'`);
    }
    
    if (subject.batchId !== this.id) {
      throw new Error(`Subject belongs to different batch (expected: ${this.id}, got: ${subject.batchId})`);
    }
    
    this.subjects.push(subject);
  }

  /**
   * Remove a subject from this batch
   */
  removeSubject(subjectId: string): boolean {
    const index = this.subjects.findIndex(s => s.id === subjectId);
    if (index === -1) {
      return false;
    }
    
    this.subjects.splice(index, 1);
    return true;
  }

  /**
   * Check if batch has a subject with given name
   */
  hasSubject(subjectName: string): boolean {
    return this.subjects.some(s => s.name.toLowerCase() === subjectName.toLowerCase());
  }

  /**
   * Get subject by ID
   */
  getSubject(subjectId: string): Subject | undefined {
    return this.subjects.find(s => s.id === subjectId);
  }

  /**
   * Get subject by name
   */
  getSubjectByName(subjectName: string): Subject | undefined {
    return this.subjects.find(s => s.name.toLowerCase() === subjectName.toLowerCase());
  }

  /**
   * Get total lectures per week for this batch
   */
  getTotalLecturesPerWeek(): number {
    return this.subjects.reduce((total, subject) => total + subject.lecturesPerWeek, 0);
  }

  /**
   * Get total lecture duration per week in minutes
   */
  getTotalDurationPerWeek(): number {
    return this.subjects.reduce((total, subject) => 
      total + (subject.lecturesPerWeek * subject.lectureDuration), 0);
  }

  /**
   * Validate the batch
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate name
    if (!ValidationUtils.isValidBatchName(this.name)) {
      errors.push('Batch name must be between 1 and 50 characters');
    }

    // Check for duplicate subject names
    const subjectNames = this.subjects.map(s => s.name.toLowerCase());
    const duplicates = subjectNames.filter((name, index) => subjectNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      errors.push(`Duplicate subject names found: ${[...new Set(duplicates)].join(', ')}`);
    }

    // Warn if too many subjects
    if (this.subjects.length > 15) {
      warnings.push('Batch has more than 15 subjects, which may be difficult to schedule');
    }

    // Warn if total weekly duration is very high
    const totalDuration = this.getTotalDurationPerWeek();
    if (totalDuration > 2400) { // 40 hours
      warnings.push('Total weekly lecture duration exceeds 40 hours');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Update batch name with validation
   */
  updateName(newName: string): void {
    if (!ValidationUtils.isValidBatchName(newName)) {
      throw new Error('Invalid batch name: must be between 1 and 50 characters');
    }
    this.name = newName;
  }

  /**
   * Get batch summary
   */
  getSummary(): string {
    const totalLectures = this.getTotalLecturesPerWeek();
    const totalHours = Math.round(this.getTotalDurationPerWeek() / 60 * 10) / 10;
    
    return `Batch: ${this.name} (${this.subjects.length} subjects, ${totalLectures} lectures/week, ${totalHours}h/week)`;
  }

  /**
   * Create a copy of this batch
   */
  clone(): Batch {
    const cloned = new Batch(this.name, this.id);
    cloned.subjects = [...this.subjects];
    return cloned;
  }

  /**
   * Convert to plain object
   */
  toJSON(): IBatch {
    return {
      id: this.id,
      name: this.name,
      subjects: this.subjects
    };
  }

  /**
   * Create batch from plain object
   */
  static fromJSON(data: IBatch): Batch {
    const batch = new Batch(data.name, data.id);
    batch.subjects = data.subjects;
    return batch;
  }
}
