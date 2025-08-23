import { ScheduleEntry, TimeSlot, DayOfWeek } from '../models';
import { BaseConstraint } from '../services/constraints';

export interface PropagationResult {
  validSlots: TimeSlot[];
  eliminatedSlots: TimeSlot[];
  propagationCount: number;
  constraintApplications: number;
}

export interface Domain {
  lectureId: string;
  availableSlots: TimeSlot[];
  originalSlotCount: number;
}

export class ConstraintPropagator {
  private propagationStats = {
    totalPropagations: 0,
    constraintApplications: 0,
    slotsEliminated: 0
  };

  /**
   * Apply constraint propagation to reduce the search space
   */
  propagateConstraints(
    domains: Domain[],
    constraints: BaseConstraint[],
    currentSchedule: ScheduleEntry[]
  ): PropagationResult {
    const startingSlotCount = domains.reduce((sum, domain) => sum + domain.availableSlots.length, 0);
    let propagationCount = 0;
    let constraintApplications = 0;
    let changed = true;

    // Keep propagating until no more changes occur
    while (changed) {
      changed = false;
      propagationCount++;

      // Apply each constraint to reduce domains
      for (const constraint of constraints) {
        if (!constraint.isConstraintEnabled()) {
          continue;
        }

        for (const domain of domains) {
          const originalSlotCount = domain.availableSlots.length;
          
          domain.availableSlots = domain.availableSlots.filter(slot => {
            constraintApplications++;
            
            // Create a hypothetical schedule entry
            const testEntry: ScheduleEntry = {
              batchId: 'test',
              subjectId: domain.lectureId,
              facultyId: 'test',
              timeSlot: slot
            };

            // Check if this slot violates the constraint
            const violation = constraint.validate(testEntry, currentSchedule);
            return violation === null;
          });

          if (domain.availableSlots.length < originalSlotCount) {
            changed = true;
            this.propagationStats.slotsEliminated += originalSlotCount - domain.availableSlots.length;
          }
        }
      }

      // Apply arc consistency (mutual constraint checking)
      if (this.applyArcConsistency(domains, currentSchedule)) {
        changed = true;
      }

      // Prevent infinite loops
      if (propagationCount > 100) {
        break;
      }
    }

    const finalSlotCount = domains.reduce((sum, domain) => sum + domain.availableSlots.length, 0);
    const eliminatedSlots: TimeSlot[] = []; // Would need to track eliminated slots if needed

    this.propagationStats.totalPropagations += propagationCount;
    this.propagationStats.constraintApplications += constraintApplications;

    return {
      validSlots: domains.flatMap(domain => domain.availableSlots),
      eliminatedSlots,
      propagationCount,
      constraintApplications
    };
  }

  /**
   * Apply forward checking to eliminate invalid slots early
   */
  forwardCheck(
    newEntry: ScheduleEntry,
    remainingDomains: Domain[],
    constraints: BaseConstraint[],
    currentSchedule: ScheduleEntry[]
  ): Domain[] {
    const updatedSchedule = [...currentSchedule, newEntry];
    
    return remainingDomains.map(domain => {
      const validSlots = domain.availableSlots.filter(slot => {
        const testEntry: ScheduleEntry = {
          batchId: 'test',
          subjectId: domain.lectureId,
          facultyId: 'test',
          timeSlot: slot
        };

        // Check if this slot would be valid with the new entry
        return constraints.every(constraint => {
          if (!constraint.isConstraintEnabled()) {
            return true;
          }
          
          const violation = constraint.validate(testEntry, updatedSchedule);
          return violation === null;
        });
      });

      return {
        ...domain,
        availableSlots: validSlots
      };
    });
  }

  /**
   * Apply arc consistency between domains
   */
  private applyArcConsistency(domains: Domain[], currentSchedule: ScheduleEntry[]): boolean {
    let changed = false;

    // For each pair of domains, ensure they don't conflict
    for (let i = 0; i < domains.length; i++) {
      for (let j = i + 1; j < domains.length; j++) {
        const domain1 = domains[i];
        const domain2 = domains[j];

        // Remove slots from domain1 that would conflict with all slots in domain2
        const originalCount1 = domain1.availableSlots.length;
        domain1.availableSlots = domain1.availableSlots.filter(slot1 => {
          // Check if there's at least one compatible slot in domain2
          return domain2.availableSlots.some(slot2 => {
            return this.slotsAreCompatible(slot1, slot2, domain1.lectureId, domain2.lectureId);
          });
        });

        if (domain1.availableSlots.length < originalCount1) {
          changed = true;
        }

        // Do the same for domain2
        const originalCount2 = domain2.availableSlots.length;
        domain2.availableSlots = domain2.availableSlots.filter(slot2 => {
          return domain1.availableSlots.some(slot1 => {
            return this.slotsAreCompatible(slot1, slot2, domain1.lectureId, domain2.lectureId);
          });
        });

        if (domain2.availableSlots.length < originalCount2) {
          changed = true;
        }
      }
    }

    return changed;
  }

