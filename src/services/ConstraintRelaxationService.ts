import { BaseConstraint } from './constraints';
import { Batch, Subject, DayOfWeek } from '../models';
import { ImpossibleScenarioDetector, ScenarioAnalysis, RecommendationType } from './ImpossibleScenarioDetector';

export interface RelaxationStrategy {
  name: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  applicability: (analysis: ScenarioAnalysis) => boolean;
  apply: (constraints: BaseConstraint[], batches: Batch[], parameters: any) => RelaxationResult;
}

export interface RelaxationResult {
  success: boolean;
  modifiedConstraints: BaseConstraint[];
  modifiedBatches?: Batch[];
  modifiedParameters?: any;
  relaxationApplied: string[];
  estimatedImprovement: number;
  tradeoffs: string[];
}

export interface RelaxationPlan {
  strategies: RelaxationStrategy[];
  expectedImprovement: number;
  totalTradeoffs: string[];
  recommendedOrder: number[];
}

/**
 * Service for systematically relaxing constraints when scheduling is impossible
 */
export class ConstraintRelaxationService {
  private strategies: RelaxationStrategy[] = [];
  private scenarioDetector: ImpossibleScenarioDetector;

  constructor() {
    this.scenarioDetector = new ImpossibleScenarioDetector();
    this.initializeStrategies();
  }

  /**
   * Create a relaxation plan based on scenario analysis
   */
  async createRelaxationPlan(
    analysis: ScenarioAnalysis,
    constraints: BaseConstraint[],
    batches: Batch[],
    parameters: any
  ): Promise<RelaxationPlan> {
    const applicableStrategies = this.strategies.filter(strategy => 
      strategy.applicability(analysis)
    );

    // Sort strategies by potential impact and ease of application
    const sortedStrategies = applicableStrategies.sort((a, b) => {
      const impactWeight = { low: 1, medium: 2, high: 3 };
      return impactWeight[b.impact] - impactWeight[a.impact];
    });

    const expectedImprovement = this.calculateExpectedImprovement(sortedStrategies, analysis);
    const totalTradeoffs = this.collectTradeoffs(sortedStrategies, constraints, batches, parameters);
    const recommendedOrder = this.determineOptimalOrder(sortedStrategies, analysis);

    return {
      strategies: sortedStrategies,
      expectedImprovement,
      totalTradeoffs,
      recommendedOrder
    };
  }

  /**
   * Apply relaxation strategies in sequence
   */
  async applyRelaxationPlan(
    plan: RelaxationPlan,
    constraints: BaseConstraint[],
    batches: Batch[],
    parameters: any
  ): Promise<RelaxationResult> {
    let currentConstraints = [...constraints];
    let currentBatches = batches.map(batch => this.cloneBatch(batch));
    let currentParameters = { ...parameters };
    let totalRelaxationApplied: string[] = [];
    let totalTradeoffs: string[] = [];
    let totalImprovement = 0;

    // Apply strategies in recommended order
    for (const strategyIndex of plan.recommendedOrder) {
      const strategy = plan.strategies[strategyIndex];
      
      try {
        const result = strategy.apply(currentConstraints, currentBatches, currentParameters);
        
        if (result.success) {
          currentConstraints = result.modifiedConstraints;
          if (result.modifiedBatches) {
            currentBatches = result.modifiedBatches;
          }
          if (result.modifiedParameters) {
            currentParameters = result.modifiedParameters;
          }
          
          totalRelaxationApplied.push(...result.relaxationApplied);
          totalTradeoffs.push(...result.tradeoffs);
          totalImprovement += result.estimatedImprovement;
        }
      } catch (error) {
        console.warn(`Failed to apply relaxation strategy ${strategy.name}: ${error.message}`);
        continue;
      }
    }

    return {
      success: totalRelaxationApplied.length > 0,
      modifiedConstraints: currentConstraints,
      modifiedBatches: currentBatches,
      modifiedParameters: currentParameters,
      relaxationApplied: totalRelaxationApplied,
      estimatedImprovement: Math.min(100, totalImprovement),
      tradeoffs: totalTradeoffs
    };
  }

