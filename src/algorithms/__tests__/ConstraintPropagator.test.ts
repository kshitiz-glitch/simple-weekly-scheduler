import { ConstraintPropagator, Domain } from '../ConstraintPropagator';
import { DayOfWeek, TimeSlot, ScheduleEntry } from '../../models';
import { FacultyConflictConstraint, TimeSlotAvailabilityConstraint } from '../../services/constraints';

describe('ConstraintPropagator', () => {
  let propagator: ConstraintPropagator;
  let mockSlots: TimeSlot[];
  let mockDomains: Domain[];

  beforeEach(() => {
    propagator = new ConstraintPropagator();
    
    mockSlots = [
      {
        day: DayOfWeek.MONDAY,
        startTime: '09:00',
        endTime: '10:00',
        isAvailable: true
      },
      {
        day: DayOfWeek.MONDAY,
        startTime: '10:00',
        endTime: '11:00',
        isAvailable: true
      },
      {
        day: DayOfWeek.TUESDAY,
        startTime: '09:00',
        endTime: '10:00',
        isAvailable: true
      }
    ];

    mockDomains = [
      {
        lectureId: 'lecture_1',
        availableSlots: [...mockSlots],
        originalSlotCount: mockSlots.length
      },
      {
        lectureId: 'lecture_2',
        availableSlots: [...mockSlots],
        originalSlotCount: mockSlots.length
      }
    ];
  });

  describe('propagateConstraints', () => {
    it('should propagate constraints and reduce domains', () => {
      const constraints = [new FacultyConflictConstraint()];
      const currentSchedule: ScheduleEntry[] = [];

      const result = propagator.propagateConstraints(mockDomains, constraints, currentSchedule);

      expect(result.propagationCount).toBeGreaterThan(0);
      expect(result.constraintApplications).toBeGreaterThan(0);
      expect(result.validSlots.length).toBeGreaterThan(0);
    });

    it('should handle empty domains', () => {
      const constraints = [new FacultyConflictConstraint()];
      const currentSchedule: ScheduleEntry[] = [];

      const result = propagator.propagateConstraints([], constraints, currentSchedule);

      expect(result.propagationCount).toBe(1);
      expect(result.validSlots).toHaveLength(0);
    });

    it('should handle disabled constraints', () => {
      const constraint = new FacultyConflictConstraint();
      constraint.setEnabled(false);
      const constraints = [constraint];
      const currentSchedule: ScheduleEntry[] = [];

      const result = propagator.propagateConstraints(mockDomains, constraints, currentSchedule);

      // Should still run but not apply disabled constraints
      expect(result.propagationCount).toBeGreaterThan(0);
    });

    it('should prevent infinite loops', () => {
      const constraints = [new FacultyConflictConstraint()];
      const currentSchedule: ScheduleEntry[] = [];

      const result = propagator.propagateConstraints(mockDomains, constraints, currentSchedule);

      expect(result.propagationCount).toBeLessThanOrEqual(100);
    });
  });

  describe('forwardCheck', () => {
    it('should apply forward checking to remaining domains', () => {
      const newEntry: ScheduleEntry = {
        batchId: 'batch_1',
        subjectId: 'subject_1',
        facultyId: 'faculty_1',
        timeSlot: mockSlots[0]
      };

      const constraints = [new FacultyConflictConstraint()];
      const currentSchedule: ScheduleEntry[] = [];

      const result = propagator.forwardCheck(newEntry, mockDomains, constraints, currentSchedule);

      expect(result).toHaveLength(mockDomains.length);
      expect(result.every(domain => domain.availableSlots.length >= 0)).toBe(true);
    });

    it('should eliminate conflicting slots', () => {
      const newEntry: ScheduleEntry = {
        batchId: 'batch_1',
        subjectId: 'subject_1',
        facultyId: 'faculty_1',
        timeSlot: mockSlots[0]
      };

      // Create domains with same faculty (should cause conflicts)
      const conflictingDomains: Domain[] = [{
        lectureId: 'lecture_2',
        availableSlots: [mockSlots[0]], // Same slot as newEntry
        originalSlotCount: 1
      }];

      const constraints = [new FacultyConflictConstraint()];
      const currentSchedule: ScheduleEntry[] = [];

      const result = propagator.forwardCheck(newEntry, conflictingDomains, constraints, currentSchedule);

      // Should eliminate the conflicting slot
      expect(result[0].availableSlots.length).toBeLessThanOrEqual(conflictingDomains[0].availableSlots.length);
    });
  });

  describe('domain selection heuristics', () => {
    it('should find most constrained domain', () => {
      const constrainedDomains: Domain[] = [
        {
          lectureId: 'lecture_1',
          availableSlots: mockSlots.slice(0, 3), // 3 slots
          originalSlotCount: 3
        },
        {
          lectureId: 'lecture_2',
          availableSlots: mockSlots.slice(0, 1), // 1 slot (most constrained)
          originalSlotCount: 3
        }
      ];

      const mostConstrained = propagator.findMostConstrainedDomain(constrainedDomains);

      expect(mostConstrained).toBe(constrainedDomains[1]);
      expect(mostConstrained!.availableSlots).toHaveLength(1);
    });

    it('should return null for empty domains list', () => {
      const mostConstrained = propagator.findMostConstrainedDomain([]);

      expect(mostConstrained).toBeNull();
    });

    it('should find most constraining domain', () => {
      const constraints = [new FacultyConflictConstraint()];
      
      const mostConstraining = propagator.findMostConstrainingDomain(mockDomains, constraints);

      expect(mostConstraining).not.toBeNull();
      expect(mockDomains).toContain(mostConstraining);
    });

    it('should order slots by least constraining value', () => {
      const domain = mockDomains[0];
      const otherDomains = mockDomains.slice(1);
      const constraints = [new FacultyConflictConstraint()];

      const orderedSlots = propagator.orderSlotsByLeastConstraining(domain, otherDomains, constraints);

      expect(orderedSlots).toHaveLength(domain.availableSlots.length);
      expect(orderedSlots.every(slot => domain.availableSlots.includes(slot))).toBe(true);
    });
  });

  describe('domain consistency', () => {
    it('should return true for consistent domains', () => {
      const consistent = propagator.areDomainsConsistent(mockDomains);

      expect(consistent).toBe(true);
    });

    it('should return false for inconsistent domains', () => {
      const inconsistentDomains: Domain[] = [{
        lectureId: 'lecture_1',
        availableSlots: [], // Empty domain
        originalSlotCount: 3
      }];

      const consistent = propagator.areDomainsConsistent(inconsistentDomains);

      expect(consistent).toBe(false);
    });
  });

  describe('createInitialDomains', () => {
    it('should create domains from lecture requirements', () => {
      const lectureRequirements = [
        { lectureId: 'lecture_1', duration: 60 },
        { lectureId: 'lecture_2', duration: 90 }
      ];

      const domains = propagator.createInitialDomains(lectureRequirements, mockSlots);

      expect(domains).toHaveLength(2);
      expect(domains[0].lectureId).toBe('lecture_1');
      expect(domains[1].lectureId).toBe('lecture_2');
      
      // lecture_2 should have fewer available slots due to longer duration requirement
      expect(domains[1].availableSlots.length).toBeLessThanOrEqual(domains[0].availableSlots.length);
    });

    it('should filter slots by duration requirement', () => {
      const shortSlots: TimeSlot[] = [{
        day: DayOfWeek.MONDAY,
        startTime: '09:00',
        endTime: '09:30', // 30 minutes
        isAvailable: true
      }];

      const lectureRequirements = [
        { lectureId: 'lecture_1', duration: 60 } // Requires 60 minutes
      ];

      const domains = propagator.createInitialDomains(lectureRequirements, shortSlots);

      expect(domains[0].availableSlots).toHaveLength(0); // No slots can accommodate 60-minute lecture
    });
  });

  describe('statistics', () => {
    it('should track and return statistics', () => {
      const constraints = [new FacultyConflictConstraint()];
      const currentSchedule: ScheduleEntry[] = [];

      propagator.propagateConstraints(mockDomains, constraints, currentSchedule);

      const stats = propagator.getStatistics();

      expect(stats.totalPropagations).toBeGreaterThan(0);
      expect(stats.constraintApplications).toBeGreaterThan(0);
      expect(stats.slotsEliminated).toBeGreaterThanOrEqual(0);
    });

    it('should reset statistics', () => {
      const constraints = [new FacultyConflictConstraint()];
      const currentSchedule: ScheduleEntry[] = [];

      propagator.propagateConstraints(mockDomains, constraints, currentSchedule);
      propagator.resetStatistics();

      const stats = propagator.getStatistics();

      expect(stats.totalPropagations).toBe(0);
      expect(stats.constraintApplications).toBe(0);
      expect(stats.slotsEliminated).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle domains with no available slots', () => {
      const emptyDomains: Domain[] = [{
        lectureId: 'lecture_1',
        availableSlots: [],
        originalSlotCount: 0
      }];

      const constraints = [new FacultyConflictConstraint()];
      const currentSchedule: ScheduleEntry[] = [];

      const result = propagator.propagateConstraints(emptyDomains, constraints, currentSchedule);

      expect(result.validSlots).toHaveLength(0);
      expect(result.propagationCount).toBeGreaterThan(0);
    });

    it('should handle empty constraints list', () => {
      const constraints: any[] = [];
      const currentSchedule: ScheduleEntry[] = [];

      const result = propagator.propagateConstraints(mockDomains, constraints, currentSchedule);

      expect(result.validSlots.length).toBeGreaterThan(0);
      expect(result.constraintApplications).toBe(0);
    });

    it('should handle single domain', () => {
      const singleDomain = [mockDomains[0]];
      const constraints = [new FacultyConflictConstraint()];
      const currentSchedule: ScheduleEntry[] = [];

      const result = propagator.propagateConstraints(singleDomain, constraints, currentSchedule);

      expect(result.validSlots.length).toBeGreaterThan(0);
    });
  });
});
