import { Faculty } from '../Faculty';

describe('Faculty', () => {
  describe('constructor', () => {
    it('should create a faculty with valid name', () => {
      const faculty = new Faculty('Dr. Smith');
      
      expect(faculty.name).toBe('Dr. Smith');
      expect(faculty.id).toBeDefined();
      expect(faculty.subjects).toEqual([]);
    });

    it('should create a faculty with custom ID', () => {
      const customId = 'custom_faculty_id';
      const faculty = new Faculty('Dr. Smith', customId);
      
      expect(faculty.id).toBe(customId);
    });

    it('should throw error for invalid name', () => {
      expect(() => new Faculty('')).toThrow('Invalid faculty');
      expect(() => new Faculty('a'.repeat(101))).toThrow('Invalid faculty');
    });
  });

  describe('addSubject', () => {
    it('should add a valid subject ID', () => {
      const faculty = new Faculty('Dr. Smith');
      
      faculty.addSubject('subject_1');
      
      expect(faculty.subjects).toContain('subject_1');
      expect(faculty.getSubjectCount()).toBe(1);
    });

    it('should throw error for empty subject ID', () => {
      const faculty = new Faculty('Dr. Smith');
      
      expect(() => faculty.addSubject('')).toThrow('Subject ID cannot be empty');
      expect(() => faculty.addSubject('   ')).toThrow('Subject ID cannot be empty');
    });

    it('should throw error for duplicate subject ID', () => {
      const faculty = new Faculty('Dr. Smith');
      faculty.addSubject('subject_1');
      
      expect(() => faculty.addSubject('subject_1')).toThrow('already assigned');
    });
  });

  describe('removeSubject', () => {
    it('should remove existing subject', () => {
      const faculty = new Faculty('Dr. Smith');
      faculty.addSubject('subject_1');
      
      const result = faculty.removeSubject('subject_1');
      
      expect(result).toBe(true);
      expect(faculty.subjects).not.toContain('subject_1');
      expect(faculty.getSubjectCount()).toBe(0);
    });

    it('should return false for non-existing subject', () => {
      const faculty = new Faculty('Dr. Smith');
      
      const result = faculty.removeSubject('non_existing');
      
      expect(result).toBe(false);
    });
  });

  describe('hasSubject', () => {
    it('should return true for assigned subject', () => {
      const faculty = new Faculty('Dr. Smith');
      faculty.addSubject('subject_1');
      
      expect(faculty.hasSubject('subject_1')).toBe(true);
    });

    it('should return false for non-assigned subject', () => {
      const faculty = new Faculty('Dr. Smith');
      
      expect(faculty.hasSubject('subject_1')).toBe(false);
    });
  });

  describe('getSubjectCount', () => {
    it('should return correct count', () => {
      const faculty = new Faculty('Dr. Smith');
      
      expect(faculty.getSubjectCount()).toBe(0);
      
      faculty.addSubject('subject_1');
      expect(faculty.getSubjectCount()).toBe(1);
      
      faculty.addSubject('subject_2');
      expect(faculty.getSubjectCount()).toBe(2);
    });
  });

  describe('isAvailable', () => {
    it('should return false for faculty with no subjects', () => {
      const faculty = new Faculty('Dr. Smith');
      
      expect(faculty.isAvailable()).toBe(false);
    });

    it('should return true for faculty with subjects', () => {
      const faculty = new Faculty('Dr. Smith');
      faculty.addSubject('subject_1');
      
      expect(faculty.isAvailable()).toBe(true);
    });
  });

  describe('updateName', () => {
    it('should update name with valid input', () => {
      const faculty = new Faculty('Dr. Smith');
      
      faculty.updateName('Dr. Johnson');
      
      expect(faculty.name).toBe('Dr. Johnson');
    });

    it('should throw error for invalid name', () => {
      const faculty = new Faculty('Dr. Smith');
      
      expect(() => faculty.updateName('')).toThrow('Invalid faculty name');
    });
  });

  describe('clearSubjects', () => {
    it('should remove all subjects', () => {
      const faculty = new Faculty('Dr. Smith');
      faculty.addSubject('subject_1');
      faculty.addSubject('subject_2');
      
      faculty.clearSubjects();
      
      expect(faculty.subjects).toEqual([]);
      expect(faculty.getSubjectCount()).toBe(0);
    });
  });

  describe('setSubjects', () => {
    it('should set subjects with valid IDs', () => {
      const faculty = new Faculty('Dr. Smith');
      const subjectIds = ['subject_1', 'subject_2', 'subject_3'];
      
      faculty.setSubjects(subjectIds);
      
      expect(faculty.subjects).toEqual(subjectIds);
      expect(faculty.getSubjectCount()).toBe(3);
    });

    it('should throw error for empty subject ID', () => {
      const faculty = new Faculty('Dr. Smith');
      
      expect(() => faculty.setSubjects(['subject_1', ''])).toThrow('All subject IDs must be non-empty');
    });

    it('should throw error for duplicate subject IDs', () => {
      const faculty = new Faculty('Dr. Smith');
      
      expect(() => faculty.setSubjects(['subject_1', 'subject_1'])).toThrow('Duplicate subject IDs');
    });
  });

  describe('validate', () => {
    it('should return valid result for valid faculty', () => {
      const faculty = new Faculty('Dr. Smith');
      faculty.addSubject('subject_1');
      
      const result = faculty.validate();
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid faculty name', () => {
      const faculty = new Faculty('Valid Name');
      faculty.name = ''; // Make it invalid after construction
      
      const result = faculty.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Faculty name must be between 1 and 100 characters');
    });

    it('should detect duplicate subject assignments', () => {
      const faculty = new Faculty('Dr. Smith');
      faculty.subjects = ['subject_1', 'subject_1']; // Bypass validation
      
      const result = faculty.validate();
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Faculty has duplicate subject assignments');
    });

    it('should warn for too many subjects', () => {
      const faculty = new Faculty('Dr. Smith');
      
      // Add 11 subjects
      for (let i = 0; i < 11; i++) {
        faculty.subjects.push(`subject_${i}`);
      }
      
      const result = faculty.validate();
      
      expect(result.warnings).toContain('Faculty assigned to more than 10 subjects may have scheduling conflicts');
    });

    it('should warn for no subjects', () => {
      const faculty = new Faculty('Dr. Smith');
      
      const result = faculty.validate();
      
      expect(result.warnings).toContain('Faculty has no subject assignments');
    });
  });

  describe('getSummary', () => {
    it('should return correct summary for single subject', () => {
      const faculty = new Faculty('Dr. Smith');
      faculty.addSubject('subject_1');
      
      const summary = faculty.getSummary();
      
      expect(summary).toBe('Dr. Smith (1 subject)');
    });

    it('should return correct summary for multiple subjects', () => {
      const faculty = new Faculty('Dr. Smith');
      faculty.addSubject('subject_1');
      faculty.addSubject('subject_2');
      
      const summary = faculty.getSummary();
      
      expect(summary).toBe('Dr. Smith (2 subjects)');
    });
  });

  describe('getDetails', () => {
    it('should return detailed information', () => {
      const faculty = new Faculty('Dr. Smith');
      faculty.addSubject('subject_1');
      faculty.addSubject('subject_2');
      
      const details = faculty.getDetails();
      
      expect(details).toContain('Faculty: Dr. Smith');
      expect(details).toContain('Subjects assigned: 2');
      expect(details).toContain('Subject IDs: subject_1, subject_2');
    });

    it('should handle faculty with no subjects', () => {
      const faculty = new Faculty('Dr. Smith');
      
      const details = faculty.getDetails();
      
      expect(details).toContain('Subjects assigned: 0');
      expect(details).toContain('Subject IDs: None');
    });
  });

  describe('canHandleMoreSubjects', () => {
    it('should return true when under limit', () => {
      const faculty = new Faculty('Dr. Smith');
      faculty.addSubject('subject_1');
      
      expect(faculty.canHandleMoreSubjects(10)).toBe(true);
    });

    it('should return false when at limit', () => {
      const faculty = new Faculty('Dr. Smith');
      
      for (let i = 0; i < 10; i++) {
        faculty.addSubject(`subject_${i}`);
      }
      
      expect(faculty.canHandleMoreSubjects(10)).toBe(false);
    });

    it('should use default limit of 10', () => {
      const faculty = new Faculty('Dr. Smith');
      
      for (let i = 0; i < 10; i++) {
        faculty.addSubject(`subject_${i}`);
      }
      
      expect(faculty.canHandleMoreSubjects()).toBe(false);
    });
  });

  describe('clone', () => {
    it('should create a deep copy', () => {
      const faculty = new Faculty('Dr. Smith');
      faculty.addSubject('subject_1');
      faculty.addSubject('subject_2');
      
      const cloned = faculty.clone();
      
      expect(cloned.id).toBe(faculty.id);
      expect(cloned.name).toBe(faculty.name);
      expect(cloned.subjects).toEqual(faculty.subjects);
      expect(cloned.subjects).not.toBe(faculty.subjects); // Different array reference
    });
  });

  describe('JSON serialization', () => {
    it('should convert to JSON correctly', () => {
      const faculty = new Faculty('Dr. Smith');
      faculty.addSubject('subject_1');
      faculty.addSubject('subject_2');
      
      const json = faculty.toJSON();
      
      expect(json.id).toBe(faculty.id);
      expect(json.name).toBe(faculty.name);
      expect(json.subjects).toEqual(faculty.subjects);
    });

    it('should create from JSON correctly', () => {
      const data = {
        id: 'faculty_1',
        name: 'Dr. Smith',
        subjects: ['subject_1', 'subject_2']
      };
      
      const faculty = Faculty.fromJSON(data);
      
      expect(faculty.id).toBe(data.id);
      expect(faculty.name).toBe(data.name);
      expect(faculty.subjects).toEqual(data.subjects);
    });
  });

  describe('utility methods', () => {
    let faculty1: Faculty;
    let faculty2: Faculty;

    beforeEach(() => {
      faculty1 = new Faculty('Dr. Adams');
      faculty2 = new Faculty('Dr. Brown');
    });

    describe('compareTo', () => {
      it('should compare faculties by name', () => {
        expect(faculty1.compareTo(faculty2)).toBeLessThan(0); // Adams < Brown
        expect(faculty2.compareTo(faculty1)).toBeGreaterThan(0); // Brown > Adams
        expect(faculty1.compareTo(faculty1)).toBe(0); // Same faculty
      });
    });

    describe('equals', () => {
      it('should return true for same faculty', () => {
        expect(faculty1.equals(faculty1)).toBe(true);
      });

      it('should return false for different faculties', () => {
        expect(faculty1.equals(faculty2)).toBe(false);
      });
    });

    describe('hashCode', () => {
      it('should return faculty ID as hash code', () => {
        expect(faculty1.hashCode()).toBe(faculty1.id);
      });
    });
  });
});
