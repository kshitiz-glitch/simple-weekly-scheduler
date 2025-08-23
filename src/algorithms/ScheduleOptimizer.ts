import { ScheduleEntry, TimeSlot, DayOfWeek, Batch, Subject } from '../models';
import { OptimizationStrategy } from './index';

export interface OptimizationMetrics {
  distributionScore: number;
  gapScore: number;
  facultyWorkloadScore: number;
  timePreferenceScore: number;
  overallScore: number;
}

export interface OptimizationOptions {
  prioritizeEvenDistribution: boolean;
  minimizeGaps: boolean;
  balanceFacultyWorkload: boolean;
  preferMorningSlots: boolean;
  maxOptimizationIterations: number;
  improvementThreshold: number;
}

export class ScheduleOptimizer implements OptimizationStrategy {
  private options: OptimizationOptions;

  constructor(options?: Partial<OptimizationOptions>) {
    this.options = {
      prioritizeEvenDistribution: true,
      minimizeGaps: true,
      balanceFacultyWorkload: true,
      preferMorningSlots: false,
      maxOptimizationIterations: 100,
      improvementThreshold: 0.01,
      ...options
    };
  }

  /**
   * Optimize a schedule using various strategies
   */
  optimize(schedule: ScheduleEntry[]): ScheduleEntry[] {
    if (schedule.length === 0) {
      return schedule;
    }

    let currentSchedule = [...schedule];
    let currentScore = this.calculateScore(currentSchedule);
    let iterations = 0;

    while (iterations < this.options.maxOptimizationIterations) {
      const optimizedSchedule = this.applyOptimizationStrategies(currentSchedule);
      const newScore = this.calculateScore(optimizedSchedule);

      // Check if improvement is significant enough
      if (newScore - currentScore > this.options.improvementThreshold) {
        currentSchedule = optimizedSchedule;
        currentScore = newScore;
      } else {
        break; // No significant improvement
      }

      iterations++;
    }

    return currentSchedule;
  }

  /**
   * Calculate overall score for a schedule
   */
  calculateScore(schedule: ScheduleEntry[]): number {
    const metrics = this.calculateMetrics(schedule);
    
    let totalScore = 0;
    let weightSum = 0;

    if (this.options.prioritizeEvenDistribution) {
      totalScore += metrics.distributionScore * 0.3;
      weightSum += 0.3;
    }

    if (this.options.minimizeGaps) {
      totalScore += metrics.gapScore * 0.25;
      weightSum += 0.25;
    }

    if (this.options.balanceFacultyWorkload) {
      totalScore += metrics.facultyWorkloadScore * 0.25;
      weightSum += 0.25;
    }

    if (this.options.preferMorningSlots) {
      totalScore += metrics.timePreferenceScore * 0.2;
      weightSum += 0.2;
    }

    return weightSum > 0 ? totalScore / weightSum : 0;
  }

  /**
   * Calculate detailed optimization metrics
   */
  calculateMetrics(schedule: ScheduleEntry[]): OptimizationMetrics {
    const distributionScore = this.calculateDistributionScore(schedule);
    const gapScore = this.calculateGapScore(schedule);
    const facultyWorkloadScore = this.calculateFacultyWorkloadScore(schedule);
    const timePreferenceScore = this.calculateTimePreferenceScore(schedule);

    const overallScore = this.calculateScore(schedule);

    return {
      distributionScore,
      gapScore,
      facultyWorkloadScore,
      timePreferenceScore,
      overallScore
    };
  }

  /**
   * Apply various optimization strategies
   */
  private applyOptimizationStrategies(schedule: ScheduleEntry[]): ScheduleEntry[] {
    let optimizedSchedule = [...schedule];

    if (this.options.prioritizeEvenDistribution) {
      optimizedSchedule = this.optimizeDistribution(optimizedSchedule);
    }

    if (this.options.minimizeGaps) {
      optimizedSchedule = this.minimizeGaps(optimizedSchedule);
    }

    if (this.options.balanceFacultyWorkload) {
      optimizedSchedule = this.balanceFacultyWorkload(optimizedSchedule);
    }

    if (this.options.preferMorningSlots) {
      optimizedSchedule = this.preferMorningSlots(optimizedSchedule);
    }

    return optimizedSchedule;
  }

  /**
   * Optimize lecture distribution across the week
   */
  private optimizeDistribution(schedule: ScheduleEntry[]): ScheduleEntry[] {
    // Group entries by batch and subject
    const subjectGroups = new Map<string, ScheduleEntry[]>();
    
    schedule.forEach(entry => {
      const key = `${entry.batchId}_${entry.subjectId}`;
      if (!subjectGroups.has(key)) {
        subjectGroups.set(key, []);
      }
      subjectGroups.get(key)!.push(entry);
    });

    const optimizedEntries: ScheduleEntry[] = [];
    const usedSlots = new Set<string>();

    // Process each subject group
    subjectGroups.forEach((entries, key) => {
      if (entries.length <= 1) {
        optimizedEntries.push(...entries);
        entries.forEach(entry => usedSlots.add(this.getSlotKey(entry.timeSlot)));
        return;
      }

      // Apply advanced distribution optimization
      const redistributed = this.applyAdvancedDistribution(entries, usedSlots, schedule);
      optimizedEntries.push(...redistributed);
      redistributed.forEach(entry => usedSlots.add(this.getSlotKey(entry.timeSlot)));
    });

    return optimizedEntries;
  }

