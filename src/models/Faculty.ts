import { Faculty as IFaculty, ValidationResult } from './index';
import { IdGenerator, ValidationUtils } from '../utils';

export class Faculty implements IFaculty {
  public readonly id: string;
  public name: string;
  public subjects: string[]; // subject IDs

  constructor(name: string, id?: string) {
    this.id = id || IdGenerator.generateFacultyId();
    this.name = name;
    this.subjects = [];

    const validation = this.validate();
    if (!validation.isValid) {
      throw new Error(`Invalid faculty: ${validation.errors.join(', ')}`);
    }
  }

  /**
   * Validate the faculty
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate name
    if (!ValidationUtils.isValidFacultyName(this.name)) {
      errors.push('Faculty name must be between 1 and 100 characters');
    }

    // Check for duplicate subject assignments
    const uniqueSubjects = new Set(this.subjects);
    if (uniqueSubjects.size !== this.subjects.length) {
      errors.push('Faculty has duplicate subject assignments');
    }

    // Warn if faculty has too many subjects
    if (this.subjects.length > 10) {
      warnings.push('Faculty assigned to more than 10 subjects may have scheduling conflicts');
    }

    // Warn if faculty has no subjects
    if (this.subjects.length === 0) {
      warnings.push('Faculty has no subject assignments');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Add a subject to this faculty
   */
  addSubject(subjectId: string): void {
    if (!subjectId || subjectId.trim().length === 0) {
      throw new Error('Subject ID cannot be empty');
    }

    if (this.hasSubject(subjectId)) {
      throw new Error(`Subject '${subjectId}' is already assigned to faculty '${this.name}'`);
    }

    this.subjects.push(subjectId);
  }

  /**
   * Remove a subject from this faculty
   */
  removeSubject(subjectId: string): boolean {
    const index = this.subjects.indexOf(subjectId);
    if (index === -1) {
      return false;
    }

    this.subjects.splice(index, 1);
    return true;
  }

  /**
   * Check if faculty is assigned to a subject
   */
  hasSubject(subjectId: string): boolean {
    return this.subjects.includes(subjectId);
  }

  /**
   * Get number of subjects assigned to this faculty
   */
  getSubjectCount(): number {
    return this.subjects.length;
  }

  /**
   * Check if faculty is available (has subject assignments)
   */
  isAvailable(): boolean {
    return this.subjects.length > 0;
  }

  /**
   * Update faculty name with validation
   */
  updateName(newName: string): void {
    if (!ValidationUtils.isValidFacultyName(newName)) {
      throw new Error('Invalid faculty name: must be between 1 and 100 characters');
    }
    this.name = newName;
  }

  /**
   * Clear all subject assignments
   */
  clearSubjects(): void {
    this.subjects = [];
  }

  /**
   * Replace all subject assignments
   */
  setSubjects(subjectIds: string[]): void {
    // Validate all subject IDs
    for (const subjectId of subjectIds) {
      if (!subjectId || subjectId.trim().length === 0) {
        throw new Error('All subject IDs must be non-empty');
      }
    }

    // Check for duplicates
    const uniqueSubjects = new Set(subjectIds);
    if (uniqueSubjects.size !== subjectIds.length) {
      throw new Error('Duplicate subject IDs are not allowed');
    }

    this.subjects = [...subjectIds];
  }

  /**
   * Get faculty summary
   */
  getSummary(): string {
    const subjectCount = this.getSubjectCount();
    return `${this.name} (${subjectCount} subject${subjectCount !== 1 ? 's' : ''})`;
  }

  /**
   * Get detailed faculty information
   */
  getDetails(): string {
    return [
      `Faculty: ${this.name}`,
      `ID: ${this.id}`,
      `Subjects assigned: ${this.subjects.length}`,
      `Subject IDs: ${this.subjects.length > 0 ? this.subjects.join(', ') : 'None'}`
    ].join('\n');
  }

  /**
   * Check if this faculty can handle additional subjects
   */
  canHandleMoreSubjects(maxSubjects: number = 10): boolean {
    return this.subjects.length < maxSubjects;
  }

  /**
   * Create a copy of this faculty
   */
  clone(): Faculty {
    const cloned = new Faculty(this.name, this.id);
    cloned.subjects = [...this.subjects];
    return cloned;
  }

  /**
   * Convert to plain object
   */
  toJSON(): IFaculty {
    return {
      id: this.id,
      name: this.name,
      subjects: [...this.subjects]
    };
  }

  /**
   * Create faculty from plain object
   */
  static fromJSON(data: IFaculty): Faculty {
    const faculty = new Faculty(data.name, data.id);
    faculty.subjects = [...data.subjects];
    return faculty;
  }

  /**
   * Compare faculties for sorting (by name)
   */
  compareTo(other: Faculty): number {
    return this.name.localeCompare(other.name);
  }

  /**
   * Check if faculty equals another faculty (by ID)
   */
  equals(other: Faculty): boolean {
    return this.id === other.id;
  }

  /**
   * Get a hash code for this faculty (useful for collections)
   */
  hashCode(): string {
    return this.id;
  }
}
