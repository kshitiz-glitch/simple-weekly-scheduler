import * as readlineSync from 'readline-sync';
import { InputManager as IInputManager } from './index';
import { Batch, Subject, Faculty, ValidationResult } from '../models';
import { IdGenerator, ValidationUtils } from '../utils';
import { SubjectInput } from '../ui';

export class InputManager implements IInputManager {
  private faculties: Map<string, Faculty> = new Map();

  /**
   * Collect batch information from user
   */
  async collectBatchInfo(): Promise<Batch[]> {
    console.log('\n=== Batch Configuration ===');
    
    const batchCount = this.promptForBatchCount();
    const batches: Batch[] = [];

    for (let i = 0; i < batchCount; i++) {
      const batchName = this.promptForBatchName(i + 1);
      
      try {
        const batch = new Batch(batchName);
        batches.push(batch);
        console.log(`✓ Batch '${batchName}' created successfully`);
      } catch (error) {
        console.log(`✗ Error creating batch: ${error.message}`);
        i--; // Retry this batch
      }
    }

    return batches;
  }

  /**
   * Collect subject information for a batch
   */
  async collectSubjectInfo(batch: Batch): Promise<Subject[]> {
    console.log(`\n=== Subject Configuration for ${batch.name} ===`);
    
    const subjectCount = this.promptForSubjectCount(batch.name);
    const subjects: Subject[] = [];

    for (let i = 0; i < subjectCount; i++) {
      console.log(`\nSubject ${i + 1} of ${subjectCount}:`);
      
      try {
        const subjectInput = this.promptForSubjectDetails(batch.name, i + 1);
        
        // Get or create faculty
        const faculty = this.getOrCreateFaculty(subjectInput.facultyName);
        
        // Create subject
        const subject = new Subject(
          subjectInput.name,
          batch.id,
          subjectInput.lecturesPerWeek,
          subjectInput.lectureDuration,
          faculty.id
        );

        // Add subject to faculty
        faculty.addSubject(subject.id);
        
        subjects.push(subject);
        console.log(`✓ Subject '${subjectInput.name}' created successfully`);
        
        // Show validation warnings if any
        const validation = subject.validate();
        if (validation.warnings.length > 0) {
          console.log('⚠️  Warnings:');
          validation.warnings.forEach(warning => console.log(`   - ${warning}`));
        }
        
      } catch (error) {
        console.log(`✗ Error creating subject: ${error.message}`);
        i--; // Retry this subject
      }
    }

    return subjects;
  }

  /**
   * Collect holiday information from user
   */
  async collectHolidays(): Promise<Date[]> {
    console.log('\n=== Holiday Configuration ===');
    
    const hasHolidays = readlineSync.keyInYNStrict('Do you want to configure holidays?');
    
    if (!hasHolidays) {
      return [];
    }

    const holidays: Date[] = [];
    
    while (true) {
      const dateStr = readlineSync.question('Enter holiday date (YYYY-MM-DD) or press Enter to finish: ');
      
      if (!dateStr.trim()) {
        break;
      }

      try {
        const date = this.parseDate(dateStr);
        
        if (holidays.some(h => h.getTime() === date.getTime())) {
          console.log('⚠️  This date is already added as a holiday');
          continue;
        }
        
        holidays.push(date);
        console.log(`✓ Holiday added: ${date.toDateString()}`);
        
      } catch (error) {
        console.log(`✗ Invalid date format: ${error.message}`);
      }
    }

    console.log(`\n✓ Total holidays configured: ${holidays.length}`);
    return holidays;
  }

  /**
   * Validate input data
   */
  validateInput(data: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data) {
      errors.push('Input data is required');
      return { isValid: false, errors, warnings };
    }

    // Validate based on data type
    if (typeof data === 'string') {
      return this.validateStringInput(data);
    }

    if (typeof data === 'number') {
      return this.validateNumberInput(data);
    }

    if (data instanceof Date) {
      return this.validateDateInput(data);
    }

    if (Array.isArray(data)) {
      return this.validateArrayInput(data);
    }

