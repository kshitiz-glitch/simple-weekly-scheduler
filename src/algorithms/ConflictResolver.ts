import { ConflictResolver as IConflictResolver } from './index';
import { ScheduleEntry, TimeSlot, DayOfWeek, ConstraintViolation } from '../models';
import { BaseConstraint } from '../services/constraints';

export interface ConflictResolutionResult {
  resolvedSchedule: ScheduleEntry[];
  unresolvedConflicts: ScheduleEntry[][];
  resolutionStrategies: ResolutionStrategy[];
  statistics: {
    totalConflicts: number;
    resolvedConflicts: number;
    strategiesApplied: number;
    executionTimeMs: number;
  };
}

export interface ResolutionStrategy {
  name: string;
  description: string;
  priority: number;
  applicableConflictTypes: string[];
  apply(conflicts: ScheduleEntry[][], availableSlots: TimeSlot[], constraints: BaseConstraint[]): ScheduleEntry[][];
}

export interface ConflictAnalysis {
  conflictType: string;
  severity: 'low' | 'medium' | 'high';
  affectedEntries: ScheduleEntry[];
  suggestedActions: string[];
  alternativeSlots: TimeSlot[];
}

export class ConflictResolver implements IConflictResolver {
  private resolutionStrategies: ResolutionStrategy[] = [];

  constructor() {
    this.initializeDefaultStrategies();
  }

  /**
   * Detect conflicts in a schedule
   */
  detectConflicts(schedule: ScheduleEntry[]): ScheduleEntry[][] {
    const conflicts: ScheduleEntry[][] = [];
    const processedPairs = new Set<string>();

    for (let i = 0; i < schedule.length; i++) {
      for (let j = i + 1; j < schedule.length; j++) {
        const entry1 = schedule[i];
        const entry2 = schedule[j];
        const pairKey = `${Math.min(i, j)}_${Math.max(i, j)}`;

        if (processedPairs.has(pairKey)) {
          continue;
        }
        processedPairs.add(pairKey);

        if (this.entriesConflict(entry1, entry2)) {
          // Find all entries that conflict with this pair
          const conflictGroup = [entry1, entry2];
          
          // Check if other entries also conflict with this group
          for (let k = 0; k < schedule.length; k++) {
            if (k === i || k === j) continue;
            
            const entry3 = schedule[k];
            if (conflictGroup.some(conflictEntry => this.entriesConflict(entry3, conflictEntry))) {
              conflictGroup.push(entry3);
            }
          }

          conflicts.push(conflictGroup);
        }
      }
    }

    return conflicts;
  }

  /**
   * Resolve conflicts using available strategies
   */
  resolveConflicts(conflicts: ScheduleEntry[][]): ScheduleEntry[] {
    const startTime = Date.now();
    let resolvedEntries: ScheduleEntry[] = [];
    let unresolvedConflicts: ScheduleEntry[][] = [];
    let strategiesApplied = 0;

    // Sort strategies by priority
    const sortedStrategies = [...this.resolutionStrategies].sort((a, b) => b.priority - a.priority);

    for (const conflict of conflicts) {
      let resolved = false;

      for (const strategy of sortedStrategies) {
        try {
          const result = strategy.apply([conflict], [], []); // Simplified for now
          
          if (result.length === 0) {
            // Strategy successfully resolved the conflict
            resolvedEntries.push(...conflict);
            resolved = true;
            strategiesApplied++;
            break;
          }
        } catch (error) {
          // Strategy failed, try next one
          continue;
        }
      }

      if (!resolved) {
        unresolvedConflicts.push(conflict);
      }
    }

    return resolvedEntries;
  }

  /**
   * Suggest alternative time slots for conflicted entries
   */
  suggestAlternatives(conflictedEntry: ScheduleEntry, availableSlots: TimeSlot[]): TimeSlot[] {
    const alternatives: TimeSlot[] = [];

    for (const slot of availableSlots) {
      // Check if the slot is suitable for the conflicted entry
      if (this.isSlotSuitable(conflictedEntry, slot)) {
        alternatives.push(slot);
      }
    }

    // Sort alternatives by preference (morning slots first, then by day)
    return alternatives.sort((a, b) => {
      // Prefer earlier days
      const dayOrder = Object.values(DayOfWeek);
      const dayA = dayOrder.indexOf(a.day);
      const dayB = dayOrder.indexOf(b.day);
      
      if (dayA !== dayB) {
        return dayA - dayB;
      }

      // Prefer earlier times
      return a.startTime.localeCompare(b.startTime);
    });
  }

  /**
   * Analyze conflicts and provide detailed information
   */
  analyzeConflicts(conflicts: ScheduleEntry[][], constraints: BaseConstraint[]): ConflictAnalysis[] {
    const analyses: ConflictAnalysis[] = [];

    for (const conflict of conflicts) {
      const analysis = this.analyzeConflictGroup(conflict, constraints);
      analyses.push(analysis);
    }

    return analyses;
  }