  /**
   * Apply advanced distribution algorithms for optimal lecture spacing
   */
  private applyAdvancedDistribution(
    entries: ScheduleEntry[], 
    usedSlots: Set<string>, 
    fullSchedule: ScheduleEntry[]
  ): ScheduleEntry[] {
    if (entries.length <= 1) {
      return entries;
    }

    // Strategy 1: Even distribution across weekdays
    const evenlyDistributed = this.distributeEvenly(entries, usedSlots);
    
    // Strategy 2: Optimize spacing between lectures
    const spacingOptimized = this.optimizeLectureSpacing(evenlyDistributed, fullSchedule);
    
    // Strategy 3: Balance daily load
    const loadBalanced = this.balanceDailyLoad(spacingOptimized, fullSchedule);

    return loadBalanced;
  }

  /**
   * Distribute lectures evenly across weekdays
   */
  private distributeEvenly(entries: ScheduleEntry[], usedSlots: Set<string>): ScheduleEntry[] {
    const workingDays = [
      DayOfWeek.MONDAY, 
      DayOfWeek.TUESDAY, 
      DayOfWeek.WEDNESDAY, 
      DayOfWeek.THURSDAY, 
      DayOfWeek.FRIDAY
    ];

    // Calculate ideal distribution
    const lecturesPerDay = Math.ceil(entries.length / workingDays.length);
    const remainder = entries.length % workingDays.length;

    // Create distribution plan
    const distributionPlan = new Map<DayOfWeek, number>();
    workingDays.forEach((day, index) => {
      const baseCount = Math.floor(entries.length / workingDays.length);
      const extraLecture = index < remainder ? 1 : 0;
      distributionPlan.set(day, baseCount + extraLecture);
    });

    // Apply distribution
    const distributedEntries: ScheduleEntry[] = [];
    let entryIndex = 0;

    workingDays.forEach(day => {
      const targetCount = distributionPlan.get(day) || 0;
      
      for (let i = 0; i < targetCount && entryIndex < entries.length; i++) {
        const entry = entries[entryIndex];
        
        // Try to move entry to target day if beneficial
        const newEntry = this.tryMoveToDay(entry, day, usedSlots);
        distributedEntries.push(newEntry);
        entryIndex++;
      }
    });

    // Add any remaining entries
    while (entryIndex < entries.length) {
      distributedEntries.push(entries[entryIndex]);
      entryIndex++;
    }

    return distributedEntries;
  }

  /**
   * Optimize spacing between lectures of the same subject
   */
  private optimizeLectureSpacing(entries: ScheduleEntry[], fullSchedule: ScheduleEntry[]): ScheduleEntry[] {
    if (entries.length <= 1) {
      return entries;
    }

    // Sort entries by current day and time
    const sortedEntries = [...entries].sort((a, b) => {
      const dayOrder = Object.values(DayOfWeek);
      const dayA = dayOrder.indexOf(a.timeSlot.day);
      const dayB = dayOrder.indexOf(b.timeSlot.day);
      
      if (dayA !== dayB) {
        return dayA - dayB;
      }
      
      return this.timeToMinutes(a.timeSlot.startTime) - this.timeToMinutes(b.timeSlot.startTime);
    });

    // Calculate optimal spacing
    const workingDays = 5;
    const optimalSpacing = Math.max(1, Math.floor(workingDays / entries.length));

    const spacedEntries: ScheduleEntry[] = [];
    let lastDayIndex = -optimalSpacing;

    for (const entry of sortedEntries) {
      const currentDayIndex = Object.values(DayOfWeek).indexOf(entry.timeSlot.day);
      const daysSinceLastLecture = currentDayIndex - lastDayIndex;

      if (daysSinceLastLecture >= optimalSpacing || spacedEntries.length === 0) {
        // Good spacing, keep the entry
        spacedEntries.push(entry);
        lastDayIndex = currentDayIndex;
      } else {
        // Try to find a better slot with proper spacing
        const betterSlot = this.findBetterSpacedSlot(entry, lastDayIndex, optimalSpacing, fullSchedule);
        spacedEntries.push(betterSlot);
        lastDayIndex = Object.values(DayOfWeek).indexOf(betterSlot.timeSlot.day);
      }
    }

    return spacedEntries;
  }

