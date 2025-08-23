import { Batch } from '../Batch';
import { Subject } from '../index';

describe('Batch', () => {
  let mockSubject: Subject;

  beforeEach(() => {
    mockSubject = {
      id: 'subject_1',
      name: 'Mathematics',
      batchId: 'batch_1',
      lecturesPerWeek: 5,
      lectureDuration: 60,
      facultyId: 'faculty_1'
    };
  });

  describe('constructor', () => {
    it('should create a batch with valid name', () => {
      const batch = new Batch('Grade 10');
      
      expect(batch.name).toBe('Grade 10');
      expect(batch.id).toBeDefined();
      expect(batch.subjects).toEqual([]);
    });

    it('should create a batch with custom ID', () => {
      const customId = 'custom_batch_id';
      const batch = new Batch('Grade 10', customId);
      
      expect(batch.id).toBe(customId);
    });

    it('should throw error for invalid name', () => {
      expect(() => new Batch('')).toThrow('Invalid batch');
      expect(() => new Batch('a'.repeat(51))).toThrow('Invalid batch');
    });
  });

  describe('addSubject', () => {
    it('should add a valid subject', () => {
      const batch = new Batch('Grade 10');
      mockSubject.batchId = batch.id;
      
      batch.addSubject(mockSubject);
      
      expect(batch.subjects).toHaveLength(1);
      expect(batch.subjects[0]).toBe(mockSubject);
    });

    it('should throw error for duplicate subject name', () => {
      const batch = new Batch('Grade 10');
      mockSubject.batchId = batch.id;
      
      batch.addSubject(mockSubject);
      
      const duplicateSubject = { ...mockSubject, id: 'subject_2' };
      expect(() => batch.addSubject(duplicateSubject)).toThrow('already exists');
    });

    it('should throw error for subject with wrong batch ID', () => {
      const batch = new Batch('Grade 10');
      mockSubject.batchId = 'wrong_batch_id';
      
      expect(() => batch.addSubject(mockSubject)).toThrow('belongs to different batch');
    });
  });

  describe('removeSubject', () => {
    it('should remove existing subject', () => {
      const batch = new Batch('Grade 10');
      mockSubject.batchId = batch.id;
      batch.addSubject(mockSubject);
      
      const result = batch.removeSubject(mockSubject.id);
      
      expect(result).toBe(true);
      expect(batch.subjects).toHaveLength(0);
    });

    it('should return false for non-existing subject', () => {
      const batch = new Batch('Grade 10');
      
      const result = batch.removeSubject('non_existing_id');
      
      expect(result).toBe(false);
    });
  });

  describe('hasSubject', () => {
    it('should return true for existing subject (case insensitive)', () => {
      const batch = new Batch('Grade 10');
      mockSubject.batchId = batch.id;
      batch.addSubject(mockSubject);
      
      expect(batch.hasSubject('Mathematics')).toBe(true);
      expect(batch.hasSubject('mathematics')).toBe(true);
      expect(batch.hasSubject('MATHEMATICS')).toBe(true);
    });

    it('should return false for non-existing subject', () => {
      const batch = new Batch('Grade 10');
      
      expect(batch.hasSubject('Physics')).toBe(false);
    });
  });

  describe('getSubject', () => {
    it('should return subject by ID', () => {
      const batch = new Batch('Grade 10');
      mockSubject.batchId = batch.id;
      batch.addSubject(mockSubject);
      
      const result = batch.getSubject(mockSubject.id);
      
      expect(result).toBe(mockSubject);
    });

    it('should return undefined for non-existing ID', () => {
      const batch = new Batch('Grade 10');
      
      const result = batch.getSubject('non_existing_id');
      
      expect(result).toBeUndefined();
    });
  });

  describe('getSubjectByName', () => {
    it('should return subject by name (case insensitive)', () => {
      const batch = new Batch('Grade 10');
      mockSubject.batchId = batch.id;
      batch.addSubject(mockSubject);
      
      expect(batch.getSubjectByName('Mathematics')).toBe(mockSubject);
      expect(batch.getSubjectByName('mathematics')).toBe(mockSubject);
    });

    it('should return undefined for non-existing name', () => {
      const batch = new Batch('Grade 10');
      
      const result = batch.getSubjectByName('Physics');
      
      expect(result).toBeUndefined();
    });
  });

  describe('getTotalLecturesPerWeek', () => {
    it('should calculate total lectures correctly', () => {
      const batch = new Batch('Grade 10');
      
      const subject1 = { ...mockSubject, id: 'sub1', batchId: batch.id, lecturesPerWeek: 5 };
      const subject2 = { ...mockSubject, id: 'sub2', name: 'Physics', batchId: batch.id, lecturesPerWeek: 3 };
      
      batch.addSubject(subject1);
      batch.addSubject(subject2);
      
      expect(batch.getTotalLecturesPerWeek()).toBe(8);
    });

    it('should return 0 for batch with no subjects', () => {
      const batch = new Batch('Grade 10');
      
      expect(batch.getTotalLecturesPerWeek()).toBe(0);
    });
  });

  describe('getTotalDurationPerWeek', () => {
    it('should calculate total duration correctly', () => {
      const batch = new Batch('Grade 10');
      
      const subject1 = { ...mockSubject, id: 'sub1', batchId: batch.id, lecturesPerWeek: 5, lectureDuration: 60 };
      const subject2 = { ...mockSubject, id: 'sub2', name: 'Physics', batchId: batch.id, lecturesPerWeek: 3, lectureDuration: 45 };
      
      batch.addSubject(subject1);
      batch.addSubject(subject2);
      
      expect(batch.getTotalDurationPerWeek()).toBe(435); // 5*60 + 3*45
    });
  });

  describe('validate', () => {
    it('should return valid result for valid batch', () => {
      const batch = new Batch('Grade 10');
      
      const result = batch.validate();
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid batch name', () => {
      const batch = new Batch('Valid Name');
      batch.name = ''; // Make it invalid after construction
      
      const result = batch.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Batch name must be between 1 and 50 characters');
    });

    it('should detect duplicate subject names', () => {
      const batch = new Batch('Grade 10');
      
      const subject1 = { ...mockSubject, id: 'sub1', batchId: batch.id };
      const subject2 = { ...mockSubject, id: 'sub2', batchId: batch.id };
      
      batch.subjects.push(subject1, subject2); // Bypass addSubject validation
      
      const result = batch.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Duplicate subject names');
    });

    it('should warn for too many subjects', () => {
      const batch = new Batch('Grade 10');
      
      // Add 16 subjects
      for (let i = 0; i < 16; i++) {
        batch.subjects.push({
          ...mockSubject,
          id: `sub_${i}`,
          name: `Subject ${i}`,
          batchId: batch.id
        });
      }
      
      const result = batch.validate();
      
      expect(result.warnings).toContain('Batch has more than 15 subjects, which may be difficult to schedule');
    });

    it('should warn for excessive weekly duration', () => {
      const batch = new Batch('Grade 10');
      
      // Add subject with very long duration
      batch.subjects.push({
        ...mockSubject,
        batchId: batch.id,
        lecturesPerWeek: 50,
        lectureDuration: 60 // 50 hours per week
      });
      
      const result = batch.validate();
      
      expect(result.warnings).toContain('Total weekly lecture duration exceeds 40 hours');
    });
  });

  describe('updateName', () => {
    it('should update name with valid input', () => {
      const batch = new Batch('Grade 10');
      
      batch.updateName('Grade 11');
      
      expect(batch.name).toBe('Grade 11');
    });

    it('should throw error for invalid name', () => {
      const batch = new Batch('Grade 10');
      
      expect(() => batch.updateName('')).toThrow('Invalid batch name');
    });
  });

  describe('getSummary', () => {
    it('should return correct summary', () => {
      const batch = new Batch('Grade 10');
      
      const subject1 = { ...mockSubject, id: 'sub1', batchId: batch.id, lecturesPerWeek: 5, lectureDuration: 60 };
      batch.addSubject(subject1);
      
      const summary = batch.getSummary();
      
      expect(summary).toContain('Grade 10');
      expect(summary).toContain('1 subjects');
      expect(summary).toContain('5 lectures/week');
      expect(summary).toContain('5h/week');
    });
  });

  describe('clone', () => {
    it('should create a deep copy', () => {
      const batch = new Batch('Grade 10');
      mockSubject.batchId = batch.id;
      batch.addSubject(mockSubject);
      
      const cloned = batch.clone();
      
      expect(cloned.id).toBe(batch.id);
      expect(cloned.name).toBe(batch.name);
      expect(cloned.subjects).toEqual(batch.subjects);
      expect(cloned.subjects).not.toBe(batch.subjects); // Different array reference
    });
  });

  describe('JSON serialization', () => {
    it('should convert to JSON correctly', () => {
      const batch = new Batch('Grade 10');
      mockSubject.batchId = batch.id;
      batch.addSubject(mockSubject);
      
      const json = batch.toJSON();
      
      expect(json.id).toBe(batch.id);
      expect(json.name).toBe(batch.name);
      expect(json.subjects).toEqual(batch.subjects);
    });

    it('should create from JSON correctly', () => {
      const data = {
        id: 'batch_1',
        name: 'Grade 10',
        subjects: [mockSubject]
      };
      
      const batch = Batch.fromJSON(data);
      
      expect(batch.id).toBe(data.id);
      expect(batch.name).toBe(data.name);
      expect(batch.subjects).toEqual(data.subjects);
    });
  });
});
