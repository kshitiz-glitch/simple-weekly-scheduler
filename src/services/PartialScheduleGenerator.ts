import { Batch, Subject, WeeklySchedule, ScheduleEntry, DayOfWeek } from '../models';
import { BaseConstraint } from './constraints';
import { ImpossibleScenarioDetector, ScenarioAnalysis } from './ImpossibleScenarioDetector';
import { ConstraintRelaxationService } from './ConstraintRelaxationService';
import { ScheduleGenerator } from '../algorithms/ScheduleGenerator';

export interface PartialScheduleOptions {
  prioritizationStrategy: 'core-subjects' | 'high-frequency' | 'faculty-availability' | 'batch-importance';
  maxAttempts: number;
  allowConstraintRelaxation: boolean;
  targetCoverage: number; // 0-100 percentage
  preserveBalance: boolean;
  generateAlternatives: boolean;
}

export interface PartialScheduleResult {
  schedule: WeeklySchedule;
  coverage: {
    totalLectures: number;
    scheduledLectures: number;
    coveragePercentage: number;
    batchCoverage: Map<string, number>;
    subjectCoverage: Map<string, number>;
  };
  unscheduledLectures: UnscheduledLecture[];
  recommendations: SchedulingRecommendation[];
  alternatives?: WeeklySchedule[];
  metadata: {
    strategy: string;
    relaxationsApplied: string[];
    generationTime: number;
    attempts: number;
  };
}

export interface UnscheduledLecture {
  batchId: string;
  subjectId: string;
  facultyId: string;
  lecturesRemaining: number;
  reason: string;
  suggestedTimeSlots?: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface SchedulingRecommendation {
  type: 'manual-scheduling' | 'constraint-modification' | 'resource-addition' | 'requirement-change';
  description: string;
  priority: number;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  specificActions: string[];
}

export interface SubjectPriority {
  batchId: string;
  subjectId: string;
  priority: number;
  reason: string;
}

/**
 * Service for generating partial schedules when complete scheduling is impossible
 */
export class PartialScheduleGenerator {
  private scenarioDetector: ImpossibleScenarioDetector;
  private relaxationService: ConstraintRelaxationService;
  private scheduleGenerator: ScheduleGenerator;

  constructor() {
    this.scenarioDetector = new ImpossibleScenarioDetector();
    this.relaxationService = new ConstraintRelaxationService();
    this.scheduleGenerator = new ScheduleGenerator();
  }

  /**
   * Generate a partial schedule when full scheduling is impossible
   */
  async generatePartialSchedule(
    batches: Batch[],
    constraints: BaseConstraint[],
    parameters: any,
    options: PartialScheduleOptions
  ): Promise<PartialScheduleResult> {
    const startTime = Date.now();
    let attempts = 0;
    let bestSchedule: WeeklySchedule | null = null;
    let bestCoverage = 0;
    const alternatives: WeeklySchedule[] = [];

    // Analyze the scenario first
    const analysis = await this.scenarioDetector.analyzeScenario(batches, constraints, parameters);

    // Create prioritized subject list
    const prioritizedSubjects = this.prioritizeSubjects(batches, options.prioritizationStrategy, analysis);

    // Apply constraint relaxation if allowed
    let workingConstraints = constraints;
    let workingBatches = batches;
    let workingParameters = parameters;
    let relaxationsApplied: string[] = [];

    if (options.allowConstraintRelaxation) {
      const relaxationPlan = await this.relaxationService.createRelaxationPlan(
        analysis, constraints, batches, parameters
      );

      const relaxationResult = await this.relaxationService.applyRelaxationPlan(
        relaxationPlan, constraints, batches, parameters
      );

      if (relaxationResult.success) {
        workingConstraints = relaxationResult.modifiedConstraints;
        workingBatches = relaxationResult.modifiedBatches || batches;
        workingParameters = relaxationResult.modifiedParameters || parameters;
        relaxationsApplied = relaxationResult.relaxationApplied;
      }
    }

    // Try different approaches to maximize coverage
    const strategies = [
      'greedy-priority',
      'batch-by-batch',
      'time-slot-filling',
      'constraint-guided'
    ];

    for (const strategy of strategies) {
      if (attempts >= options.maxAttempts) break;

      try {
        const result = await this.attemptPartialGeneration(
          workingBatches,
          workingConstraints,
          workingParameters,
          prioritizedSubjects,
          strategy,
          options
        );

        attempts++;

        if (result) {
          const coverage = this.calculateCoverage(result, batches);
          
          if (coverage.coveragePercentage > bestCoverage) {
            bestSchedule = result;
            bestCoverage = coverage.coveragePercentage;
          }

          if (options.generateAlternatives && coverage.coveragePercentage >= 50) {
            alternatives.push(result);
          }

          // Stop if we've reached target coverage
          if (coverage.coveragePercentage >= options.targetCoverage) {
            break;
          }
        }
      } catch (error) {
        console.warn(`Partial generation strategy '${strategy}' failed:`, error.message);
        continue;
      }
    }

    // If no schedule was generated, create minimal schedule
    if (!bestSchedule) {
      bestSchedule = await this.generateMinimalSchedule(workingBatches, workingConstraints, workingParameters);
    }

    // Calculate final results
    const coverage = this.calculateCoverage(bestSchedule, batches);
    const unscheduledLectures = this.identifyUnscheduledLectures(bestSchedule, batches, prioritizedSubjects);
    const recommendations = this.generateRecommendations(unscheduledLectures, analysis, coverage);

    return {
      schedule: bestSchedule,
      coverage,
      unscheduledLectures,
      recommendations,
      alternatives: options.generateAlternatives ? alternatives : undefined,
      metadata: {
        strategy: 'partial-generation',
        relaxationsApplied,
        generationTime: Date.now() - startTime,
        attempts
      }
    };
  }