  /**
   * Balance daily load across student schedules
   */
  private balanceDailyLoad(entries: ScheduleEntry[], fullSchedule: ScheduleEntry[]): ScheduleEntry[] {
    // Group full schedule by batch and day to understand current load
    const batchDailyLoad = new Map<string, Map<DayOfWeek, number>>();
    
    fullSchedule.forEach(entry => {
      if (!batchDailyLoad.has(entry.batchId)) {
        batchDailyLoad.set(entry.batchId, new Map());
      }
      
      const dailyLoad = batchDailyLoad.get(entry.batchId)!;
      const currentLoad = dailyLoad.get(entry.timeSlot.day) || 0;
      dailyLoad.set(entry.timeSlot.day, currentLoad + 1);
    });

    // Try to move lectures from overloaded days to underloaded days
    const balancedEntries: ScheduleEntry[] = [];
    
    for (const entry of entries) {
      const batchLoad = batchDailyLoad.get(entry.batchId);
      if (!batchLoad) {
        balancedEntries.push(entry);
        continue;
      }

      // Find the day with minimum load for this batch
      const currentLoad = batchLoad.get(entry.timeSlot.day) || 0;
      const minLoadDay = this.findMinLoadDay(batchLoad);
      const minLoad = batchLoad.get(minLoadDay) || 0;

      // If current day is significantly more loaded, try to move
      if (currentLoad > minLoad + 1) {
        const movedEntry = this.tryMoveToDay(entry, minLoadDay, new Set());
        balancedEntries.push(movedEntry);
        
        // Update load tracking
        batchLoad.set(entry.timeSlot.day, currentLoad - 1);
        batchLoad.set(minLoadDay, minLoad + 1);
      } else {
        balancedEntries.push(entry);
      }
    }

    return balancedEntries;
  }

  /**
   * Try to move an entry to a specific day
   */
  private tryMoveToDay(entry: ScheduleEntry, targetDay: DayOfWeek, usedSlots: Set<string>): ScheduleEntry {
    // If already on target day, return as-is
    if (entry.timeSlot.day === targetDay) {
      return entry;
    }

    // Try to find a similar time slot on the target day
    const currentTime = entry.timeSlot.startTime;
    const duration = this.timeToMinutes(entry.timeSlot.endTime) - this.timeToMinutes(entry.timeSlot.startTime);

    // Create potential new slot
    const newSlot: TimeSlot = {
      day: targetDay,
      startTime: currentTime,
      endTime: this.minutesToTime(this.timeToMinutes(currentTime) + duration),
      isAvailable: true
    };

    // Check if the new slot would conflict
    const newSlotKey = this.getSlotKey(newSlot);
    if (!usedSlots.has(newSlotKey)) {
      return {
        ...entry,
        timeSlot: newSlot
      };
    }

    // If preferred time is not available, return original entry
    return entry;
  }

  /**
   * Find a better spaced slot for a lecture
   */
  private findBetterSpacedSlot(
    entry: ScheduleEntry, 
    lastDayIndex: number, 
    optimalSpacing: number, 
    fullSchedule: ScheduleEntry[]
  ): ScheduleEntry {
    const workingDays = Object.values(DayOfWeek).slice(0, 5); // Mon-Fri
    const targetDayIndex = (lastDayIndex + optimalSpacing) % workingDays.length;
    const targetDay = workingDays[targetDayIndex];

    // Try to move to target day
    const movedEntry = this.tryMoveToDay(entry, targetDay, new Set());
    
    // If successful move, return it
    if (movedEntry.timeSlot.day === targetDay) {
      return movedEntry;
    }

    // Otherwise, return original entry
    return entry;
  }

  /**
   * Find the day with minimum load for a batch
   */
  private findMinLoadDay(batchLoad: Map<DayOfWeek, number>): DayOfWeek {
    const workingDays = [
      DayOfWeek.MONDAY, 
      DayOfWeek.TUESDAY, 
      DayOfWeek.WEDNESDAY, 
      DayOfWeek.THURSDAY, 
      DayOfWeek.FRIDAY
    ];

    let minDay = workingDays[0];
    let minLoad = batchLoad.get(minDay) || 0;

    for (const day of workingDays) {
      const load = batchLoad.get(day) || 0;
      if (load < minLoad) {
        minLoad = load;
        minDay = day;
      }
    }

    return minDay;
  }

  /**
   * Convert minutes to time string
   */
  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Redistribute lectures for better spacing
   */
  private redistributeLectures(entries: ScheduleEntry[], usedSlots: Set<string>): ScheduleEntry[] {
    if (entries.length <= 1) {
      return entries;
    }

    // Sort entries by current day and time
    const sortedEntries = [...entries].sort((a, b) => {
      const dayOrder = Object.values(DayOfWeek);
      const dayA = dayOrder.indexOf(a.timeSlot.day);
      const dayB = dayOrder.indexOf(b.timeSlot.day);
      
      if (dayA !== dayB) {
        return dayA - dayB;
      }
      
      return a.timeSlot.startTime.localeCompare(b.timeSlot.startTime);
    });

    // Calculate ideal spacing
    const totalDays = 5; // Assuming Mon-Fri
    const idealSpacing = Math.max(1, Math.floor(totalDays / entries.length));

    const redistributed: ScheduleEntry[] = [];
    let currentDay = 0;

    for (let i = 0; i < sortedEntries.length; i++) {
      const entry = sortedEntries[i];
      
      // Try to find a better slot with ideal spacing
      const targetDay = (currentDay + idealSpacing) % totalDays;
      const targetDayOfWeek = Object.values(DayOfWeek)[targetDay];
      
      // For now, keep the original entry (more sophisticated redistribution could be implemented)
      redistributed.push(entry);
      currentDay = targetDay;
    }

    return redistributed;
  }

