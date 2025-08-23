import { ConstraintViolation, ScheduleEntry, TimeSlot } from '../../models';
import { Constraint } from '../index';

export abstract class BaseConstraint implements Constraint {
  public readonly type: string;
  protected description: string;
  protected priority: number;
  protected isEnabled: boolean;

  constructor(type: string, description: string, priority: number = 50) {
    this.type = type;
    this.description = description;
    this.priority = priority;
    this.isEnabled = true;
  }

  /**
   * Validate a schedule entry against this constraint
   */
  abstract validate(entry: ScheduleEntry, existing: ScheduleEntry[]): ConstraintViolation | null;

  /**
   * Get constraint description
   */
  getDescription(): string {
    return this.description;
  }

  /**
   * Get constraint priority (higher = more important)
   */
  getPriority(): number {
    return this.priority;
  }

  /**
   * Check if constraint is enabled
   */
  isConstraintEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Enable or disable this constraint
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Create a constraint violation
   */
  protected createViolation(
    message: string,
    affectedEntries: ScheduleEntry[],
    severity: 'error' | 'warning' = 'error'
  ): ConstraintViolation {
    return {
      type: this.type,
      message,
      affectedEntries,
      severity
    };
  }

  /**
   * Check if two time slots overlap
   */
  protected timeSlotsOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
    if (slot1.day !== slot2.day) {
      return false;
    }

    const start1 = this.timeToMinutes(slot1.startTime);
    const end1 = this.timeToMinutes(slot1.endTime);
    const start2 = this.timeToMinutes(slot2.startTime);
    const end2 = this.timeToMinutes(slot2.endTime);

    return start1 < end2 && start2 < end1;
  }

  /**
   * Convert time string to minutes since midnight
   */
  protected timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Check if schedule entry matches criteria
   */
  protected entryMatches(entry: ScheduleEntry, criteria: Partial<ScheduleEntry>): boolean {
    return Object.keys(criteria).every(key => {
      const criteriaValue = criteria[key as keyof ScheduleEntry];
      const entryValue = entry[key as keyof ScheduleEntry];
      
      if (key === 'timeSlot' && criteriaValue && entryValue) {
        const criteriaSlot = criteriaValue as TimeSlot;
        const entrySlot = entryValue as TimeSlot;
        return this.timeSlotsOverlap(criteriaSlot, entrySlot);
      }
      
      return entryValue === criteriaValue;
    });
  }

  /**
   * Find conflicting entries based on criteria
   */
  protected findConflictingEntries(
    entry: ScheduleEntry,
    existing: ScheduleEntry[],
    criteria: (existing: ScheduleEntry) => boolean
  ): ScheduleEntry[] {
    return existing.filter(existingEntry => 
      existingEntry !== entry && criteria(existingEntry)
    );
  }

  /**
   * Get constraint configuration
   */
  getConfiguration(): {
    type: string;
    description: string;
    priority: number;
    enabled: boolean;
  } {
    return {
      type: this.type,
      description: this.description,
      priority: this.priority,
      enabled: this.isEnabled
    };
  }

  /**
   * Clone this constraint
   */
  abstract clone(): BaseConstraint;

  /**
   * Compare constraints for sorting (by priority, then by type)
   */
  compareTo(other: BaseConstraint): number {
    if (this.priority !== other.priority) {
      return other.priority - this.priority; // Higher priority first
    }
    return this.type.localeCompare(other.type);
  }

  /**
   * Check if constraint equals another constraint
   */
  equals(other: BaseConstraint): boolean {
    return this.type === other.type && 
           this.description === other.description &&
           this.priority === other.priority;
  }

  /**
   * Get string representation
   */
  toString(): string {
    const status = this.isEnabled ? 'enabled' : 'disabled';
    return `${this.type} (priority: ${this.priority}, ${status}): ${this.description}`;
  }
}