  /**
   * Resolve conflicts with comprehensive result
   */
  resolveConflictsComprehensive(
    conflicts: ScheduleEntry[][],
    availableSlots: TimeSlot[],
    constraints: BaseConstraint[]
  ): ConflictResolutionResult {
    const startTime = Date.now();
    let resolvedSchedule: ScheduleEntry[] = [];
    let unresolvedConflicts: ScheduleEntry[][] = [];
    let strategiesApplied = 0;

    // Sort strategies by priority
    const sortedStrategies = [...this.resolutionStrategies].sort((a, b) => b.priority - a.priority);

    for (const conflict of conflicts) {
      let resolved = false;

      for (const strategy of sortedStrategies) {
        try {
          const remainingConflicts = strategy.apply([conflict], availableSlots, constraints);
          
          if (remainingConflicts.length === 0) {
            // Strategy successfully resolved the conflict
            // For now, just add the first entry (more sophisticated resolution needed)
            resolvedSchedule.push(conflict[0]);
            resolved = true;
            strategiesApplied++;
            break;
          }
        } catch (error) {
          // Strategy failed, try next one
          continue;
        }
      }

      if (!resolved) {
        unresolvedConflicts.push(conflict);
      }
    }

    const executionTime = Date.now() - startTime;

    return {
      resolvedSchedule,
      unresolvedConflicts,
      resolutionStrategies: sortedStrategies,
      statistics: {
        totalConflicts: conflicts.length,
        resolvedConflicts: conflicts.length - unresolvedConflicts.length,
        strategiesApplied,
        executionTimeMs: executionTime
      }
    };
  }

  /**
   * Add a custom resolution strategy
   */
  addResolutionStrategy(strategy: ResolutionStrategy): void {
    this.resolutionStrategies.push(strategy);
  }

