import { ValidationResult, Batch, Subject, Faculty } from '../models';
import { ValidationUtils } from '../utils';

export interface ValidationRule<T> {
  name: string;
  validate(value: T): ValidationResult;
  priority: number; // Higher priority rules run first
}

export interface ValidationContext {
  batches?: Batch[];
  subjects?: Subject[];
  faculties?: Faculty[];
  existingNames?: string[];
  totalTimeSlots?: number;
}

export class ValidationService {
  private batchRules: ValidationRule<Batch>[] = [];
  private subjectRules: ValidationRule<Subject>[] = [];
  private facultyRules: ValidationRule<Faculty>[] = [];
  private stringRules: ValidationRule<string>[] = [];
  private numberRules: ValidationRule<number>[] = [];

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Validate a batch with context
   */
  validateBatch(batch: Batch, context?: ValidationContext): ValidationResult {
    const results = this.batchRules
      .sort((a, b) => b.priority - a.priority)
      .map(rule => this.executeRule(rule, batch, context));

    return this.combineResults(results);
  }

  /**
   * Validate a subject with context
   */
  validateSubject(subject: Subject, context?: ValidationContext): ValidationResult {
    const results = this.subjectRules
      .sort((a, b) => b.priority - a.priority)
      .map(rule => this.executeRule(rule, subject, context));

    return this.combineResults(results);
  }

  /**
   * Validate a faculty with context
   */
  validateFaculty(faculty: Faculty, context?: ValidationContext): ValidationResult {
    const results = this.facultyRules
      .sort((a, b) => b.priority - a.priority)
      .map(rule => this.executeRule(rule, faculty, context));

    return this.combineResults(results);
  }

  /**
   * Validate string input
   */
  validateString(value: string, context?: ValidationContext): ValidationResult {
    const results = this.stringRules
      .sort((a, b) => b.priority - a.priority)
      .map(rule => this.executeRule(rule, value, context));

    return this.combineResults(results);
  }

  /**
   * Validate number input
   */
  validateNumber(value: number, context?: ValidationContext): ValidationResult {
    const results = this.numberRules
      .sort((a, b) => b.priority - a.priority)
      .map(rule => this.executeRule(rule, value, context));

    return this.combineResults(results);
  }