  /**
   * Minimize gaps in daily schedules
   */
  private minimizeGaps(schedule: ScheduleEntry[]): ScheduleEntry[] {
    // Group by batch and day
    const dayGroups = new Map<string, ScheduleEntry[]>();
    
    schedule.forEach(entry => {
      const key = `${entry.batchId}_${entry.timeSlot.day}`;
      if (!dayGroups.has(key)) {
        dayGroups.set(key, []);
      }
      dayGroups.get(key)!.push(entry);
    });

    const optimizedEntries: ScheduleEntry[] = [];

    // Process each day group to minimize gaps
    dayGroups.forEach((entries, key) => {
      if (entries.length <= 1) {
        optimizedEntries.push(...entries);
        return;
      }

      const gapMinimized = this.applyGapMinimization(entries, schedule);
      optimizedEntries.push(...gapMinimized);
    });

    return optimizedEntries;
  }

  /**
   * Apply sophisticated gap minimization algorithms
   */
  private applyGapMinimization(entries: ScheduleEntry[], fullSchedule: ScheduleEntry[]): ScheduleEntry[] {
    // Sort entries by current time
    const sortedEntries = [...entries].sort((a, b) => 
      this.timeToMinutes(a.timeSlot.startTime) - this.timeToMinutes(b.timeSlot.startTime)
    );

    // Find available time slots for this day
    const day = entries[0].timeSlot.day;
    const availableSlots = this.findAvailableSlotsForDay(day, fullSchedule);

    // Apply gap minimization strategies
    const compactSchedule = this.createCompactSchedule(sortedEntries, availableSlots);
    const gapOptimized = this.optimizeGapDistribution(compactSchedule, availableSlots);

    return gapOptimized;
  }

  /**
   * Create a compact schedule by moving lectures closer together
   */
  private createCompactSchedule(entries: ScheduleEntry[], availableSlots: TimeSlot[]): ScheduleEntry[] {
    if (entries.length <= 1) {
      return entries;
    }

    const compactEntries: ScheduleEntry[] = [];
    const usedTimes = new Set<string>();

    // Start with the earliest entry
    const firstEntry = entries[0];
    compactEntries.push(firstEntry);
    usedTimes.add(firstEntry.timeSlot.startTime);

    // Try to place subsequent entries as close as possible
    for (let i = 1; i < entries.length; i++) {
      const entry = entries[i];
      const lastEntry = compactEntries[compactEntries.length - 1];
      
      // Find the next available slot after the last entry
      const nextSlot = this.findNextAvailableSlot(
        lastEntry.timeSlot.endTime,
        entry.timeSlot.day,
        availableSlots,
        usedTimes
      );

      if (nextSlot) {
        const compactEntry: ScheduleEntry = {
          ...entry,
          timeSlot: nextSlot
        };
        compactEntries.push(compactEntry);
        usedTimes.add(nextSlot.startTime);
      } else {
        // If no better slot found, keep original
        compactEntries.push(entry);
        usedTimes.add(entry.timeSlot.startTime);
      }
    }

    return compactEntries;
  }

  /**
   * Optimize gap distribution to avoid very long gaps
   */
  private optimizeGapDistribution(entries: ScheduleEntry[], availableSlots: TimeSlot[]): ScheduleEntry[] {
    if (entries.length <= 2) {
      return entries;
    }

    const optimizedEntries = [...entries];
    const maxAcceptableGap = 120; // 2 hours

    // Check for excessive gaps and try to redistribute
    for (let i = 1; i < optimizedEntries.length; i++) {
      const prevEntry = optimizedEntries[i - 1];
      const currentEntry = optimizedEntries[i];
      
      const gap = this.calculateGapBetweenEntries(prevEntry, currentEntry);
      
      if (gap > maxAcceptableGap) {
        // Try to find a better position for the current entry
        const betterSlot = this.findBetterSlotToReduceGap(
          currentEntry,
          prevEntry,
          availableSlots,
          maxAcceptableGap
        );
        
        if (betterSlot) {
          optimizedEntries[i] = {
            ...currentEntry,
            timeSlot: betterSlot
          };
        }
      }
    }

    return optimizedEntries;
  }

  /**
   * Find available slots for a specific day
   */
  private findAvailableSlotsForDay(day: DayOfWeek, fullSchedule: ScheduleEntry[]): TimeSlot[] {
    const occupiedTimes = new Set<string>();
    
    fullSchedule
      .filter(entry => entry.timeSlot.day === day)
      .forEach(entry => {
        occupiedTimes.add(entry.timeSlot.startTime);
      });

    // Generate potential time slots for the day (8 AM to 6 PM, hourly)
    const availableSlots: TimeSlot[] = [];
    for (let hour = 8; hour < 18; hour++) {
      const startTime = `${hour.toString().padStart(2, '0')}:00`;
      const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;
      
      if (!occupiedTimes.has(startTime)) {
        availableSlots.push({
          day,
          startTime,
          endTime,
          isAvailable: true
        });
      }
    }

    return availableSlots;
  }