  /**
   * Initialize built-in relaxation strategies
   */
  private initializeStrategies(): void {
    // Strategy 1: Reduce lecture frequency
    this.strategies.push({
      name: 'Reduce Lecture Frequency',
      description: 'Reduce the number of lectures per week for selected subjects',
      impact: 'high',
      applicability: (analysis) => analysis.recommendations.some(r => 
        r.type === RecommendationType.REDUCE_LECTURES),
      apply: (constraints, batches, parameters) => {
        const modifiedBatches = batches.map(batch => {
          const newBatch = this.cloneBatch(batch);
          
          // Reduce lectures for subjects with high frequency
          newBatch.subjects.forEach(subject => {
            if (subject.lecturesPerWeek > 3) {
              // Reduce by 1 lecture per week
              const newLectures = subject.lecturesPerWeek - 1;
              this.updateSubjectLectures(subject, newLectures);
            }
          });
          
          return newBatch;
        });

        return {
          success: true,
          modifiedConstraints: constraints,
          modifiedBatches,
          relaxationApplied: ['Reduced lecture frequency for high-frequency subjects'],
          estimatedImprovement: 30,
          tradeoffs: ['Reduced contact hours for some subjects', 'May require self-study compensation']
        };
      }
    });

    // Strategy 2: Allow faculty overlap
    this.strategies.push({
      name: 'Allow Faculty Overlap',
      description: 'Relax strict faculty conflict constraints to allow some overlap',
      impact: 'medium',
      applicability: (analysis) => analysis.issues.some(i => 
        i.type === 'faculty_overload' || i.type === 'conflicting_constraints'),
      apply: (constraints, batches, parameters) => {
        // Remove or relax faculty conflict constraints
        const relaxedConstraints = constraints.filter(constraint => 
          !constraint.constructor.name.includes('FacultyConflict')
        );

        return {
          success: true,
          modifiedConstraints: relaxedConstraints,
          relaxationApplied: ['Removed strict faculty conflict constraints'],
          estimatedImprovement: 25,
          tradeoffs: ['Faculty may have back-to-back lectures', 'Increased faculty workload']
        };
      }
    });

    // Strategy 3: Extend working hours
    this.strategies.push({
      name: 'Extend Working Hours',
      description: 'Extend daily working hours to create more time slots',
      impact: 'high',
      applicability: (analysis) => analysis.recommendations.some(r => 
        r.type === RecommendationType.EXTEND_HOURS),
      apply: (constraints, batches, parameters) => {
        const modifiedParameters = { ...parameters };
        
        // Extend working hours by 1 hour on each end
        const currentStart = this.parseTime(modifiedParameters.workingHours.start);
        const currentEnd = this.parseTime(modifiedParameters.workingHours.end);
        
        modifiedParameters.workingHours = {
          start: this.formatTime(Math.max(480, currentStart - 60)), // Not before 8 AM
          end: this.formatTime(Math.min(1200, currentEnd + 60))     // Not after 8 PM
        };

        return {
          success: true,
          modifiedConstraints: constraints,
          modifiedParameters,
          relaxationApplied: ['Extended working hours'],
          estimatedImprovement: 35,
          tradeoffs: ['Longer days for students and faculty', 'Early morning or late evening classes']
        };
      }
    });

    // Strategy 4: Allow batch splitting
    this.strategies.push({
      name: 'Allow Batch Splitting',
      description: 'Split large batches into smaller groups to reduce scheduling pressure',
      impact: 'high',
      applicability: (analysis) => analysis.recommendations.some(r => 
        r.type === RecommendationType.SPLIT_BATCHES),
      apply: (constraints, batches, parameters) => {
        const modifiedBatches: Batch[] = [];

        batches.forEach(batch => {
          const totalLectures = batch.getTotalLecturesPerWeek();
          
          if (totalLectures > 20) { // Split large batches
            // Create two smaller batches
            const batch1 = new Batch(`${batch.id}_A`, `${batch.name} - Group A`);
            const batch2 = new Batch(`${batch.id}_B`, `${batch.name} - Group B`);
            
            const subjects = batch.subjects;
            const midpoint = Math.ceil(subjects.length / 2);
            
            subjects.slice(0, midpoint).forEach(subject => {
              batch1.addSubject(this.cloneSubject(subject));
            });
            
            subjects.slice(midpoint).forEach(subject => {
              batch2.addSubject(this.cloneSubject(subject));
            });
            
            modifiedBatches.push(batch1, batch2);
          } else {
            modifiedBatches.push(this.cloneBatch(batch));
          }
        });

        return {
          success: modifiedBatches.length > batches.length,
          modifiedConstraints: constraints,
          modifiedBatches,
          relaxationApplied: ['Split large batches into smaller groups'],
          estimatedImprovement: 40,
          tradeoffs: ['Increased number of batches to manage', 'May require additional faculty']
        };
      }
    });

    // Strategy 5: Standardize durations
    this.strategies.push({
      name: 'Standardize Durations',
      description: 'Standardize all lecture durations to improve slot utilization',
      impact: 'medium',
      applicability: (analysis) => analysis.recommendations.some(r => 
        r.type === RecommendationType.ADJUST_DURATIONS),
      apply: (constraints, batches, parameters) => {
        const standardDuration = parameters.slotDuration || 60;
        const modifiedBatches = batches.map(batch => {
          const newBatch = this.cloneBatch(batch);
          
          newBatch.subjects.forEach(subject => {
            if (subject.lectureDuration !== standardDuration) {
              this.updateSubjectDuration(subject, standardDuration);
            }
          });
          
          return newBatch;
        });

        return {
          success: true,
          modifiedConstraints: constraints,
          modifiedBatches,
          relaxationApplied: [`Standardized all lectures to ${standardDuration} minutes`],
          estimatedImprovement: 20,
          tradeoffs: ['Some subjects may have too much or too little time', 'Loss of duration flexibility']
        };
      }
    });

    // Strategy 6: Enable partial scheduling
    this.strategies.push({
      name: 'Enable Partial Scheduling',
      description: 'Allow incomplete schedules with prioritized subjects',
      impact: 'medium',
      applicability: (analysis) => analysis.partialSolutionPossible,
      apply: (constraints, batches, parameters) => {
        const modifiedParameters = { ...parameters };
        modifiedParameters.allowPartialSchedules = true;
        modifiedParameters.prioritizeCore = true;

        // Prioritize subjects (could be based on importance, frequency, etc.)
        const modifiedBatches = batches.map(batch => {
          const newBatch = this.cloneBatch(batch);
          const subjects = newBatch.subjects;
          
          // Mark high-frequency subjects as priority
          subjects.forEach(subject => {
            if (subject.lecturesPerWeek >= 3) {
              (subject as any).priority = 'high';
            } else {
              (subject as any).priority = 'low';
            }
          });
          
          return newBatch;
        });

        return {
          success: true,
          modifiedConstraints: constraints,
          modifiedBatches,
          modifiedParameters,
          relaxationApplied: ['Enabled partial scheduling with subject prioritization'],
          estimatedImprovement: 50,
          tradeoffs: ['Some subjects may not be scheduled', 'Requires manual scheduling for unscheduled subjects']
        };
      }
    });

    // Strategy 7: Reduce break times
    this.strategies.push({
      name: 'Reduce Break Times',
      description: 'Reduce break duration between lectures to create more slots',
      impact: 'low',
      applicability: (analysis) => analysis.recommendations.some(r => 
        r.type === RecommendationType.EXTEND_HOURS),
      apply: (constraints, batches, parameters) => {
        const modifiedParameters = { ...parameters };
        const currentBreak = modifiedParameters.breakDuration || 15;
        
        if (currentBreak > 5) {
          modifiedParameters.breakDuration = Math.max(5, currentBreak - 10);
        }

        return {
          success: currentBreak > 5,
          modifiedConstraints: constraints,
          modifiedParameters,
          relaxationApplied: [`Reduced break time to ${modifiedParameters.breakDuration} minutes`],
          estimatedImprovement: 15,
          tradeoffs: ['Less time for students to move between classes', 'Increased fatigue']
        };
      }
    });

    // Strategy 8: Add Saturday classes
    this.strategies.push({
      name: 'Add Saturday Classes',
      description: 'Extend schedule to include Saturday morning sessions',
      impact: 'high',
      applicability: (analysis) => analysis.recommendations.some(r => 
        r.type === RecommendationType.ADD_DAYS),
      apply: (constraints, batches, parameters) => {
        const modifiedParameters = { ...parameters };
        
        if (!modifiedParameters.workingDays.includes(DayOfWeek.SATURDAY)) {
          modifiedParameters.workingDays = [...modifiedParameters.workingDays, DayOfWeek.SATURDAY];
          
          // Limit Saturday to morning sessions only
          modifiedParameters.saturdayHours = { start: '08:00', end: '13:00' };
        }

        return {
          success: !parameters.workingDays.includes(DayOfWeek.SATURDAY),
          modifiedConstraints: constraints,
          modifiedParameters,
          relaxationApplied: ['Added Saturday morning sessions'],
          estimatedImprovement: 45,
          tradeoffs: ['Weekend classes for students and faculty', 'Reduced weekend rest time']
        };
      }
    });
  }