  /**
   * Prioritize subjects based on the selected strategy
   */
  private prioritizeSubjects(
    batches: Batch[],
    strategy: string,
    analysis: ScenarioAnalysis
  ): SubjectPriority[] {
    const priorities: SubjectPriority[] = [];

    batches.forEach(batch => {
      batch.subjects.forEach(subject => {
        let priority = 0;
        let reason = '';

        switch (strategy) {
          case 'core-subjects':
            // Prioritize subjects with higher lecture frequency (assumed to be core)
            priority = subject.lecturesPerWeek * 10;
            reason = 'High lecture frequency indicates core subject';
            break;

          case 'high-frequency':
            // Simply prioritize by lecture count
            priority = subject.lecturesPerWeek * 15;
            reason = 'High frequency subjects scheduled first';
            break;

          case 'faculty-availability':
            // Prioritize subjects with less loaded faculty
            const facultyLoad = this.estimateFacultyLoad(subject.facultyId, batches);
            priority = Math.max(0, 100 - facultyLoad);
            reason = 'Faculty with lower load prioritized';
            break;

          case 'batch-importance':
            // Prioritize based on batch size (smaller batches first)
            const batchComplexity = batch.getTotalLecturesPerWeek();
            priority = Math.max(0, 200 - batchComplexity);
            reason = 'Smaller batches scheduled first';
            break;

          default:
            priority = subject.lecturesPerWeek * 10;
            reason = 'Default prioritization';
        }

        // Boost priority for subjects mentioned in critical issues
        const criticalIssues = analysis.issues.filter(i => i.severity === 'critical');
        const isAffected = criticalIssues.some(issue => 
          issue.affectedSubjects?.includes(`${batch.id}:${subject.id}`)
        );
        
        if (!isAffected) {
          priority += 20; // Boost non-problematic subjects
          reason += ' (not affected by critical issues)';
        }

        priorities.push({
          batchId: batch.id,
          subjectId: subject.id,
          priority,
          reason
        });
      });
    });

    return priorities.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Attempt partial schedule generation with a specific strategy
   */
  private async attemptPartialGeneration(
    batches: Batch[],
    constraints: BaseConstraint[],
    parameters: any,
    prioritizedSubjects: SubjectPriority[],
    strategy: string,
    options: PartialScheduleOptions
  ): Promise<WeeklySchedule | null> {
    switch (strategy) {
      case 'greedy-priority':
        return await this.greedyPriorityGeneration(batches, constraints, parameters, prioritizedSubjects, options);
      
      case 'batch-by-batch':
        return await this.batchByBatchGeneration(batches, constraints, parameters, prioritizedSubjects, options);
      
      case 'time-slot-filling':
        return await this.timeSlotFillingGeneration(batches, constraints, parameters, prioritizedSubjects, options);
      
      case 'constraint-guided':
        return await this.constraintGuidedGeneration(batches, constraints, parameters, prioritizedSubjects, options);
      
      default:
        return null;
    }
  }

  /**
   * Greedy priority-based generation
   */
  private async greedyPriorityGeneration(
    batches: Batch[],
    constraints: BaseConstraint[],
    parameters: any,
    prioritizedSubjects: SubjectPriority[],
    options: PartialScheduleOptions
  ): Promise<WeeklySchedule | null> {
    // Create reduced batches with only high-priority subjects
    const targetLectures = Math.floor(this.calculateTotalLectures(batches) * (options.targetCoverage / 100));
    let scheduledLectures = 0;
    
    const reducedBatches = batches.map(batch => {
      const newBatch = new Batch(batch.id, batch.name);
      
      batch.subjects.forEach(subject => {
        const priority = prioritizedSubjects.find(p => 
          p.batchId === batch.id && p.subjectId === subject.id
        );
        
        if (priority && scheduledLectures < targetLectures) {
          // Reduce lecture count if necessary to fit within target
          const remainingCapacity = targetLectures - scheduledLectures;
          const lectureCount = Math.min(subject.lecturesPerWeek, remainingCapacity);
          
          if (lectureCount > 0) {
            const reducedSubject = new Subject(
              subject.id,
              subject.name,
              lectureCount,
              subject.lectureDuration,
              subject.facultyId
            );
            
            newBatch.addSubject(reducedSubject);
            scheduledLectures += lectureCount;
          }
        }
      });
      
      return newBatch;
    }).filter(batch => batch.subjects.length > 0);

    // Generate schedule with reduced batches
    try {
      return await this.scheduleGenerator.generateTimetable(reducedBatches, constraints, []);
    } catch (error) {
      return null;
    }
  }

  /**
   * Batch-by-batch generation
   */
  private async batchByBatchGeneration(
    batches: Batch[],
    constraints: BaseConstraint[],
    parameters: any,
    prioritizedSubjects: SubjectPriority[],
    options: PartialScheduleOptions
  ): Promise<WeeklySchedule | null> {
    // Sort batches by total priority of their subjects
    const batchPriorities = batches.map(batch => {
      const totalPriority = batch.subjects.reduce((sum, subject) => {
        const priority = prioritizedSubjects.find(p => 
          p.batchId === batch.id && p.subjectId === subject.id
        );
        return sum + (priority?.priority || 0);
      }, 0);
      
      return { batch, totalPriority };
    }).sort((a, b) => b.totalPriority - a.totalPriority);

    // Try to schedule batches one by one until we can't fit more
    const scheduledBatches: Batch[] = [];
    
    for (const { batch } of batchPriorities) {
      const testBatches = [...scheduledBatches, batch];
      
      try {
        const testSchedule = await this.scheduleGenerator.generateTimetable(testBatches, constraints, []);
        const coverage = this.calculateCoverage(testSchedule, testBatches);
        
        if (coverage.coveragePercentage >= 70) { // Accept if we can schedule 70% of the batch
          scheduledBatches.push(batch);
        }
      } catch (error) {
        // Can't fit this batch, continue with what we have
        break;
      }
    }

    if (scheduledBatches.length > 0) {
      return await this.scheduleGenerator.generateTimetable(scheduledBatches, constraints, []);
    }
    
    return null;
  }

  /**
   * Time slot filling generation
   */
  private async timeSlotFillingGeneration(
    batches: Batch[],
    constraints: BaseConstraint[],
    parameters: any,
    prioritizedSubjects: SubjectPriority[],
    options: PartialScheduleOptions
  ): Promise<WeeklySchedule | null> {
    // Create a schedule by filling time slots with highest priority subjects
    const availableSlots = this.generateAvailableTimeSlots(parameters);
    const entries: ScheduleEntry[] = [];
    const usedSlots = new Set<string>();

    // Sort subjects by priority
    const sortedSubjects: Array<{ batch: Batch; subject: Subject; priority: number }> = [];
    
    batches.forEach(batch => {
      batch.subjects.forEach(subject => {
        const priority = prioritizedSubjects.find(p => 
          p.batchId === batch.id && p.subjectId === subject.id
        );
        
        if (priority) {
          sortedSubjects.push({ batch, subject, priority: priority.priority });
        }
      });
    });

    sortedSubjects.sort((a, b) => b.priority - a.priority);

    // Fill slots with subjects
    for (const { batch, subject } of sortedSubjects) {
      const lecturesNeeded = subject.lecturesPerWeek;
      let lecturesScheduled = 0;

      for (const slot of availableSlots) {
        if (lecturesScheduled >= lecturesNeeded) break;
        
        const slotKey = `${slot.day}-${slot.startTime}`;
        if (usedSlots.has(slotKey)) continue;

        // Check constraints
        const entry: ScheduleEntry = {
          batchId: batch.id,
          subjectId: subject.id,
          facultyId: subject.facultyId,
          timeSlot: slot
        };

        if (this.checkConstraints(entry, entries, constraints)) {
          entries.push(entry);
          usedSlots.add(slotKey);
          lecturesScheduled++;
        }
      }
    }

    return new WeeklySchedule(entries, [], {
      generatedAt: new Date(),
      totalLectures: entries.length,
      batchCount: new Set(entries.map(e => e.batchId)).size
    });
  }

  /**
   * Constraint-guided generation
   */
  private async constraintGuidedGeneration(
    batches: Batch[],
    constraints: BaseConstraint[],
    parameters: any,
    prioritizedSubjects: SubjectPriority[],
    options: PartialScheduleOptions
  ): Promise<WeeklySchedule | null> {
    // Use constraint satisfaction to guide partial generation
    // This is a simplified version - a full implementation would use CSP techniques
    
    const maxIterations = 100;
    let bestSchedule: WeeklySchedule | null = null;
    let bestCoverage = 0;

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Create a random subset of subjects based on priority
      const subsetBatches = this.createRandomSubset(batches, prioritizedSubjects, 0.7 + (iteration * 0.003));
      
      try {
        const schedule = await this.scheduleGenerator.generateTimetable(subsetBatches, constraints, []);
        const coverage = this.calculateCoverage(schedule, batches);
        
        if (coverage.coveragePercentage > bestCoverage) {
          bestSchedule = schedule;
          bestCoverage = coverage.coveragePercentage;
        }
        
        if (bestCoverage >= options.targetCoverage) {
          break;
        }
      } catch (error) {
        continue;
      }
    }

    return bestSchedule;
  }

