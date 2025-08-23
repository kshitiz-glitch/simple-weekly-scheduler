// Service interfaces for business logic components

import { Batch, Subject, ValidationResult, ConstraintViolation, ScheduleEntry, WeeklySchedule, TimeSlot } from '../models';

export { InputManager } from './InputManager';
export { ValidationService, ValidationRule, ValidationContext } from './ValidationService';
export { ConstraintEngine } from './ConstraintEngine';
export { ConflictResolver } from './ConflictResolver';
export { ConflictReporter } from './ConflictReporter';
export { ManualAdjustmentService } from './ManualAdjustmentService';
export { BaseConstraint, FacultyConflictConstraint, TimeSlotAvailabilityConstraint } from './constraints';
export { ImpossibleScenarioDetector } from './ImpossibleScenarioDetector';
export { ConstraintRelaxationService } from './ConstraintRelaxationService';
export { PartialScheduleGenerator } from './PartialScheduleGenerator';

export interface InputManager {
  collectBatchInfo(): Promise<Batch[]>;
  collectSubjectInfo(batch: Batch): Promise<Subject[]>;
  collectHolidays(): Promise<Date[]>;
  validateInput(data: any): ValidationResult;
}

export interface ConstraintEngine {
  addConstraint(constraint: Constraint): void;
  validateSchedule(schedule: ScheduleEntry[]): ConstraintViolation[];
  checkFacultyConflict(entry: ScheduleEntry, existing: ScheduleEntry[]): boolean;
  checkTimeSlotAvailability(slot: TimeSlot, holidays: Date[]): boolean;
}

export interface ScheduleGenerator {
  generateTimetable(
    batches: Batch[], 
    constraints: Constraint[], 
    holidays: Date[]
  ): Promise<WeeklySchedule>;
  optimizeDistribution(schedule: ScheduleEntry[]): ScheduleEntry[];
}

export interface Constraint {
  type: string;
  validate(entry: ScheduleEntry, existing: ScheduleEntry[]): ConstraintViolation | null;
  getDescription(): string;
}

export interface OutputFormatter {
  formatWeeklyView(schedule: WeeklySchedule): string;
  formatBatchView(schedule: WeeklySchedule, batchId: string): string;
  formatFacultyView(schedule: WeeklySchedule, facultyId: string): string;
  exportToCsv(schedule: WeeklySchedule): string;
  exportToJson(schedule: WeeklySchedule): string;
}