  /**
   * Helper methods
   */
  private calculateExpectedImprovement(strategies: RelaxationStrategy[], analysis: ScenarioAnalysis): number {
    // Estimate total improvement from all applicable strategies
    const totalImprovement = strategies.reduce((sum, strategy) => {
      const mockResult = strategy.apply([], [], {});
      return sum + (mockResult.estimatedImprovement || 0);
    }, 0);

    // Cap at 100% and apply diminishing returns
    return Math.min(100, totalImprovement * 0.7);
  }

  private collectTradeoffs(
    strategies: RelaxationStrategy[],
    constraints: BaseConstraint[],
    batches: Batch[],
    parameters: any
  ): string[] {
    const allTradeoffs: string[] = [];
    
    strategies.forEach(strategy => {
      try {
        const result = strategy.apply(constraints, batches, parameters);
        allTradeoffs.push(...result.tradeoffs);
      } catch (error) {
        // Skip strategies that fail during tradeoff collection
      }
    });

    // Remove duplicates
    return Array.from(new Set(allTradeoffs));
  }

  private determineOptimalOrder(strategies: RelaxationStrategy[], analysis: ScenarioAnalysis): number[] {
    // Create strategy indices with priority scores
    const strategyPriorities = strategies.map((strategy, index) => {
      let priority = 0;
      
      // Higher impact strategies get higher priority
      const impactWeight = { low: 1, medium: 3, high: 5 };
      priority += impactWeight[strategy.impact];
      
      // Strategies that address critical issues get higher priority
      const criticalIssues = analysis.issues.filter(i => i.severity === 'critical');
      if (criticalIssues.length > 0) {
        // Boost priority for strategies that address critical issues
        if (strategy.name.includes('Reduce') || strategy.name.includes('Extend') || strategy.name.includes('Split')) {
          priority += 3;
        }
      }
      
      return { index, priority };
    });

    // Sort by priority (higher first) and return indices
    return strategyPriorities
      .sort((a, b) => b.priority - a.priority)
      .map(item => item.index);
  }

