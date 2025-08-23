import { ConstraintEngine as IConstraintEngine } from './index';
import { ConstraintViolation, ScheduleEntry, TimeSlot } from '../models';
import { BaseConstraint, FacultyConflictConstraint, TimeSlotAvailabilityConstraint } from './constraints';

export class ConstraintEngine implements IConstraintEngine {
  private constraints: Map<string, BaseConstraint> = new Map();
  private violationHistory: ConstraintViolation[] = [];
  private isEnabled: boolean = true;

  constructor() {
    this.initializeDefaultConstraints();
  }

  /**
   * Add a constraint to the engine
   */
  addConstraint(constraint: BaseConstraint): void {
    this.constraints.set(constraint.type, constraint);
  }

  /**
   * Remove a constraint from the engine
   */
  removeConstraint(constraintType: string): boolean {
    return this.constraints.delete(constraintType);
  }

  /**
   * Get a constraint by type
   */
  getConstraint(constraintType: string): BaseConstraint | undefined {
    return this.constraints.get(constraintType);
  }

  /**
   * Get all constraints
   */
  getAllConstraints(): BaseConstraint[] {
    return Array.from(this.constraints.values());
  }

  /**
   * Get enabled constraints sorted by priority
   */
  getEnabledConstraints(): BaseConstraint[] {
    return Array.from(this.constraints.values())
      .filter(constraint => constraint.isConstraintEnabled())
      .sort((a, b) => a.compareTo(b));
  }

  /**
   * Validate a complete schedule against all constraints
   */
  validateSchedule(schedule: ScheduleEntry[]): ConstraintViolation[] {
    if (!this.isEnabled) {
      return [];
    }

    const violations: ConstraintViolation[] = [];
    const enabledConstraints = this.getEnabledConstraints();

    // Validate each schedule entry against all constraints
    schedule.forEach(entry => {
      const otherEntries = schedule.filter(other => other !== entry);
      
      enabledConstraints.forEach(constraint => {
        try {
          const violation = constraint.validate(entry, otherEntries);
          if (violation) {
            violations.push(violation);
          }
        } catch (error) {
          // Create a violation for constraint execution errors
          violations.push({
            type: 'constraint-error',
            message: `Constraint '${constraint.type}' failed: ${error.message}`,
            affectedEntries: [entry],
            severity: 'error'
          });
        }
      });
    });

    // Store violations in history
    this.violationHistory.push(...violations);

    return violations;
  }

  /**
   * Check if a specific faculty has conflicts
   */
  checkFacultyConflict(entry: ScheduleEntry, existing: ScheduleEntry[]): boolean {
    const facultyConstraint = this.getConstraint('faculty-conflict') as FacultyConflictConstraint;
    
    if (!facultyConstraint || !facultyConstraint.isConstraintEnabled()) {
      return false;
    }

    const violation = facultyConstraint.validate(entry, existing);
    return violation !== null;
  }

  /**
   * Check if a time slot is available
   */
  checkTimeSlotAvailability(slot: TimeSlot, holidays: Date[]): boolean {
    const availabilityConstraint = this.getConstraint('timeslot-availability') as TimeSlotAvailabilityConstraint;
    
    if (!availabilityConstraint || !availabilityConstraint.isConstraintEnabled()) {
      return slot.isAvailable;
    }

    // Create a dummy schedule entry to test the time slot
    const dummyEntry: ScheduleEntry = {
      batchId: 'test',
      subjectId: 'test',
      facultyId: 'test',
      timeSlot: slot
    };

    // Update constraint with holidays if provided
    if (holidays.length > 0) {
      holidays.forEach(holiday => availabilityConstraint.addHoliday(holiday));
    }

    const violation = availabilityConstraint.validate(dummyEntry, []);
    return violation === null;
  }

