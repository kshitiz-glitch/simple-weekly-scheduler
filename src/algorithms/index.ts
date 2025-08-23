// Algorithm interfaces and types for scheduling

import { ScheduleEntry, TimeSlot, Batch, Subject } from '../models';
import { Constraint } from '../services';

export { ScheduleGenerator, SchedulingOptions, SchedulingResult } from './ScheduleGenerator';
export { TimeSlotManager } from './TimeSlotManager';
export { ConstraintPropagator, PropagationResult, Domain } from './ConstraintPropagator';
export { ScheduleOptimizer, OptimizationMetrics, OptimizationOptions } from './ScheduleOptimizer';

export interface SchedulingAlgorithm {
  generateSchedule(
    batches: Batch[],
    availableSlots: TimeSlot[],
    constraints: Constraint[]
  ): ScheduleEntry[];
}

export interface OptimizationStrategy {
  optimize(schedule: ScheduleEntry[]): ScheduleEntry[];
  calculateScore(schedule: ScheduleEntry[]): number;
}

export interface ConflictResolver {
  detectConflicts(schedule: ScheduleEntry[]): ScheduleEntry[][];
  resolveConflicts(conflicts: ScheduleEntry[][]): ScheduleEntry[];
  suggestAlternatives(conflictedEntry: ScheduleEntry, availableSlots: TimeSlot[]): TimeSlot[];
}

export interface TimeSlotManager {
  initializeSlots(workingDays: string[], startTime: string, endTime: string, slotDuration: number): TimeSlot[];
  excludeHolidays(slots: TimeSlot[], holidays: Date[]): TimeSlot[];
  findAvailableSlots(slots: TimeSlot[], duration: number): TimeSlot[];
  isSlotAvailable(slot: TimeSlot, existing: ScheduleEntry[]): boolean;
}