  /**
   * Generate minimal schedule as fallback
   */
  private async generateMinimalSchedule(
    batches: Batch[],
    constraints: BaseConstraint[],
    parameters: any
  ): Promise<WeeklySchedule> {
    // Create minimal batches with only 1 lecture per subject
    const minimalBatches = batches.slice(0, 3).map(batch => { // Take only first 3 batches
      const minimalBatch = new Batch(batch.id, batch.name);
      
      batch.subjects.slice(0, 3).forEach(subject => { // Take only first 3 subjects
        const minimalSubject = new Subject(
          subject.id,
          subject.name,
          1, // Only 1 lecture
          60, // Standard duration
          subject.facultyId
        );
        
        minimalBatch.addSubject(minimalSubject);
      });
      
      return minimalBatch;
    });

    try {
      return await this.scheduleGenerator.generateTimetable(minimalBatches, [], []); // No constraints
    } catch (error) {
      // Return empty schedule if even minimal generation fails
      return new WeeklySchedule([], [], {
        generatedAt: new Date(),
        totalLectures: 0,
        batchCount: 0,
        error: 'Minimal schedule generation failed'
      });
    }
  }

  /**
   * Calculate coverage statistics
   */
  private calculateCoverage(schedule: WeeklySchedule, originalBatches: Batch[]): {
    totalLectures: number;
    scheduledLectures: number;
    coveragePercentage: number;
    batchCoverage: Map<string, number>;
    subjectCoverage: Map<string, number>;
  } {
    const totalLectures = this.calculateTotalLectures(originalBatches);
    const scheduledLectures = schedule.entries.length;
    const coveragePercentage = totalLectures > 0 ? (scheduledLectures / totalLectures) * 100 : 0;

    const batchCoverage = new Map<string, number>();
    const subjectCoverage = new Map<string, number>();

    // Calculate batch coverage
    originalBatches.forEach(batch => {
      const batchTotalLectures = batch.getTotalLecturesPerWeek();
      const batchScheduledLectures = schedule.entries.filter(e => e.batchId === batch.id).length;
      const batchCoveragePercent = batchTotalLectures > 0 ? (batchScheduledLectures / batchTotalLectures) * 100 : 0;
      batchCoverage.set(batch.id, batchCoveragePercent);

      // Calculate subject coverage
      batch.subjects.forEach(subject => {
        const subjectTotalLectures = subject.lecturesPerWeek;
        const subjectScheduledLectures = schedule.entries.filter(e => 
          e.batchId === batch.id && e.subjectId === subject.id).length;
        const subjectCoveragePercent = subjectTotalLectures > 0 ? (subjectScheduledLectures / subjectTotalLectures) * 100 : 0;
        subjectCoverage.set(`${batch.id}:${subject.id}`, subjectCoveragePercent);
      });
    });

    return {
      totalLectures,
      scheduledLectures,
      coveragePercentage,
      batchCoverage,
      subjectCoverage
    };
  }

