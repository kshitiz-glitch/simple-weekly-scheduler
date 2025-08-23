import { ValidationService, ValidationRule } from '../ValidationService';
import { Batch, Subject, Faculty } from '../../models';

describe('ValidationService', () => {
  let validationService: ValidationService;

  beforeEach(() => {
    validationService = new ValidationService();
  });

  describe('validateBatch', () => {
    it('should validate a valid batch', () => {
      const batch = new Batch('Grade 10');
      const subject = new Subject('Mathematics', batch.id, 5, 60, 'faculty_1');
      batch.addSubject(subject);

      const result = validationService.validateBatch(batch);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid batch name', () => {
      const batch = new Batch('Valid Name');
      batch.name = ''; // Make invalid after construction

      const result = validationService.validateBatch(batch);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Batch name must be between 1 and 50 characters');
    });

    it('should warn for too many subjects', () => {
      const batch = new Batch('Grade 10');
      
      // Add 16 subjects
      for (let i = 0; i < 16; i++) {
        batch.subjects.push({
          id: `subject_${i}`,
          name: `Subject ${i}`,
          batchId: batch.id,
          lecturesPerWeek: 2,
          lectureDuration: 60,
          facultyId: `faculty_${i}`
        });
      }

      const result = validationService.validateBatch(batch);

      expect(result.warnings).toContain('Batch has more than 15 subjects, which may be difficult to schedule');
    });

    it('should warn for no subjects', () => {
      const batch = new Batch('Grade 10');

      const result = validationService.validateBatch(batch);

      expect(result.warnings).toContain('Batch has no subjects assigned');
    });

    it('should warn for excessive weekly duration', () => {
      const batch = new Batch('Grade 10');
      
      // Add subject with very long total duration
      batch.subjects.push({
        id: 'subject_1',
        name: 'Marathon Subject',
        batchId: batch.id,
        lecturesPerWeek: 50,
        lectureDuration: 60, // 50 hours per week
        facultyId: 'faculty_1'
      });

      const result = validationService.validateBatch(batch);

      expect(result.warnings.some(w => w.includes('exceeds 40 hours'))).toBe(true);
    });
  });

  describe('validateSubject', () => {
    it('should validate a valid subject', () => {
      const subject = new Subject('Mathematics', 'batch_1', 5, 60, 'faculty_1');

      const result = validationService.validateSubject(subject);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid subject name', () => {
      const subject = new Subject('Valid Name', 'batch_1', 5, 60, 'faculty_1');
      subject.name = ''; // Make invalid

      const result = validationService.validateSubject(subject);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Subject name must be between 1 and 100 characters');
    });

    it('should detect invalid lecture count', () => {
      const subject = new Subject('Mathematics', 'batch_1', 5, 60, 'faculty_1');
      subject.lecturesPerWeek = 0; // Make invalid

      const result = validationService.validateSubject(subject);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Lectures per week must be between 1 and 20');
    });

    it('should warn for high lecture count', () => {
      const subject = new Subject('Mathematics', 'batch_1', 15, 60, 'faculty_1');

      const result = validationService.validateSubject(subject);

      expect(result.warnings).toContain('More than 10 lectures per week may be difficult to schedule');
    });

    it('should detect invalid lecture duration', () => {
      const subject = new Subject('Mathematics', 'batch_1', 5, 60, 'faculty_1');
      subject.lectureDuration = 20; // Make invalid

      const result = validationService.validateSubject(subject);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Lecture duration must be between 30 and 180 minutes');
    });

    it('should warn for long lecture duration', () => {
      const subject = new Subject('Mathematics', 'batch_1', 5, 150, 'faculty_1');

      const result = validationService.validateSubject(subject);

      expect(result.warnings).toContain('Lectures longer than 2 hours may be too long for students');
    });

    it('should warn for short lecture duration', () => {
      const subject = new Subject('Mathematics', 'batch_1', 5, 30, 'faculty_1');

      const result = validationService.validateSubject(subject);

      expect(result.warnings).toContain('Lectures shorter than 45 minutes may be too brief');
    });
  });

  describe('validateFaculty', () => {
    it('should validate a valid faculty', () => {
      const faculty = new Faculty('Dr. Smith');
      faculty.addSubject('subject_1');

      const result = validationService.validateFaculty(faculty);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid faculty name', () => {
      const faculty = new Faculty('Valid Name');
      faculty.name = ''; // Make invalid

      const result = validationService.validateFaculty(faculty);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Faculty name must be between 1 and 100 characters');
    });

    it('should warn for too many subjects', () => {
      const faculty = new Faculty('Dr. Smith');
      
      // Add 11 subjects
      for (let i = 0; i < 11; i++) {
        faculty.subjects.push(`subject_${i}`);
      }

      const result = validationService.validateFaculty(faculty);

      expect(result.warnings).toContain('Faculty assigned to more than 10 subjects may have scheduling conflicts');
    });

    it('should warn for no subjects', () => {
      const faculty = new Faculty('Dr. Smith');

      const result = validationService.validateFaculty(faculty);

      expect(result.warnings).toContain('Faculty has no subject assignments');
    });
  });

  describe('validateString', () => {
    it('should validate a valid string', () => {
      const result = validationService.validateString('Valid string');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect empty string', () => {
      const result = validationService.validateString('');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Value cannot be empty');
    });

    it('should warn for very long string', () => {
      const longString = 'a'.repeat(250);
      const result = validationService.validateString(longString);

      expect(result.warnings).toContain('Value is very long and may be truncated');
    });
  });

  describe('validateNumber', () => {
    it('should validate a valid number', () => {
      const result = validationService.validateNumber(42);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid number', () => {
      const result = validationService.validateNumber(NaN);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Value must be a valid number');
    });

    it('should detect negative number', () => {
      const result = validationService.validateNumber(-5);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Value must be non-negative');
    });
  });

  describe('validateUniqueNames', () => {
    it('should pass for unique names', () => {
      const names = ['Grade 10', 'Grade 11', 'Grade 12'];
      const result = validationService.validateUniqueNames(names);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect duplicate names', () => {
      const names = ['Grade 10', 'Grade 11', 'grade 10']; // Case insensitive duplicate
      const result = validationService.validateUniqueNames(names);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Duplicate name found');
      expect(result.errors[0]).toContain('grade 10');
    });

    it('should handle multiple duplicates', () => {
      const names = ['A', 'B', 'A', 'C', 'B', 'A'];
      const result = validationService.validateUniqueNames(names);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2); // A and B are duplicated
    });
  });

  describe('validateSchedulingFeasibility', () => {
    it('should pass for feasible scheduling', () => {
      const batch = new Batch('Grade 10');
      const subject = new Subject('Mathematics', batch.id, 5, 60, 'faculty_1');
      batch.addSubject(subject);

      const result = validationService.validateSchedulingFeasibility([batch], 20);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect insufficient time slots', () => {
      const batch = new Batch('Grade 10');
      const subject = new Subject('Mathematics', batch.id, 10, 60, 'faculty_1');
      batch.addSubject(subject);

      const result = validationService.validateSchedulingFeasibility([batch], 5);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Total lectures (10) exceed available time slots (5)');
    });

    it('should warn for high utilization', () => {
      const batch = new Batch('Grade 10');
      const subject = new Subject('Mathematics', batch.id, 9, 60, 'faculty_1');
      batch.addSubject(subject);

      const result = validationService.validateSchedulingFeasibility([batch], 10);

      expect(result.warnings[0]).toContain('Time slot utilization is very high (90%)');
    });

    it('should warn for uneven faculty workload', () => {
      const batch = new Batch('Grade 10');
      const subject1 = new Subject('Mathematics', batch.id, 10, 60, 'faculty_1');
      const subject2 = new Subject('Physics', batch.id, 2, 60, 'faculty_2');
      batch.addSubject(subject1);
      batch.addSubject(subject2);

      const result = validationService.validateSchedulingFeasibility([batch], 20);

      expect(result.warnings.some(w => w.includes('Uneven faculty workload'))).toBe(true);
    });
  });

  describe('validateConfiguration', () => {
    it('should validate complete valid configuration', () => {
      const batch = new Batch('Grade 10');
      const faculty = new Faculty('Dr. Smith');
      const subject = new Subject('Mathematics', batch.id, 5, 60, faculty.id);
      
      batch.addSubject(subject);
      faculty.addSubject(subject.id);

      const result = validationService.validateConfiguration([batch], [faculty]);

      expect(result.isValid).toBe(true);
    });

    it('should detect orphaned subjects', () => {
      const batch = new Batch('Grade 10');
      const subject = new Subject('Mathematics', batch.id, 5, 60, 'non_existent_faculty');
      batch.addSubject(subject);

      const result = validationService.validateConfiguration([batch], []);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('invalid faculty ID'))).toBe(true);
    });

    it('should warn for unused faculties', () => {
      const batch = new Batch('Grade 10');
      const faculty1 = new Faculty('Dr. Smith');
      const faculty2 = new Faculty('Dr. Johnson'); // Unused
      const subject = new Subject('Mathematics', batch.id, 5, 60, faculty1.id);
      
      batch.addSubject(subject);
      faculty1.addSubject(subject.id);

      const result = validationService.validateConfiguration([batch], [faculty1, faculty2]);

      expect(result.warnings.some(w => w.includes('Dr. Johnson') && w.includes('not assigned'))).toBe(true);
    });
  });

  describe('custom rules', () => {
    it('should allow adding custom batch rules', () => {
      const customRule: ValidationRule<Batch> = {
        name: 'custom-batch-rule',
        priority: 50,
        validate: (batch: Batch) => ({
          isValid: batch.name !== 'Forbidden',
          errors: batch.name === 'Forbidden' ? ['Forbidden batch name'] : [],
          warnings: []
        })
      };

      validationService.addBatchRule(customRule);

      const batch = new Batch('Forbidden');
      const result = validationService.validateBatch(batch);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Forbidden batch name');
    });

    it('should allow removing rules', () => {
      const customRule: ValidationRule<string> = {
        name: 'test-rule',
        priority: 50,
        validate: () => ({ isValid: false, errors: ['Test error'], warnings: [] })
      };

      validationService.addStringRule(customRule);
      
      let result = validationService.validateString('test');
      expect(result.errors).toContain('Test error');

      validationService.removeRule('test-rule');
      
      result = validationService.validateString('test');
      expect(result.errors).not.toContain('Test error');
    });

    it('should handle rule execution errors', () => {
      const faultyRule: ValidationRule<string> = {
        name: 'faulty-rule',
        priority: 50,
        validate: () => {
          throw new Error('Rule execution failed');
        }
      };

      validationService.addStringRule(faultyRule);

      const result = validationService.validateString('test');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Validation rule "faulty-rule" failed'))).toBe(true);
    });

    it('should return all rules', () => {
      const rules = validationService.getAllRules();

      expect(rules.batch.length).toBeGreaterThan(0);
      expect(rules.subject.length).toBeGreaterThan(0);
      expect(rules.faculty.length).toBeGreaterThan(0);
      expect(rules.string.length).toBeGreaterThan(0);
      expect(rules.number.length).toBeGreaterThan(0);
    });
  });

  describe('rule priority', () => {
    it('should execute rules in priority order', () => {
      const executionOrder: string[] = [];

      const lowPriorityRule: ValidationRule<string> = {
        name: 'low-priority',
        priority: 10,
        validate: (value: string) => {
          executionOrder.push('low');
          return { isValid: true, errors: [], warnings: [] };
        }
      };

      const highPriorityRule: ValidationRule<string> = {
        name: 'high-priority',
        priority: 100,
        validate: (value: string) => {
          executionOrder.push('high');
          return { isValid: true, errors: [], warnings: [] };
        }
      };

      validationService.addStringRule(lowPriorityRule);
      validationService.addStringRule(highPriorityRule);

      validationService.validateString('test');

      expect(executionOrder).toEqual(['high', 'low']);
    });
  });

  describe('result combination', () => {
    it('should combine multiple validation results', () => {
      const rule1: ValidationRule<string> = {
        name: 'rule1',
        priority: 50,
        validate: () => ({ isValid: false, errors: ['Error 1'], warnings: ['Warning 1'] })
      };

      const rule2: ValidationRule<string> = {
        name: 'rule2',
        priority: 40,
        validate: () => ({ isValid: false, errors: ['Error 2'], warnings: ['Warning 2'] })
      };

      validationService.addStringRule(rule1);
      validationService.addStringRule(rule2);

      const result = validationService.validateString('test');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Error 1');
      expect(result.errors).toContain('Error 2');
      expect(result.warnings).toContain('Warning 1');
      expect(result.warnings).toContain('Warning 2');
    });

    it('should remove duplicate errors and warnings', () => {
      const rule1: ValidationRule<string> = {
        name: 'rule1',
        priority: 50,
        validate: () => ({ isValid: false, errors: ['Duplicate Error'], warnings: ['Duplicate Warning'] })
      };

      const rule2: ValidationRule<string> = {
        name: 'rule2',
        priority: 40,
        validate: () => ({ isValid: false, errors: ['Duplicate Error'], warnings: ['Duplicate Warning'] })
      };

      validationService.addStringRule(rule1);
      validationService.addStringRule(rule2);

      const result = validationService.validateString('test');

      expect(result.errors.filter(e => e === 'Duplicate Error')).toHaveLength(1);
      expect(result.warnings.filter(w => w === 'Duplicate Warning')).toHaveLength(1);
    });
  });
});