  private cloneBatch(batch: Batch): Batch {
    const newBatch = new Batch(batch.id, batch.name);
    batch.subjects.forEach(subject => {
      newBatch.addSubject(this.cloneSubject(subject));
    });
    return newBatch;
  }

  private cloneSubject(subject: Subject): Subject {
    return new Subject(
      subject.id,
      subject.name,
      subject.lecturesPerWeek,
      subject.lectureDuration,
      subject.facultyId
    );
  }

  private updateSubjectLectures(subject: Subject, newLectures: number): void {
    // This would require modifying the Subject class to allow updates
    // For now, we'll use a type assertion to modify the private property
    (subject as any).lecturesPerWeek = newLectures;
  }

  private updateSubjectDuration(subject: Subject, newDuration: number): void {
    // This would require modifying the Subject class to allow updates
    // For now, we'll use a type assertion to modify the private property
    (subject as any).durationMinutes = newDuration;
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

  /**
   * Register a custom relaxation strategy
   */
  registerStrategy(strategy: RelaxationStrategy): void {
    this.strategies.push(strategy);
  }

  /**
   * Get all available strategies
   */
  getAvailableStrategies(): RelaxationStrategy[] {
    return [...this.strategies];
  }

  /**
   * Remove a strategy
   */
  removeStrategy(strategyName: string): boolean {
    const index = this.strategies.findIndex(s => s.name === strategyName);
    if (index > -1) {
      this.strategies.splice(index, 1);
      return true;
    }
    return false;
  }
}