  /**
   * Find all violations for a specific schedule entry
   */
  findViolationsForEntry(entry: ScheduleEntry, existing: ScheduleEntry[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const enabledConstraints = this.getEnabledConstraints();

    enabledConstraints.forEach(constraint => {
      try {
        const violation = constraint.validate(entry, existing);
        if (violation) {
          violations.push(violation);
        }
      } catch (error) {
        violations.push({
          type: 'constraint-error',
          message: `Constraint '${constraint.type}' failed: ${error.message}`,
          affectedEntries: [entry],
          severity: 'error'
        });
      }
    });

    return violations;
  }

  /**
   * Get suggestions for resolving violations
   */
  getSuggestions(violations: ConstraintViolation[]): string[] {
    const suggestions: string[] = [];

    violations.forEach(violation => {
      switch (violation.type) {
        case 'faculty-conflict':
          suggestions.push(
            'Consider rescheduling one of the conflicting lectures to a different time slot',
            'Assign a different faculty member to one of the subjects',
            'Split the lecture into smaller sessions'
          );
          break;

        case 'timeslot-availability':
          suggestions.push(
            'Choose a different time slot within working hours',
            'Reschedule to a working day',
            'Check if the time slot is marked as available'
          );
          break;

        default:
          suggestions.push('Review the constraint requirements and adjust the schedule accordingly');
      }
    });

    // Remove duplicates
    return [...new Set(suggestions)];
  }

  /**
   * Get constraint statistics
   */
  getConstraintStatistics(): {
    totalConstraints: number;
    enabledConstraints: number;
    disabledConstraints: number;
    constraintTypes: string[];
    totalViolations: number;
    violationsByType: Map<string, number>;
  } {
    const allConstraints = this.getAllConstraints();
    const enabledConstraints = this.getEnabledConstraints();
    
    const violationsByType = new Map<string, number>();
    this.violationHistory.forEach(violation => {
      const count = violationsByType.get(violation.type) || 0;
      violationsByType.set(violation.type, count + 1);
    });

    return {
      totalConstraints: allConstraints.length,
      enabledConstraints: enabledConstraints.length,
      disabledConstraints: allConstraints.length - enabledConstraints.length,
      constraintTypes: allConstraints.map(c => c.type),
      totalViolations: this.violationHistory.length,
      violationsByType
    };
  }

  /**
   * Clear violation history
   */
  clearViolationHistory(): void {
    this.violationHistory = [];
  }

  /**
   * Get violation history
   */
  getViolationHistory(): ConstraintViolation[] {
    return [...this.violationHistory];
  }

  /**
   * Enable or disable the entire constraint engine
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Check if the constraint engine is enabled
   */
  isEngineEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Enable a specific constraint
   */
  enableConstraint(constraintType: string): boolean {
    const constraint = this.getConstraint(constraintType);
    if (constraint) {
      constraint.setEnabled(true);
      return true;
    }
    return false;
  }

  /**
   * Disable a specific constraint
   */
  disableConstraint(constraintType: string): boolean {
    const constraint = this.getConstraint(constraintType);
    if (constraint) {
      constraint.setEnabled(false);
      return true;
    }
    return false;
  }

  /**
   * Validate a single entry against all constraints
   */
  validateEntry(entry: ScheduleEntry, existing: ScheduleEntry[]): {
    isValid: boolean;
    violations: ConstraintViolation[];
    suggestions: string[];
  } {
    const violations = this.findViolationsForEntry(entry, existing);
    const suggestions = this.getSuggestions(violations);

    return {
      isValid: violations.length === 0,
      violations,
      suggestions
    };
  }

  /**
   * Find alternative time slots that satisfy all constraints
   */
  findAlternativeTimeSlots(
    entry: ScheduleEntry,
    existing: ScheduleEntry[],
    candidateSlots: TimeSlot[]
  ): TimeSlot[] {
    const validSlots: TimeSlot[] = [];

    candidateSlots.forEach(slot => {
      const testEntry: ScheduleEntry = {
        ...entry,
        timeSlot: slot
      };

      const violations = this.findViolationsForEntry(testEntry, existing);
      if (violations.length === 0) {
        validSlots.push(slot);
      }
    });

    return validSlots;
  }

  /**
   * Get constraint configuration
   */
  getConfiguration(): {
    engineEnabled: boolean;
    constraints: {
      type: string;
      description: string;
      priority: number;
      enabled: boolean;
    }[];
  } {
    return {
      engineEnabled: this.isEnabled,
      constraints: this.getAllConstraints().map(constraint => constraint.getConfiguration())
    };
  }

  /**
   * Load configuration
   */
  loadConfiguration(config: {
    engineEnabled: boolean;
    constraints: {
      type: string;
      enabled: boolean;
    }[];
  }): void {
    this.setEnabled(config.engineEnabled);

    config.constraints.forEach(constraintConfig => {
      const constraint = this.getConstraint(constraintConfig.type);
      if (constraint) {
        constraint.setEnabled(constraintConfig.enabled);
      }
    });
  }

  /**
   * Reset to default configuration
   */
  resetToDefaults(): void {
    this.constraints.clear();
    this.violationHistory = [];
    this.isEnabled = true;
    this.initializeDefaultConstraints();
  }

  /**
   * Get detailed violation report
   */
  getViolationReport(schedule: ScheduleEntry[]): {
    totalViolations: number;
    errorViolations: number;
    warningViolations: number;
    violationsByType: Map<string, ConstraintViolation[]>;
    affectedEntries: Set<ScheduleEntry>;
    mostViolatedConstraint: string | null;
  } {
    const violations = this.validateSchedule(schedule);
    const violationsByType = new Map<string, ConstraintViolation[]>();
    const affectedEntries = new Set<ScheduleEntry>();

    let errorCount = 0;
    let warningCount = 0;

    violations.forEach(violation => {
      if (violation.severity === 'error') {
        errorCount++;
      } else {
        warningCount++;
      }

      if (!violationsByType.has(violation.type)) {
        violationsByType.set(violation.type, []);
      }
      violationsByType.get(violation.type)!.push(violation);

      violation.affectedEntries.forEach(entry => affectedEntries.add(entry));
    });

    // Find most violated constraint
    let mostViolatedConstraint: string | null = null;
    let maxViolations = 0;

    violationsByType.forEach((violations, type) => {
      if (violations.length > maxViolations) {
        maxViolations = violations.length;
        mostViolatedConstraint = type;
      }
    });

    return {
      totalViolations: violations.length,
      errorViolations: errorCount,
      warningViolations: warningCount,
      violationsByType,
      affectedEntries,
      mostViolatedConstraint
    };
  }

  /**
   * Initialize default constraints
   */
  private initializeDefaultConstraints(): void {
    this.addConstraint(new FacultyConflictConstraint());
    this.addConstraint(new TimeSlotAvailabilityConstraint());
  }

  /**
   * Clone the constraint engine
   */
  clone(): ConstraintEngine {
    const cloned = new ConstraintEngine();
    cloned.constraints.clear(); // Remove default constraints

    // Clone all constraints
    this.constraints.forEach((constraint, type) => {
      cloned.addConstraint(constraint.clone());
    });

    cloned.setEnabled(this.isEnabled);
    
    return cloned;
  }
}