    return { isValid: true, errors, warnings };
  }

  /**
   * Prompt for number of batches
   */
  private promptForBatchCount(): number {
    while (true) {
      const input = readlineSync.question('Enter the number of batches/classes: ');
      
      try {
        const count = parseInt(input, 10);
        
        if (isNaN(count) || count <= 0) {
          console.log('✗ Please enter a positive number');
          continue;
        }
        
        if (count > 20) {
          const confirm = readlineSync.keyInYNStrict(
            `You entered ${count} batches. This is quite large and may be difficult to schedule. Continue?`
          );
          if (!confirm) {
            continue;
          }
        }
        
        return count;
        
      } catch (error) {
        console.log('✗ Please enter a valid number');
      }
    }
  }

  /**
   * Prompt for batch name
   */
  private promptForBatchName(index: number): string {
    while (true) {
      const name = readlineSync.question(`Enter name for batch ${index}: `);
      
      if (!ValidationUtils.isValidBatchName(name)) {
        console.log('✗ Batch name must be between 1 and 50 characters');
        continue;
      }
      
      return name.trim();
    }
  }

  /**
   * Prompt for number of subjects in a batch
   */
  private promptForSubjectCount(batchName: string): number {
    while (true) {
      const input = readlineSync.question(`Enter the number of subjects for ${batchName}: `);
      
      try {
        const count = parseInt(input, 10);
        
        if (isNaN(count) || count <= 0) {
          console.log('✗ Please enter a positive number');
          continue;
        }
        
        if (count > 15) {
          const confirm = readlineSync.keyInYNStrict(
            `You entered ${count} subjects. This is quite large and may be difficult to schedule. Continue?`
          );
          if (!confirm) {
            continue;
          }
        }
        
        return count;
        
      } catch (error) {
        console.log('✗ Please enter a valid number');
      }
    }
  }

  /**
   * Prompt for subject details
   */
  private promptForSubjectDetails(batchName: string, subjectIndex: number): SubjectInput {
    // Subject name
    const name = this.promptForSubjectName(subjectIndex);
    
    // Lectures per week
    const lecturesPerWeek = this.promptForLecturesPerWeek(name);
    
    // Lecture duration
    const lectureDuration = this.promptForLectureDuration(name);
    
    // Faculty name
    const facultyName = this.promptForFacultyName(name);
    
    return {
      name,
      lecturesPerWeek,
      lectureDuration,
      facultyName
    };
  }

  /**
   * Prompt for subject name
   */
  private promptForSubjectName(index: number): string {
    while (true) {
      const name = readlineSync.question(`  Subject ${index} name: `);
      
      if (!ValidationUtils.isValidSubjectName(name)) {
        console.log('  ✗ Subject name must be between 1 and 100 characters');
        continue;
      }
      
      return name.trim();
    }
  }

  /**
   * Prompt for lectures per week
   */
  private promptForLecturesPerWeek(subjectName: string): number {
    while (true) {
      const input = readlineSync.question(`  Lectures per week for ${subjectName}: `);
      
      try {
        const count = parseInt(input, 10);
        
        if (!ValidationUtils.isValidLectureCount(count)) {
          console.log('  ✗ Lectures per week must be between 1 and 20');
          continue;
        }
        
        if (count > 10) {
          const confirm = readlineSync.keyInYNStrict(
            `  ${count} lectures per week is quite high. Continue?`
          );
          if (!confirm) {
            continue;
          }
        }
        
        return count;
        
      } catch (error) {
        console.log('  ✗ Please enter a valid number');
      }
    }
  }

  /**
   * Prompt for lecture duration
   */
  private promptForLectureDuration(subjectName: string): number {
    while (true) {
      const input = readlineSync.question(`  Duration per lecture for ${subjectName} (minutes): `);
      
      try {
        const duration = parseInt(input, 10);
        
        if (!ValidationUtils.isValidLectureDuration(duration)) {
          console.log('  ✗ Lecture duration must be between 30 and 180 minutes');
          continue;
        }
        
        if (duration > 120) {
          const confirm = readlineSync.keyInYNStrict(
            `  ${duration} minutes (${Math.round(duration/60*10)/10} hours) is quite long. Continue?`
          );
          if (!confirm) {
            continue;
          }
        }
        
        return duration;
        
      } catch (error) {
        console.log('  ✗ Please enter a valid number');
      }
    }
  }

  /**
   * Prompt for faculty name
   */
  private promptForFacultyName(subjectName: string): string {
    // Show existing faculties
    if (this.faculties.size > 0) {
      console.log('  Existing faculties:');
      Array.from(this.faculties.values()).forEach((faculty, index) => {
        console.log(`    ${index + 1}. ${faculty.name} (${faculty.getSubjectCount()} subjects)`);
      });
    }
    
    while (true) {
      const name = readlineSync.question(`  Faculty name for ${subjectName}: `);
      
      if (!ValidationUtils.isValidFacultyName(name)) {
        console.log('  ✗ Faculty name must be between 1 and 100 characters');
        continue;
      }
      
      return name.trim();
    }
  }

  /**
   * Get existing faculty or create new one
   */
  private getOrCreateFaculty(facultyName: string): Faculty {
    // Check if faculty already exists (case insensitive)
    const existingFaculty = Array.from(this.faculties.values())
      .find(f => f.name.toLowerCase() === facultyName.toLowerCase());
    
    if (existingFaculty) {
      return existingFaculty;
    }
    
    // Create new faculty
    const faculty = new Faculty(facultyName);
    this.faculties.set(faculty.id, faculty);
    
    return faculty;
  }

  /**
   * Parse date string to Date object
   */
  private parseDate(dateStr: string): Date {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    
    if (!dateRegex.test(dateStr)) {
      throw new Error('Date must be in YYYY-MM-DD format');
    }
    
    const date = new Date(dateStr + 'T00:00:00.000Z');
    
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    
    // Check if date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date < today) {
      const confirm = readlineSync.keyInYNStrict(
        `The date ${dateStr} is in the past. Add it anyway?`
      );
      if (!confirm) {
        throw new Error('Date rejected by user');
      }
    }
    
    return date;
  }

  /**
   * Validate string input
   */
  private validateStringInput(input: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input || input.trim().length === 0) {
      errors.push('Input cannot be empty');
    }

    if (input.length > 200) {
      warnings.push('Input is very long and may be truncated');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate number input
   */
  private validateNumberInput(input: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (isNaN(input)) {
      errors.push('Input must be a valid number');
    }

    if (input < 0) {
      errors.push('Input must be non-negative');
    }

    if (input > 1000) {
      warnings.push('Input is very large');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate date input
   */
  private validateDateInput(input: Date): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (isNaN(input.getTime())) {
      errors.push('Invalid date');
    }

    const today = new Date();
    if (input < today) {
      warnings.push('Date is in the past');
    }

    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    if (input > oneYearFromNow) {
      warnings.push('Date is more than one year in the future');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate array input
   */
  private validateArrayInput(input: any[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (input.length === 0) {
      warnings.push('Array is empty');
    }

    if (input.length > 100) {
      warnings.push('Array is very large');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Get all created faculties
   */
  getFaculties(): Faculty[] {
    return Array.from(this.faculties.values());
  }

  /**
   * Clear all data (useful for testing)
   */
  clear(): void {
    this.faculties.clear();
  }

  /**
   * Display configuration summary
   */
  displaySummary(batches: Batch[], holidays: Date[]): void {
    console.log('\n=== Configuration Summary ===');
    
    console.log(`\nBatches: ${batches.length}`);
    batches.forEach((batch, index) => {
      console.log(`  ${index + 1}. ${batch.getSummary()}`);
    });
    
    console.log(`\nFaculties: ${this.faculties.size}`);
    this.getFaculties().forEach((faculty, index) => {
      console.log(`  ${index + 1}. ${faculty.getSummary()}`);
    });
    
    console.log(`\nHolidays: ${holidays.length}`);
    if (holidays.length > 0) {
      holidays.forEach((holiday, index) => {
        console.log(`  ${index + 1}. ${holiday.toDateString()}`);
      });
    } else {
      console.log('  None configured');
    }
    
    // Calculate totals
    const totalSubjects = batches.reduce((sum, batch) => sum + batch.subjects.length, 0);
    const totalLectures = batches.reduce((sum, batch) => sum + batch.getTotalLecturesPerWeek(), 0);
    
    console.log(`\nTotals:`);
    console.log(`  Subjects: ${totalSubjects}`);
    console.log(`  Lectures per week: ${totalLectures}`);
  }
}