  /**
   * Check if two slots are compatible (don't conflict)
   */
  private slotsAreCompatible(
    slot1: TimeSlot,
    slot2: TimeSlot,
    lectureId1: string,
    lectureId2: string
  ): boolean {
    // Different lectures can't use the same time slot
    if (this.slotsOverlap(slot1, slot2)) {
      return false;
    }

    // Add more compatibility checks as needed
    return true;
  }

  /**
   * Check if two time slots overlap
   */
  private slotsOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
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
   * Get propagation statistics
   */
  getStatistics(): {
    totalPropagations: number;
    constraintApplications: number;
    slotsEliminated: number;
  } {
    return { ...this.propagationStats };
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.propagationStats = {
      totalPropagations: 0,
      constraintApplications: 0,
      slotsEliminated: 0
    };
  }

  /**
   * Find the most constrained domain (smallest number of available slots)
   */
  findMostConstrainedDomain(domains: Domain[]): Domain | null {
    if (domains.length === 0) {
      return null;
    }

    return domains.reduce((mostConstrained, current) => {
      if (current.availableSlots.length < mostConstrained.availableSlots.length) {
        return current;
      }
      return mostConstrained;
    });
  }

  /**
   * Find the most constraining domain (affects the most other domains)
   */
  findMostConstrainingDomain(domains: Domain[], constraints: BaseConstraint[]): Domain | null {
    if (domains.length === 0) {
      return null;
    }

    let mostConstraining = domains[0];
    let maxConstrainingScore = 0;

    for (const domain of domains) {
      let constrainingScore = 0;

      // Count how many other domains this domain affects
      for (const otherDomain of domains) {
        if (domain === otherDomain) continue;

        for (const slot of domain.availableSlots) {
          const testEntry: ScheduleEntry = {
            batchId: 'test',
            subjectId: domain.lectureId,
            facultyId: 'test',
            timeSlot: slot
          };

          // Count how many slots in other domain would be eliminated
          const eliminatedCount = otherDomain.availableSlots.filter(otherSlot => {
            const otherTestEntry: ScheduleEntry = {
              batchId: 'test',
              subjectId: otherDomain.lectureId,
              facultyId: 'test',
              timeSlot: otherSlot
            };

            return constraints.some(constraint => {
              if (!constraint.isConstraintEnabled()) return false;
              const violation = constraint.validate(otherTestEntry, [testEntry]);
              return violation !== null;
            });
          }).length;

          constrainingScore += eliminatedCount;
        }
      }

      if (constrainingScore > maxConstrainingScore) {
        maxConstrainingScore = constrainingScore;
        mostConstraining = domain;
      }
    }

    return mostConstraining;
  }

  /**
   * Apply least constraining value heuristic to order slot choices
   */
  orderSlotsByLeastConstraining(
    domain: Domain,
    otherDomains: Domain[],
    constraints: BaseConstraint[]
  ): TimeSlot[] {
    const slotScores = domain.availableSlots.map(slot => {
      let constrainingScore = 0;

      const testEntry: ScheduleEntry = {
        batchId: 'test',
        subjectId: domain.lectureId,
        facultyId: 'test',
        timeSlot: slot
      };

      // Count how many slots in other domains would be eliminated
      for (const otherDomain of otherDomains) {
        const eliminatedCount = otherDomain.availableSlots.filter(otherSlot => {
          const otherTestEntry: ScheduleEntry = {
            batchId: 'test',
            subjectId: otherDomain.lectureId,
            facultyId: 'test',
            timeSlot: otherSlot
          };

          return constraints.some(constraint => {
            if (!constraint.isConstraintEnabled()) return false;
            const violation = constraint.validate(otherTestEntry, [testEntry]);
            return violation !== null;
          });
        }).length;

        constrainingScore += eliminatedCount;
      }

      return { slot, score: constrainingScore };
    });

    // Sort by least constraining (lowest score) first
    slotScores.sort((a, b) => a.score - b.score);
    return slotScores.map(item => item.slot);
  }

  /**
   * Check if domains are consistent (no empty domains)
   */
  areDomainsConsistent(domains: Domain[]): boolean {
    return domains.every(domain => domain.availableSlots.length > 0);
  }

  /**
   * Create initial domains from lecture requirements
   */
  createInitialDomains(
    lectureRequirements: { lectureId: string; duration: number }[],
    availableSlots: TimeSlot[]
  ): Domain[] {
    return lectureRequirements.map(requirement => ({
      lectureId: requirement.lectureId,
      availableSlots: availableSlots.filter(slot => {
        const slotDuration = this.calculateSlotDuration(slot);
        return slotDuration >= requirement.duration;
      }),
      originalSlotCount: availableSlots.length
    }));
  }

  /**
   * Calculate duration of a time slot in minutes
   */
  private calculateSlotDuration(slot: TimeSlot): number {
    const startMinutes = this.timeToMinutes(slot.startTime);
    const endMinutes = this.timeToMinutes(slot.endTime);
    return endMinutes - startMinutes;
  }
}