  /**
   * Remove a resolution strategy
   */
  removeResolutionStrategy(strategyName: string): boolean {
    const index = this.resolutionStrategies.findIndex(s => s.name === strategyName);
    if (index !== -1) {
      this.resolutionStrategies.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all available resolution strategies
   */
  getResolutionStrategies(): ResolutionStrategy[] {
    return [...this.resolutionStrategies];
  }

  /**
   * Check if two schedule entries conflict
   */
  private entriesConflict(entry1: ScheduleEntry, entry2: ScheduleEntry): boolean {
    // Faculty conflict: same faculty at overlapping times
    if (entry1.facultyId === entry2.facultyId && this.timeSlotsOverlap(entry1.timeSlot, entry2.timeSlot)) {
      return true;
    }

    // Room conflict: same batch at overlapping times (assuming one room per batch)
    if (entry1.batchId === entry2.batchId && this.timeSlotsOverlap(entry1.timeSlot, entry2.timeSlot)) {
      return true;
    }

    return false;
  }

  /**
   * Check if two time slots overlap
   */
  private timeSlotsOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
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
  private timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Check if a time slot is suitable for a schedule entry
   */
  private isSlotSuitable(entry: ScheduleEntry, slot: TimeSlot): boolean {
    // Check if slot duration is sufficient
    const slotDuration = this.timeToMinutes(slot.endTime) - this.timeToMinutes(slot.startTime);
    const requiredDuration = 60; // Default assumption, should be passed as parameter
    
    if (slotDuration < requiredDuration) {
      return false;
    }

    // Check if slot is available
    if (!slot.isAvailable) {
      return false;
    }

    return true;
  }

  /**
   * Analyze a conflict group
   */
  private analyzeConflictGroup(conflict: ScheduleEntry[], constraints: BaseConstraint[]): ConflictAnalysis {
    let conflictType = 'unknown';
    let severity: 'low' | 'medium' | 'high' = 'medium';
    const suggestedActions: string[] = [];

    // Determine conflict type
    if (conflict.length === 2) {
      const [entry1, entry2] = conflict;
      
      if (entry1.facultyId === entry2.facultyId) {
        conflictType = 'faculty-conflict';
        suggestedActions.push('Reschedule one lecture to a different time slot');
        suggestedActions.push('Assign a different faculty member to one of the subjects');
      }
      
      if (entry1.batchId === entry2.batchId) {
        conflictType = 'batch-conflict';
        severity = 'high'; // Students can't be in two places at once
        suggestedActions.push('Reschedule one lecture to avoid overlap');
      }
    } else {
      conflictType = 'multi-way-conflict';
      severity = 'high';
      suggestedActions.push('Reschedule multiple lectures to resolve complex conflict');
    }

    return {
      conflictType,
      severity,
      affectedEntries: conflict,
      suggestedActions,
      alternativeSlots: [] // Would be populated with actual alternatives
    };
  }

  /**
   * Initialize default resolution strategies
   */
  private initializeDefaultStrategies(): void {
    // Strategy 1: Time Shift - Move conflicted entry to next available slot
    this.addResolutionStrategy({
      name: 'time-shift',
      description: 'Move conflicted lecture to the next available time slot',
      priority: 80,
      applicableConflictTypes: ['faculty-conflict', 'batch-conflict'],
      apply: (conflicts: ScheduleEntry[][], availableSlots: TimeSlot[], constraints: BaseConstraint[]) => {
        // Simple implementation: if we can find alternative slots, consider conflict resolved
        const hasAlternatives = conflicts.every(conflict => 
          conflict.some(entry => availableSlots.length > 0)
        );
        return hasAlternatives ? [] : conflicts;
      }
    });

    // Strategy 2: Faculty Reassignment - Assign different faculty to one of the subjects
    this.addResolutionStrategy({
      name: 'faculty-reassignment',
      description: 'Assign a different faculty member to resolve faculty conflicts',
      priority: 60,
      applicableConflictTypes: ['faculty-conflict'],
      apply: (conflicts: ScheduleEntry[][], availableSlots: TimeSlot[], constraints: BaseConstraint[]) => {
        // Simplified: assume faculty reassignment is always possible
        const facultyConflicts = conflicts.filter(conflict => 
          conflict.length === 2 && conflict[0].facultyId === conflict[1].facultyId
        );
        return conflicts.filter(conflict => !facultyConflicts.includes(conflict));
      }
    });

    // Strategy 3: Lecture Splitting - Split long lectures into shorter sessions
    this.addResolutionStrategy({
      name: 'lecture-splitting',
      description: 'Split conflicted lectures into shorter sessions',
      priority: 40,
      applicableConflictTypes: ['faculty-conflict', 'batch-conflict'],
      apply: (conflicts: ScheduleEntry[][], availableSlots: TimeSlot[], constraints: BaseConstraint[]) => {
        // Simplified: assume splitting is possible if enough slots available
        const canSplit = availableSlots.length >= conflicts.length * 2;
        return canSplit ? [] : conflicts;
      }
    });

    // Strategy 4: Priority-Based Resolution - Keep higher priority lectures
    this.addResolutionStrategy({
      name: 'priority-resolution',
      description: 'Resolve conflicts by keeping higher priority lectures',
      priority: 20,
      applicableConflictTypes: ['faculty-conflict', 'batch-conflict', 'multi-way-conflict'],
      apply: (conflicts: ScheduleEntry[][], availableSlots: TimeSlot[], constraints: BaseConstraint[]) => {
        // Simplified: assume we can always resolve by priority
        return [];
      }
    });
  }

  /**
   * Get conflict resolution statistics
   */
  getStatistics(): {
    totalStrategies: number;
    strategiesByPriority: { name: string; priority: number }[];
    applicableConflictTypes: string[];
  } {
    const strategiesByPriority = this.resolutionStrategies
      .map(s => ({ name: s.name, priority: s.priority }))
      .sort((a, b) => b.priority - a.priority);

    const allConflictTypes = new Set<string>();
    this.resolutionStrategies.forEach(strategy => {
      strategy.applicableConflictTypes.forEach(type => allConflictTypes.add(type));
    });

    return {
      totalStrategies: this.resolutionStrategies.length,
      strategiesByPriority,
      applicableConflictTypes: Array.from(allConflictTypes)
    };
  }

  /**
   * Test a resolution strategy against sample conflicts
   */
  testStrategy(strategyName: string, sampleConflicts: ScheduleEntry[][]): {
    strategyName: string;
    successRate: number;
    averageResolutionTime: number;
    applicableConflicts: number;
  } {
    const strategy = this.resolutionStrategies.find(s => s.name === strategyName);
    if (!strategy) {
      throw new Error(`Strategy '${strategyName}' not found`);
    }

    let successfulResolutions = 0;
    let totalTime = 0;
    let applicableConflicts = 0;

    for (const conflict of sampleConflicts) {
      const startTime = Date.now();
      
      try {
        const result = strategy.apply([conflict], [], []);
        const endTime = Date.now();
        
        totalTime += endTime - startTime;
        applicableConflicts++;
        
        if (result.length === 0) {
          successfulResolutions++;
        }
      } catch (error) {
        // Strategy not applicable or failed
        continue;
      }
    }

    return {
      strategyName,
      successRate: applicableConflicts > 0 ? successfulResolutions / applicableConflicts : 0,
      averageResolutionTime: applicableConflicts > 0 ? totalTime / applicableConflicts : 0,
      applicableConflicts
    };
  }
}