  /**
   * Identify unscheduled lectures
   */
  private identifyUnscheduledLectures(
    schedule: WeeklySchedule,
    originalBatches: Batch[],
    prioritizedSubjects: SubjectPriority[]
  ): UnscheduledLecture[] {
    const unscheduled: UnscheduledLecture[] = [];

    originalBatches.forEach(batch => {
      batch.subjects.forEach(subject => {
        const requiredLectures = subject.lecturesPerWeek;
        const scheduledLectures = schedule.entries.filter(e => 
          e.batchId === batch.id && e.subjectId === subject.id).length;
        
        const remaining = requiredLectures - scheduledLectures;
        
        if (remaining > 0) {
          const priority = prioritizedSubjects.find(p => 
            p.batchId === batch.id && p.subjectId === subject.id
          );
          
          unscheduled.push({
            batchId: batch.id,
            subjectId: subject.id,
            facultyId: subject.facultyId,
            lecturesRemaining: remaining,
            reason: this.determineUnscheduledReason(batch, subject, schedule),
            priority: this.determinePriority(priority?.priority || 0)
          });
        }
      });
    });

    return unscheduled.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Generate recommendations for handling unscheduled lectures
   */
  private generateRecommendations(
    unscheduledLectures: UnscheduledLecture[],
    analysis: ScenarioAnalysis,
    coverage: any
  ): SchedulingRecommendation[] {
    const recommendations: SchedulingRecommendation[] = [];

    if (unscheduledLectures.length > 0) {
      // Manual scheduling recommendation
      recommendations.push({
        type: 'manual-scheduling',
        description: `Manually schedule ${unscheduledLectures.length} remaining lectures`,
        priority: 1,
        effort: 'medium',
        impact: 'high',
        specificActions: [
          'Review unscheduled lectures list',
          'Find available time slots manually',
          'Consider alternative scheduling arrangements',
          'Coordinate with faculty for flexible timing'
        ]
      });

      // High priority unscheduled lectures
      const highPriorityUnscheduled = unscheduledLectures.filter(u => u.priority === 'high');
      if (highPriorityUnscheduled.length > 0) {
        recommendations.push({
          type: 'constraint-modification',
          description: `Prioritize scheduling ${highPriorityUnscheduled.length} high-priority lectures`,
          priority: 2,
          effort: 'low',
          impact: 'high',
          specificActions: [
            'Extend working hours for high-priority subjects',
            'Use weekend slots if necessary',
            'Consider intensive scheduling formats'
          ]
        });
      }
    }

    // Coverage-based recommendations
    if (coverage.coveragePercentage < 70) {
      recommendations.push({
        type: 'requirement-change',
        description: 'Consider reducing lecture requirements to improve coverage',
        priority: 3,
        effort: 'high',
        impact: 'medium',
        specificActions: [
          'Review curriculum requirements',
          'Combine similar subjects',
          'Reduce lecture frequency for elective subjects',
          'Consider alternative delivery methods'
        ]
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  // Helper methods
  private calculateTotalLectures(batches: Batch[]): number {
    return batches.reduce((sum, batch) => sum + batch.getTotalLecturesPerWeek(), 0);
  }

  private estimateFacultyLoad(facultyId: string, batches: Batch[]): number {
    let totalLoad = 0;
    batches.forEach(batch => {
      batch.subjects.forEach(subject => {
        if (subject.facultyId === facultyId) {
          totalLoad += subject.lecturesPerWeek;
        }
      });
    });
    return totalLoad;
  }

  private generateAvailableTimeSlots(parameters: any): Array<{ day: DayOfWeek; startTime: string; endTime: string; isAvailable: boolean }> {
    const slots: Array<{ day: DayOfWeek; startTime: string; endTime: string; isAvailable: boolean }> = [];
    const workingDays = parameters.workingDays || [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY];
    const startHour = this.parseTime(parameters.workingHours?.start || '08:00');
    const endHour = this.parseTime(parameters.workingHours?.end || '18:00');
    const slotDuration = parameters.slotDuration || 60;

    workingDays.forEach(day => {
      for (let time = startHour; time < endHour; time += slotDuration) {
        slots.push({
          day,
          startTime: this.formatTime(time),
          endTime: this.formatTime(time + slotDuration),
          isAvailable: true
        });
      }
    });

    return slots;
  }

  private checkConstraints(entry: ScheduleEntry, existingEntries: ScheduleEntry[], constraints: BaseConstraint[]): boolean {
    // Simplified constraint checking
    // Check for faculty conflicts
    const facultyConflict = existingEntries.some(existing => 
      existing.facultyId === entry.facultyId &&
      existing.timeSlot.day === entry.timeSlot.day &&
      existing.timeSlot.startTime === entry.timeSlot.startTime
    );

    // Check for batch conflicts
    const batchConflict = existingEntries.some(existing => 
      existing.batchId === entry.batchId &&
      existing.timeSlot.day === entry.timeSlot.day &&
      existing.timeSlot.startTime === entry.timeSlot.startTime
    );

    return !facultyConflict && !batchConflict;
  }

  private createRandomSubset(batches: Batch[], prioritizedSubjects: SubjectPriority[], ratio: number): Batch[] {
    const subsetBatches: Batch[] = [];

    batches.forEach(batch => {
      const newBatch = new Batch(batch.id, batch.name);
      
      batch.subjects.forEach(subject => {
        const priority = prioritizedSubjects.find(p => 
          p.batchId === batch.id && p.subjectId === subject.id
        );
        
        // Include subject based on priority and random factor
        const inclusionProbability = priority ? (priority.priority / 100) * ratio : ratio * 0.5;
        
        if (Math.random() < inclusionProbability) {
          newBatch.addSubject(subject);
        }
      });
      
      if (newBatch.subjects.length > 0) {
        subsetBatches.push(newBatch);
      }
    });

    return subsetBatches;
  }

  private determineUnscheduledReason(batch: Batch, subject: Subject, schedule: WeeklySchedule): string {
    // Analyze why this subject couldn't be scheduled
    const facultyLoad = schedule.entries.filter(e => e.facultyId === subject.facultyId).length;
    const batchLoad = schedule.entries.filter(e => e.batchId === batch.id).length;

    if (facultyLoad > 20) {
      return 'Faculty overloaded';
    } else if (batchLoad > 25) {
      return 'Batch schedule full';
    } else {
      return 'No suitable time slots available';
    }
  }

  private determinePriority(priorityScore: number): 'high' | 'medium' | 'low' {
    if (priorityScore > 80) return 'high';
    if (priorityScore > 40) return 'medium';
    return 'low';
  }

  private parseTime(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
}