  /**
   * Validate duplicate names across batches
   */
  validateUniqueNames(names: string[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const nameCount = new Map<string, number>();
    
    names.forEach(name => {
      const lowerName = name.toLowerCase().trim();
      nameCount.set(lowerName, (nameCount.get(lowerName) || 0) + 1);
    });

    nameCount.forEach((count, name) => {
      if (count > 1) {
        errors.push(`Duplicate name found: "${name}" appears ${count} times`);
      }
    });

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate scheduling feasibility
   */
  validateSchedulingFeasibility(batches: Batch[], availableTimeSlots: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const totalLectures = batches.reduce((sum, batch) => 
      sum + batch.getTotalLecturesPerWeek(), 0);

    if (totalLectures > availableTimeSlots) {
      errors.push(
        `Total lectures (${totalLectures}) exceed available time slots (${availableTimeSlots}). ` +
        `Reduce lectures or increase available time slots.`
      );
    }

    if (totalLectures > availableTimeSlots * 0.8) {
      warnings.push(
        `Time slot utilization is very high (${Math.round(totalLectures / availableTimeSlots * 100)}%). ` +
        `This may make scheduling difficult.`
      );
    }

    // Check faculty workload distribution
    const facultyWorkload = new Map<string, number>();
    batches.forEach(batch => {
      batch.subjects.forEach(subject => {
        const current = facultyWorkload.get(subject.facultyId) || 0;
        facultyWorkload.set(subject.facultyId, current + subject.lecturesPerWeek);
      });
    });

    const maxWorkload = Math.max(...Array.from(facultyWorkload.values()));
    const avgWorkload = Array.from(facultyWorkload.values()).reduce((a, b) => a + b, 0) / facultyWorkload.size;

    if (maxWorkload > avgWorkload * 2) {
      warnings.push(
        `Uneven faculty workload distribution detected. ` +
        `Some faculty have significantly more lectures than others.`
      );
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate complete configuration
   */
  validateConfiguration(batches: Batch[], faculties: Faculty[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate each batch
    batches.forEach((batch, index) => {
      const batchResult = this.validateBatch(batch, { batches, faculties });
      if (!batchResult.isValid) {
        errors.push(`Batch ${index + 1} (${batch.name}): ${batchResult.errors.join(', ')}`);
      }
      warnings.push(...batchResult.warnings.map(w => `Batch ${batch.name}: ${w}`));
    });

    // Validate each faculty
    faculties.forEach((faculty, index) => {
      const facultyResult = this.validateFaculty(faculty, { batches, faculties });
      if (!facultyResult.isValid) {
        errors.push(`Faculty ${index + 1} (${faculty.name}): ${facultyResult.errors.join(', ')}`);
      }
      warnings.push(...facultyResult.warnings.map(w => `Faculty ${faculty.name}: ${w}`));
    });

    // Check for orphaned subjects (subjects without valid faculty)
    const facultyIds = new Set(faculties.map(f => f.id));
    batches.forEach(batch => {
      batch.subjects.forEach(subject => {
        if (!facultyIds.has(subject.facultyId)) {
          errors.push(`Subject "${subject.name}" in batch "${batch.name}" has invalid faculty ID`);
        }
      });
    });

    // Check for unused faculties
    const usedFacultyIds = new Set();
    batches.forEach(batch => {
      batch.subjects.forEach(subject => {
        usedFacultyIds.add(subject.facultyId);
      });
    });

    faculties.forEach(faculty => {
      if (!usedFacultyIds.has(faculty.id)) {
        warnings.push(`Faculty "${faculty.name}" is not assigned to any subjects`);
      }
    });

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Add custom validation rule
   */
  addBatchRule(rule: ValidationRule<Batch>): void {
    this.batchRules.push(rule);
  }

  addSubjectRule(rule: ValidationRule<Subject>): void {
    this.subjectRules.push(rule);
  }

  addFacultyRule(rule: ValidationRule<Faculty>): void {
    this.facultyRules.push(rule);
  }

  addStringRule(rule: ValidationRule<string>): void {
    this.stringRules.push(rule);
  }

  addNumberRule(rule: ValidationRule<number>): void {
    this.numberRules.push(rule);
  }

  /**
   * Remove validation rule by name
   */
  removeRule(ruleName: string): void {
    this.batchRules = this.batchRules.filter(rule => rule.name !== ruleName);
    this.subjectRules = this.subjectRules.filter(rule => rule.name !== ruleName);
    this.facultyRules = this.facultyRules.filter(rule => rule.name !== ruleName);
    this.stringRules = this.stringRules.filter(rule => rule.name !== ruleName);
    this.numberRules = this.numberRules.filter(rule => rule.name !== ruleName);
  }

  /**
   * Get all validation rules
   */
  getAllRules(): {
    batch: ValidationRule<Batch>[];
    subject: ValidationRule<Subject>[];
    faculty: ValidationRule<Faculty>[];
    string: ValidationRule<string>[];
    number: ValidationRule<number>[];
  } {
    return {
      batch: [...this.batchRules],
      subject: [...this.subjectRules],
      faculty: [...this.facultyRules],
      string: [...this.stringRules],
      number: [...this.numberRules]
    };
  }

  /**
   * Initialize default validation rules
   */
  private initializeDefaultRules(): void {
    // Batch rules
    this.addBatchRule({
      name: 'batch-name-required',
      priority: 100,
      validate: (batch: Batch) => {
        const errors: string[] = [];
        if (!ValidationUtils.isValidBatchName(batch.name)) {
          errors.push('Batch name must be between 1 and 50 characters');
        }
        return { isValid: errors.length === 0, errors, warnings: [] };
      }
    });

    this.addBatchRule({
      name: 'batch-subject-limit',
      priority: 50,
      validate: (batch: Batch) => {
        const warnings: string[] = [];
        if (batch.subjects.length > 15) {
          warnings.push('Batch has more than 15 subjects, which may be difficult to schedule');
        }
        if (batch.subjects.length === 0) {
          warnings.push('Batch has no subjects assigned');
        }
        return { isValid: true, errors: [], warnings };
      }
    });

    this.addBatchRule({
      name: 'batch-weekly-duration',
      priority: 30,
      validate: (batch: Batch) => {
        const warnings: string[] = [];
        const totalDuration = batch.getTotalDurationPerWeek();
        if (totalDuration > 2400) { // 40 hours
          warnings.push(`Total weekly duration (${Math.round(totalDuration/60)}h) exceeds 40 hours`);
        }
        return { isValid: true, errors: [], warnings };
      }
    });

    // Subject rules
    this.addSubjectRule({
      name: 'subject-name-required',
      priority: 100,
      validate: (subject: Subject) => {
        const errors: string[] = [];
        if (!ValidationUtils.isValidSubjectName(subject.name)) {
          errors.push('Subject name must be between 1 and 100 characters');
        }
        return { isValid: errors.length === 0, errors, warnings: [] };
      }
    });

    this.addSubjectRule({
      name: 'subject-lecture-count',
      priority: 90,
      validate: (subject: Subject) => {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        if (!ValidationUtils.isValidLectureCount(subject.lecturesPerWeek)) {
          errors.push('Lectures per week must be between 1 and 20');
        } else if (subject.lecturesPerWeek > 10) {
          warnings.push('More than 10 lectures per week may be difficult to schedule');
        }
        
        return { isValid: errors.length === 0, errors, warnings };
      }
    });

    this.addSubjectRule({
      name: 'subject-lecture-duration',
      priority: 90,
      validate: (subject: Subject) => {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        if (!ValidationUtils.isValidLectureDuration(subject.lectureDuration)) {
          errors.push('Lecture duration must be between 30 and 180 minutes');
        } else {
          if (subject.lectureDuration > 120) {
            warnings.push('Lectures longer than 2 hours may be too long for students');
          }
          if (subject.lectureDuration < 45) {
            warnings.push('Lectures shorter than 45 minutes may be too brief');
          }
        }
        
        return { isValid: errors.length === 0, errors, warnings };
      }
    });

    // Faculty rules
    this.addFacultyRule({
      name: 'faculty-name-required',
      priority: 100,
      validate: (faculty: Faculty) => {
        const errors: string[] = [];
        if (!ValidationUtils.isValidFacultyName(faculty.name)) {
          errors.push('Faculty name must be between 1 and 100 characters');
        }
        return { isValid: errors.length === 0, errors, warnings: [] };
      }
    });

    this.addFacultyRule({
      name: 'faculty-workload',
      priority: 50,
      validate: (faculty: Faculty) => {
        const warnings: string[] = [];
        if (faculty.subjects.length > 10) {
          warnings.push('Faculty assigned to more than 10 subjects may have scheduling conflicts');
        }
        if (faculty.subjects.length === 0) {
          warnings.push('Faculty has no subject assignments');
        }
        return { isValid: true, errors: [], warnings };
      }
    });

    // String rules
    this.addStringRule({
      name: 'string-not-empty',
      priority: 100,
      validate: (value: string) => {
        const errors: string[] = [];
        if (!value || value.trim().length === 0) {
          errors.push('Value cannot be empty');
        }
        return { isValid: errors.length === 0, errors, warnings: [] };
      }
    });

    this.addStringRule({
      name: 'string-length-warning',
      priority: 10,
      validate: (value: string) => {
        const warnings: string[] = [];
        if (value && value.length > 200) {
          warnings.push('Value is very long and may be truncated');
        }
        return { isValid: true, errors: [], warnings };
      }
    });

    // Number rules
    this.addNumberRule({
      name: 'number-valid',
      priority: 100,
      validate: (value: number) => {
        const errors: string[] = [];
        if (isNaN(value)) {
          errors.push('Value must be a valid number');
        }
        return { isValid: errors.length === 0, errors, warnings: [] };
      }
    });

    this.addNumberRule({
      name: 'number-non-negative',
      priority: 90,
      validate: (value: number) => {
        const errors: string[] = [];
        if (!isNaN(value) && value < 0) {
          errors.push('Value must be non-negative');
        }
        return { isValid: errors.length === 0, errors, warnings: [] };
      }
    });
  }

  /**
   * Execute a validation rule with error handling
   */
  private executeRule<T>(rule: ValidationRule<T>, value: T, context?: ValidationContext): ValidationResult {
    try {
      return rule.validate(value);
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation rule "${rule.name}" failed: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Combine multiple validation results
   */
  private combineResults(results: ValidationResult[]): ValidationResult {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    results.forEach(result => {
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    });

    // Remove duplicates
    const uniqueErrors = [...new Set(allErrors)];
    const uniqueWarnings = [...new Set(allWarnings)];

    return {
      isValid: uniqueErrors.length === 0,
      errors: uniqueErrors,
      warnings: uniqueWarnings
    };
  }
}