  /**
   * Find the next available slot after a given time
   */
  private findNextAvailableSlot(
    afterTime: string,
    day: DayOfWeek,
    availableSlots: TimeSlot[],
    usedTimes: Set<string>
  ): TimeSlot | null {
    const afterMinutes = this.timeToMinutes(afterTime);
    
    // Find slots that start after the given time and are not used
    const candidateSlots = availableSlots
      .filter(slot => 
        slot.day === day && 
        this.timeToMinutes(slot.startTime) >= afterMinutes &&
        !usedTimes.has(slot.startTime)
      )
      .sort((a, b) => 
        this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime)
      );

    return candidateSlots.length > 0 ? candidateSlots[0] : null;
  }

  /**
   * Calculate gap between two entries in minutes
   */
  private calculateGapBetweenEntries(entry1: ScheduleEntry, entry2: ScheduleEntry): number {
    const end1 = this.timeToMinutes(entry1.timeSlot.endTime);
    const start2 = this.timeToMinutes(entry2.timeSlot.startTime);
    return Math.max(0, start2 - end1);
  }

  /**
   * Find a better slot to reduce gap
   */
  private findBetterSlotToReduceGap(
    entry: ScheduleEntry,
    prevEntry: ScheduleEntry,
    availableSlots: TimeSlot[],
    maxGap: number
  ): TimeSlot | null {
    const targetStartTime = this.timeToMinutes(prevEntry.timeSlot.endTime);
    const maxStartTime = targetStartTime + maxGap;

    // Find slots within acceptable gap range
    const suitableSlots = availableSlots
      .filter(slot => {
        const slotStart = this.timeToMinutes(slot.startTime);
        return slotStart >= targetStartTime && slotStart <= maxStartTime;
      })
      .sort((a, b) => 
        this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime)
      );

    return suitableSlots.length > 0 ? suitableSlots[0] : null;
  }

  /**
   * Balance faculty workload across days
   */
  private balanceFacultyWorkload(schedule: ScheduleEntry[]): ScheduleEntry[] {
    // Group by faculty
    const facultyGroups = new Map<string, ScheduleEntry[]>();
    
    schedule.forEach(entry => {
      if (!facultyGroups.has(entry.facultyId)) {
        facultyGroups.set(entry.facultyId, []);
      }
      facultyGroups.get(entry.facultyId)!.push(entry);
    });

    const optimizedEntries: ScheduleEntry[] = [];

    // Process each faculty group
    facultyGroups.forEach((entries, facultyId) => {
      const balanced = this.applyAdvancedFacultyBalancing(entries, schedule);
      optimizedEntries.push(...balanced);
    });

    return optimizedEntries;
  }

  /**
   * Apply advanced faculty workload balancing algorithms
   */
  private applyAdvancedFacultyBalancing(entries: ScheduleEntry[], fullSchedule: ScheduleEntry[]): ScheduleEntry[] {
    if (entries.length <= 1) {
      return entries;
    }

    // Analyze current workload distribution
    const workloadAnalysis = this.analyzeFacultyWorkload(entries);
    
    // Apply balancing strategies
    const evenlyDistributed = this.distributeFacultyWorkloadEvenly(entries, workloadAnalysis);
    const timeOptimized = this.optimizeFacultyTimeDistribution(evenlyDistributed);
    const conflictResolved = this.resolveFacultyTimeConflicts(timeOptimized, fullSchedule);

    return conflictResolved;
  }

  /**
   * Analyze faculty workload distribution
   */
  private analyzeFacultyWorkload(entries: ScheduleEntry[]): {
    dailyLoad: Map<DayOfWeek, number>;
    totalLoad: number;
    averageLoad: number;
    maxLoad: number;
    minLoad: number;
    variance: number;
  } {
    const dailyLoad = new Map<DayOfWeek, number>();
    const workingDays = [
      DayOfWeek.MONDAY, 
      DayOfWeek.TUESDAY, 
      DayOfWeek.WEDNESDAY, 
      DayOfWeek.THURSDAY, 
      DayOfWeek.FRIDAY
    ];

    // Initialize daily load
    workingDays.forEach(day => dailyLoad.set(day, 0));

    // Count lectures per day
    entries.forEach(entry => {
      const currentLoad = dailyLoad.get(entry.timeSlot.day) || 0;
      dailyLoad.set(entry.timeSlot.day, currentLoad + 1);
    });

    const loads = Array.from(dailyLoad.values());
    const totalLoad = loads.reduce((sum, load) => sum + load, 0);
    const averageLoad = totalLoad / workingDays.length;
    const maxLoad = Math.max(...loads);
    const minLoad = Math.min(...loads);
    const variance = loads.reduce((sum, load) => sum + Math.pow(load - averageLoad, 2), 0) / loads.length;

    return {
      dailyLoad,
      totalLoad,
      averageLoad,
      maxLoad,
      minLoad,
      variance
    };
  }

  /**
   * Distribute faculty workload evenly across days
   */
  private distributeFacultyWorkloadEvenly(
    entries: ScheduleEntry[], 
    workloadAnalysis: ReturnType<typeof this.analyzeFacultyWorkload>
  ): ScheduleEntry[] {
    const { dailyLoad, averageLoad } = workloadAnalysis;
    const workingDays = [
      DayOfWeek.MONDAY, 
      DayOfWeek.TUESDAY, 
      DayOfWeek.WEDNESDAY, 
      DayOfWeek.THURSDAY, 
      DayOfWeek.FRIDAY
    ];

    // Identify overloaded and underloaded days
    const overloadedDays = workingDays.filter(day => 
      (dailyLoad.get(day) || 0) > averageLoad + 0.5
    );
    const underloadedDays = workingDays.filter(day => 
      (dailyLoad.get(day) || 0) < averageLoad - 0.5
    );

    if (overloadedDays.length === 0 || underloadedDays.length === 0) {
      return entries; // Already well balanced
    }

    const balancedEntries = [...entries];
    
    // Move lectures from overloaded to underloaded days
    for (const overloadedDay of overloadedDays) {
      const dayEntries = balancedEntries.filter(entry => entry.timeSlot.day === overloadedDay);
      const excessLectures = Math.floor((dailyLoad.get(overloadedDay) || 0) - averageLoad);
      
      for (let i = 0; i < Math.min(excessLectures, dayEntries.length) && underloadedDays.length > 0; i++) {
        const entryToMove = dayEntries[i];
        const targetDay = underloadedDays[0];
        
        // Try to move the entry
        const movedEntry = this.tryMoveToDay(entryToMove, targetDay, new Set());
        
        if (movedEntry.timeSlot.day === targetDay) {
          // Update the entry in the balanced array
          const entryIndex = balancedEntries.findIndex(e => 
            e.batchId === entryToMove.batchId && 
            e.subjectId === entryToMove.subjectId &&
            e.timeSlot.startTime === entryToMove.timeSlot.startTime
          );
          
          if (entryIndex !== -1) {
            balancedEntries[entryIndex] = movedEntry;
          }
          
          // Update load tracking
          dailyLoad.set(overloadedDay, (dailyLoad.get(overloadedDay) || 0) - 1);
          dailyLoad.set(targetDay, (dailyLoad.get(targetDay) || 0) + 1);
          
          // Remove target day from underloaded if it reaches average
          if ((dailyLoad.get(targetDay) || 0) >= averageLoad - 0.5) {
            const index = underloadedDays.indexOf(targetDay);
            if (index > -1) {
              underloadedDays.splice(index, 1);
            }
          }
        }
      }
    }

    return balancedEntries;
  }

  /**
   * Optimize faculty time distribution within days
   */
  private optimizeFacultyTimeDistribution(entries: ScheduleEntry[]): ScheduleEntry[] {
    // Group by day
    const dailyGroups = new Map<DayOfWeek, ScheduleEntry[]>();
    
    entries.forEach(entry => {
      if (!dailyGroups.has(entry.timeSlot.day)) {
        dailyGroups.set(entry.timeSlot.day, []);
      }
      dailyGroups.get(entry.timeSlot.day)!.push(entry);
    });

    const optimizedEntries: ScheduleEntry[] = [];

    // Optimize time distribution for each day
    dailyGroups.forEach((dayEntries, day) => {
      if (dayEntries.length <= 1) {
        optimizedEntries.push(...dayEntries);
        return;
      }

      // Sort by time and try to create reasonable spacing
      const sortedEntries = dayEntries.sort((a, b) => 
        this.timeToMinutes(a.timeSlot.startTime) - this.timeToMinutes(b.timeSlot.startTime)
      );

      // Apply time distribution optimization
      const timeOptimized = this.optimizeDailyTimeDistribution(sortedEntries);
      optimizedEntries.push(...timeOptimized);
    });

    return optimizedEntries;
  }

  /**
   * Optimize time distribution for a single day
   */
  private optimizeDailyTimeDistribution(entries: ScheduleEntry[]): ScheduleEntry[] {
    if (entries.length <= 1) {
      return entries;
    }

    const optimizedEntries: ScheduleEntry[] = [];
    const minBreakTime = 60; // 1 hour minimum break between lectures
    
    // Start with first entry
    optimizedEntries.push(entries[0]);
    
    for (let i = 1; i < entries.length; i++) {
      const prevEntry = optimizedEntries[optimizedEntries.length - 1];
      const currentEntry = entries[i];
      
      const prevEndTime = this.timeToMinutes(prevEntry.timeSlot.endTime);
      const currentStartTime = this.timeToMinutes(currentEntry.timeSlot.startTime);
      const gap = currentStartTime - prevEndTime;
      
      if (gap < minBreakTime) {
        // Try to reschedule current entry to maintain minimum break
        const newStartTime = prevEndTime + minBreakTime;
        const newEndTime = newStartTime + (
          this.timeToMinutes(currentEntry.timeSlot.endTime) - 
          this.timeToMinutes(currentEntry.timeSlot.startTime)
        );
        
        // Check if new time is within working hours (before 6 PM)
        if (newEndTime <= 18 * 60) {
          const adjustedEntry: ScheduleEntry = {
            ...currentEntry,
            timeSlot: {
              ...currentEntry.timeSlot,
              startTime: this.minutesToTime(newStartTime),
              endTime: this.minutesToTime(newEndTime)
            }
          };
          optimizedEntries.push(adjustedEntry);
        } else {
          // If can't fit, keep original time
          optimizedEntries.push(currentEntry);
        }
      } else {
        optimizedEntries.push(currentEntry);
      }
    }

    return optimizedEntries;
  }

  /**
   * Resolve faculty time conflicts with other faculty members
   */
  private resolveFacultyTimeConflicts(entries: ScheduleEntry[], fullSchedule: ScheduleEntry[]): ScheduleEntry[] {
    const conflictFreeEntries: ScheduleEntry[] = [];
    
    for (const entry of entries) {
      // Check for conflicts with other faculty members
      const hasConflict = fullSchedule.some(otherEntry => 
        otherEntry.facultyId !== entry.facultyId &&
        otherEntry.timeSlot.day === entry.timeSlot.day &&
        this.timeSlotOverlap(entry.timeSlot, otherEntry.timeSlot)
      );
      
      if (hasConflict) {
        // Try to find an alternative time slot
        const alternativeEntry = this.findAlternativeTimeSlot(entry, fullSchedule);
        conflictFreeEntries.push(alternativeEntry);
      } else {
        conflictFreeEntries.push(entry);
      }
    }

    return conflictFreeEntries;
  }

  /**
   * Check if two time slots overlap
   */
  private timeSlotOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
    const start1 = this.timeToMinutes(slot1.startTime);
    const end1 = this.timeToMinutes(slot1.endTime);
    const start2 = this.timeToMinutes(slot2.startTime);
    const end2 = this.timeToMinutes(slot2.endTime);

    return start1 < end2 && start2 < end1;
  }

  /**
   * Find an alternative time slot for a conflicting entry
   */
  private findAlternativeTimeSlot(entry: ScheduleEntry, fullSchedule: ScheduleEntry[]): ScheduleEntry {
    const workingDays = [
      DayOfWeek.MONDAY, 
      DayOfWeek.TUESDAY, 
      DayOfWeek.WEDNESDAY, 
      DayOfWeek.THURSDAY, 
      DayOfWeek.FRIDAY
    ];

    // Try different time slots
    for (const day of workingDays) {
      for (let hour = 8; hour < 17; hour++) {
        const startTime = `${hour.toString().padStart(2, '0')}:00`;
        const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;
        
        const testSlot: TimeSlot = {
          day,
          startTime,
          endTime,
          isAvailable: true
        };

        // Check if this slot conflicts with any existing entry
        const hasConflict = fullSchedule.some(otherEntry => 
          otherEntry.timeSlot.day === day &&
          this.timeSlotOverlap(testSlot, otherEntry.timeSlot)
        );

        if (!hasConflict) {
          return {
            ...entry,
            timeSlot: testSlot
          };
        }
      }
    }

    // If no alternative found, return original entry
    return entry;
  }

  /**
   * Prefer morning time slots
   */
  private preferMorningSlots(schedule: ScheduleEntry[]): ScheduleEntry[] {
    // Sort entries to prefer morning slots while maintaining constraints
    return schedule.sort((a, b) => {
      const timeA = this.timeToMinutes(a.timeSlot.startTime);
      const timeB = this.timeToMinutes(b.timeSlot.startTime);
      
      // Prefer earlier times
      return timeA - timeB;
    });
  }

  /**
   * Calculate distribution score (higher is better)
   */
  private calculateDistributionScore(schedule: ScheduleEntry[]): number {
    if (schedule.length === 0) return 1.0;

    // Group by subject
    const subjectGroups = new Map<string, ScheduleEntry[]>();
    schedule.forEach(entry => {
      const key = `${entry.batchId}_${entry.subjectId}`;
      if (!subjectGroups.has(key)) {
        subjectGroups.set(key, []);
      }
      subjectGroups.get(key)!.push(entry);
    });

    let totalDistributionScore = 0;
    let subjectCount = 0;

    subjectGroups.forEach((entries, key) => {
      if (entries.length <= 1) {
        totalDistributionScore += 1.0; // Perfect distribution for single lecture
      } else {
        // Calculate how evenly distributed the lectures are across days
        const dayDistribution = new Map<DayOfWeek, number>();
        entries.forEach(entry => {
          const count = dayDistribution.get(entry.timeSlot.day) || 0;
          dayDistribution.set(entry.timeSlot.day, count + 1);
        });

        // Calculate distribution evenness (lower variance is better)
        const counts = Array.from(dayDistribution.values());
        const mean = counts.reduce((sum, count) => sum + count, 0) / counts.length;
        const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length;
        
        // Convert to score (lower variance = higher score)
        const distributionScore = Math.max(0, 1 - variance / entries.length);
        totalDistributionScore += distributionScore;
      }
      subjectCount++;
    });

    return subjectCount > 0 ? totalDistributionScore / subjectCount : 1.0;
  }

  /**
   * Calculate gap score (higher is better, fewer gaps)
   */
  private calculateGapScore(schedule: ScheduleEntry[]): number {
    if (schedule.length === 0) return 1.0;

    // Group by batch and day
    const dayGroups = new Map<string, ScheduleEntry[]>();
    schedule.forEach(entry => {
      const key = `${entry.batchId}_${entry.timeSlot.day}`;
      if (!dayGroups.has(key)) {
        dayGroups.set(key, []);
      }
      dayGroups.get(key)!.push(entry);
    });

    let totalGapScore = 0;
    let dayCount = 0;

    dayGroups.forEach((entries, key) => {
      if (entries.length <= 1) {
        totalGapScore += 1.0; // No gaps possible
      } else {
        // Sort by time and calculate gaps
        const sortedEntries = entries.sort((a, b) => 
          this.timeToMinutes(a.timeSlot.startTime) - this.timeToMinutes(b.timeSlot.startTime)
        );

        let totalGapTime = 0;
        for (let i = 1; i < sortedEntries.length; i++) {
          const prevEnd = this.timeToMinutes(sortedEntries[i-1].timeSlot.endTime);
          const currentStart = this.timeToMinutes(sortedEntries[i].timeSlot.startTime);
          const gap = Math.max(0, currentStart - prevEnd);
          totalGapTime += gap;
        }

        // Convert to score (fewer gaps = higher score)
        const maxPossibleGap = 8 * 60 * (entries.length - 1); // 8 hours max gap per transition
        const gapScore = Math.max(0, 1 - totalGapTime / maxPossibleGap);
        totalGapScore += gapScore;
      }
      dayCount++;
    });

    return dayCount > 0 ? totalGapScore / dayCount : 1.0;
  }

  /**
   * Calculate faculty workload balance score
   */
  private calculateFacultyWorkloadScore(schedule: ScheduleEntry[]): number {
    if (schedule.length === 0) return 1.0;

    // Calculate daily workload for each faculty
    const facultyDailyLoad = new Map<string, Map<DayOfWeek, number>>();
    
    schedule.forEach(entry => {
      if (!facultyDailyLoad.has(entry.facultyId)) {
        facultyDailyLoad.set(entry.facultyId, new Map());
      }
      
      const dailyLoad = facultyDailyLoad.get(entry.facultyId)!;
      const currentLoad = dailyLoad.get(entry.timeSlot.day) || 0;
      dailyLoad.set(entry.timeSlot.day, currentLoad + 1);
    });

    let totalBalanceScore = 0;
    let facultyCount = 0;

    facultyDailyLoad.forEach((dailyLoad, facultyId) => {
      const loads = Array.from(dailyLoad.values());
      if (loads.length <= 1) {
        totalBalanceScore += 1.0;
      } else {
        // Calculate load variance (lower is better)
        const mean = loads.reduce((sum, load) => sum + load, 0) / loads.length;
        const variance = loads.reduce((sum, load) => sum + Math.pow(load - mean, 2), 0) / loads.length;
        
        // Convert to score
        const maxVariance = Math.pow(Math.max(...loads), 2);
        const balanceScore = Math.max(0, 1 - variance / maxVariance);
        totalBalanceScore += balanceScore;
      }
      facultyCount++;
    });

    return facultyCount > 0 ? totalBalanceScore / facultyCount : 1.0;
  }

  /**
   * Calculate time preference score
   */
  private calculateTimePreferenceScore(schedule: ScheduleEntry[]): number {
    if (schedule.length === 0) return 1.0;

    let totalScore = 0;
    
    schedule.forEach(entry => {
      const startMinutes = this.timeToMinutes(entry.timeSlot.startTime);
      
      // Prefer morning slots (8 AM = 480 minutes, 12 PM = 720 minutes)
      if (startMinutes >= 480 && startMinutes < 720) {
        totalScore += 1.0; // Morning slot
      } else if (startMinutes >= 720 && startMinutes < 960) {
        totalScore += 0.7; // Afternoon slot
      } else {
        totalScore += 0.3; // Evening slot
      }
    });

    return schedule.length > 0 ? totalScore / schedule.length : 1.0;
  }

  /**
   * Convert time string to minutes since midnight
   */
  private timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Get unique key for a time slot
   */
  private getSlotKey(slot: TimeSlot): string {
    return `${slot.day}_${slot.startTime}_${slot.endTime}`;
  }

  /**
   * Get optimization options
   */
  getOptions(): OptimizationOptions {
    return { ...this.options };
  }

  /**
   * Set optimization options
   */
  setOptions(options: Partial<OptimizationOptions>): void {
    this.options = { ...this.options, ...options };
  }
}
