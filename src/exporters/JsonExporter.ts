import { BaseExporter, ExportResult, ExportFormat } from './ExportInterfaces';
import { WeeklySchedule } from '../models/WeeklySchedule';
import { ScheduleEntry, ConstraintViolation } from '../models';

interface JsonScheduleExport {
  metadata: {
    exportedAt: string;
    format: string;
    version: string;
    generator: string;
    schedule: {
      generatedAt: string;
      totalLectures: number;
      batchCount: number;
      facultyCount?: number;
      subjectCount?: number;
      optimizationScore?: number;
      generationTimeMs?: number;
    };
  };
  entries: JsonScheduleEntry[];
  conflicts?: JsonConflict[];
  statistics?: JsonStatistics;
  summary: {
    totalEntries: number;
    totalBatches: number;
    totalFaculties: number;
    totalSubjects: number;
    totalConflicts: number;
  };
}

interface JsonScheduleEntry {
  id: string;
  batch: {
    id: string;
    name?: string;
  };
  subject: {
    id: string;
    name?: string;
  };
  faculty: {
    id: string;
    name?: string;
  };
  timeSlot: {
    day: string;
    startTime: string;
    endTime: string;
    duration: number;
    formattedTime?: string;
  };
  metadata?: {
    isConflicting?: boolean;
    conflictTypes?: string[];
  };
}

interface JsonConflict {
  id: string;
  type: string;
  severity: string;
  message: string;
  affectedEntries: {
    count: number;
    entries: string[]; // Entry IDs
  };
  affectedResources: {
    batches: string[];
    faculties: string[];
    subjects: string[];
  };
}

interface JsonStatistics {
  overview: {
    totalEntries: number;
    utilizationRate: number;
    averageEntriesPerDay: number;
    distributionQuality: string;
  };
  dailyDistribution: {
    [day: string]: {
      count: number;
      percentage: number;
    };
  };
  batchDistribution: {
    [batch: string]: {
      count: number;
      percentage: number;
    };
  };
  facultyDistribution: {
    [faculty: string]: {
      count: number;
      percentage: number;
    };
  };
  timeSlotAnalysis: {
    totalSlots: number;
    occupiedSlots: number;
    utilizationRate: number;
    peakHours: string[];
  };
  loadDistribution: {
    average: number;
    maximum: number;
    minimum: number;
    standardDeviation: number;
  };
}

export class JsonExporter extends BaseExporter {
  async export(schedule: WeeklySchedule): Promise<ExportResult> {
    const startTime = Date.now();
    
    try {
      const filteredEntries = this.filterEntries(schedule.entries);
      const sortedEntries = this.sortEntries(filteredEntries);
      
      const jsonData: JsonScheduleExport = {
        metadata: this.generateMetadata(schedule),
        entries: this.generateEntries(sortedEntries, schedule),
        summary: this.generateSummary(schedule)
      };

      // Add optional sections
      if (this.options.includeConflicts && schedule.conflicts.length > 0) {
        jsonData.conflicts = this.generateConflicts(schedule.conflicts, sortedEntries);
      }

      if (this.options.includeStatistics) {
        jsonData.statistics = this.generateStatistics(schedule);
      }

      const jsonString = this.options.pretty 
        ? JSON.stringify(jsonData, null, 2)
        : JSON.stringify(jsonData);

      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        data: jsonString,
        filename: this.options.filename,
        mimeType: 'application/json',
        size: Buffer.byteLength(jsonString, this.options.encoding),
        metadata: {
          exportedAt: new Date(),
          format: ExportFormat.JSON,
          entriesCount: sortedEntries.length,
          processingTimeMs: processingTime
        }
      };
    } catch (error) {
      return {
        success: false,
        filename: this.options.filename,
        mimeType: 'application/json',
        size: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: {
          exportedAt: new Date(),
          format: ExportFormat.JSON,
          entriesCount: 0,
          processingTimeMs: Date.now() - startTime
        }
      };
    }
  }

  private generateMetadata(schedule: WeeklySchedule) {
    return {
      exportedAt: new Date().toISOString(),
      format: 'timetable-json',
      version: '1.0.0',
      generator: 'Automated Timetable Generator',
      schedule: {
        generatedAt: schedule.metadata.generatedAt.toISOString(),
        totalLectures: schedule.metadata.totalLectures,
        batchCount: schedule.metadata.batchCount,
        facultyCount: schedule.metadata.facultyCount,
        subjectCount: schedule.metadata.subjectCount,
        optimizationScore: schedule.metadata.optimizationScore,
        generationTimeMs: schedule.metadata.generationTimeMs
      }
    };
  }

  private generateEntries(entries: ScheduleEntry[], schedule: WeeklySchedule): JsonScheduleEntry[] {
    return entries.map((entry, index) => {
      const duration = this.calculateDuration(entry.timeSlot.startTime, entry.timeSlot.endTime);
      const isConflicting = this.isEntryConflicting(entry, schedule);
      const conflictTypes = this.getEntryConflictTypes(entry, schedule);

      const jsonEntry: JsonScheduleEntry = {
        id: `entry_${index + 1}`,
        batch: {
          id: entry.batchId
        },
        subject: {
          id: entry.subjectId
        },
        faculty: {
          id: entry.facultyId
        },
        timeSlot: {
          day: entry.timeSlot.day,
          startTime: entry.timeSlot.startTime,
          endTime: entry.timeSlot.endTime,
          duration,
          formattedTime: `${this.formatTime(entry.timeSlot.startTime)} - ${this.formatTime(entry.timeSlot.endTime)}`
        }
      };

      // Add metadata if there are conflicts or other relevant information
      if (isConflicting || conflictTypes.length > 0) {
        jsonEntry.metadata = {
          isConflicting,
          conflictTypes
        };
      }

      return jsonEntry;
    });
  }

  private generateConflicts(conflicts: ConstraintViolation[], entries: ScheduleEntry[]): JsonConflict[] {
    return conflicts.map((conflict, index) => {
      const affectedBatches = [...new Set(conflict.affectedEntries.map(e => e.batchId))];
      const affectedFaculties = [...new Set(conflict.affectedEntries.map(e => e.facultyId))];
      const affectedSubjects = [...new Set(conflict.affectedEntries.map(e => e.subjectId))];
      
      // Find entry IDs for affected entries
      const affectedEntryIds = conflict.affectedEntries.map(affectedEntry => {
        const entryIndex = entries.findIndex(entry => 
          entry.batchId === affectedEntry.batchId &&
          entry.subjectId === affectedEntry.subjectId &&
          entry.facultyId === affectedEntry.facultyId &&
          entry.timeSlot.day === affectedEntry.timeSlot.day &&
          entry.timeSlot.startTime === affectedEntry.timeSlot.startTime
        );
        return entryIndex !== -1 ? `entry_${entryIndex + 1}` : `unknown_${index}`;
      });

      return {
        id: `conflict_${index + 1}`,
        type: conflict.type,
        severity: conflict.severity,
        message: conflict.message,
        affectedEntries: {
          count: conflict.affectedEntries.length,
          entries: affectedEntryIds
        },
        affectedResources: {
          batches: affectedBatches,
          faculties: affectedFaculties,
          subjects: affectedSubjects
        }
      };
    });
  }

  private generateStatistics(schedule: WeeklySchedule): JsonStatistics {
    const stats = schedule.calculateStatistics();
    
    // Daily distribution
    const dailyDistribution: { [day: string]: { count: number; percentage: number } } = {};
    stats.entriesPerDay.forEach((count, day) => {
      const percentage = stats.totalEntries > 0 ? (count / stats.totalEntries * 100) : 0;
      dailyDistribution[day] = {
        count,
        percentage: Math.round(percentage * 10) / 10
      };
    });

    // Batch distribution
    const batchDistribution: { [batch: string]: { count: number; percentage: number } } = {};
    stats.entriesPerBatch.forEach((count, batch) => {
      const percentage = stats.totalEntries > 0 ? (count / stats.totalEntries * 100) : 0;
      batchDistribution[batch] = {
        count,
        percentage: Math.round(percentage * 10) / 10
      };
    });

    // Faculty distribution
    const facultyDistribution: { [faculty: string]: { count: number; percentage: number } } = {};
    stats.entriesPerFaculty.forEach((count, faculty) => {
      const percentage = stats.totalEntries > 0 ? (count / stats.totalEntries * 100) : 0;
      facultyDistribution[faculty] = {
        count,
        percentage: Math.round(percentage * 10) / 10
      };
    });

    // Peak hours analysis
    const hourlyUsage = new Map<string, number>();
    schedule.entries.forEach(entry => {
      const hour = entry.timeSlot.startTime.split(':')[0];
      const count = hourlyUsage.get(hour) || 0;
      hourlyUsage.set(hour, count + 1);
    });

    const peakHours = Array.from(hourlyUsage.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => `${hour}:00`);

    return {
      overview: {
        totalEntries: stats.totalEntries,
        utilizationRate: stats.timeSlotUtilization.utilizationRate,
        averageEntriesPerDay: stats.dailyLoadDistribution.averageEntriesPerDay,
        distributionQuality: this.assessDistributionQuality(stats.dailyLoadDistribution.standardDeviation, stats.dailyLoadDistribution.averageEntriesPerDay)
      },
      dailyDistribution,
      batchDistribution,
      facultyDistribution,
      timeSlotAnalysis: {
        totalSlots: stats.timeSlotUtilization.totalSlots,
        occupiedSlots: stats.timeSlotUtilization.occupiedSlots,
        utilizationRate: stats.timeSlotUtilization.utilizationRate,
        peakHours
      },
      loadDistribution: {
        average: stats.dailyLoadDistribution.averageEntriesPerDay,
        maximum: stats.dailyLoadDistribution.maxEntriesPerDay,
        minimum: stats.dailyLoadDistribution.minEntriesPerDay,
        standardDeviation: stats.dailyLoadDistribution.standardDeviation
      }
    };
  }

  private generateSummary(schedule: WeeklySchedule) {
    const summary = schedule.getSummary();
    return {
      totalEntries: summary.totalLectures,
      totalBatches: summary.totalBatches,
      totalFaculties: summary.totalFaculties,
      totalSubjects: summary.totalSubjects,
      totalConflicts: summary.totalConflicts
    };
  }

  private calculateDuration(startTime: string, endTime: string): number {
    const start = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);
    return end - start;
  }

  private timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private isEntryConflicting(entry: ScheduleEntry, schedule: WeeklySchedule): boolean {
    return schedule.conflicts.some(conflict => 
      conflict.affectedEntries.some(affectedEntry => 
        affectedEntry.batchId === entry.batchId &&
        affectedEntry.subjectId === entry.subjectId &&
        affectedEntry.facultyId === entry.facultyId &&
        affectedEntry.timeSlot.day === entry.timeSlot.day &&
        affectedEntry.timeSlot.startTime === entry.timeSlot.startTime
      )
    );
  }

  private getEntryConflictTypes(entry: ScheduleEntry, schedule: WeeklySchedule): string[] {
    const conflictTypes: string[] = [];
    
    schedule.conflicts.forEach(conflict => {
      const isAffected = conflict.affectedEntries.some(affectedEntry => 
        affectedEntry.batchId === entry.batchId &&
        affectedEntry.subjectId === entry.subjectId &&
        affectedEntry.facultyId === entry.facultyId &&
        affectedEntry.timeSlot.day === entry.timeSlot.day &&
        affectedEntry.timeSlot.startTime === entry.timeSlot.startTime
      );
      
      if (isAffected && !conflictTypes.includes(conflict.type)) {
        conflictTypes.push(conflict.type);
      }
    });

    return conflictTypes;
  }

  private assessDistributionQuality(standardDeviation: number, average: number): string {
    if (average === 0) return 'N/A';
    
    const cv = standardDeviation / average;
    
    if (cv < 0.2) return 'Excellent';
    if (cv < 0.4) return 'Good';
    if (cv < 0.6) return 'Fair';
    return 'Poor';
  }

  /**
   * Export schedule in a structured format optimized for API consumption
   */
  exportApiFormat(schedule: WeeklySchedule): Promise<ExportResult> {
    const startTime = Date.now();
    
    try {
      const filteredEntries = this.filterEntries(schedule.entries);
      
      const apiData = {
        success: true,
        data: {
          schedule: {
            id: `schedule_${Date.now()}`,
            metadata: {
              generatedAt: schedule.metadata.generatedAt.toISOString(),
              totalLectures: schedule.metadata.totalLectures,
              batchCount: schedule.metadata.batchCount
            },
            entries: filteredEntries.map((entry, index) => ({
              id: `entry_${index + 1}`,
              batchId: entry.batchId,
              subjectId: entry.subjectId,
              facultyId: entry.facultyId,
              day: entry.timeSlot.day,
              startTime: entry.timeSlot.startTime,
              endTime: entry.timeSlot.endTime,
              duration: this.calculateDuration(entry.timeSlot.startTime, entry.timeSlot.endTime)
            })),
            conflicts: schedule.conflicts.map((conflict, index) => ({
              id: `conflict_${index + 1}`,
              type: conflict.type,
              severity: conflict.severity,
              message: conflict.message,
              affectedCount: conflict.affectedEntries.length
            }))
          }
        },
        meta: {
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
          count: filteredEntries.length
        }
      };

      const jsonString = this.options.pretty 
        ? JSON.stringify(apiData, null, 2)
        : JSON.stringify(apiData);

      const processingTime = Date.now() - startTime;
      
      return Promise.resolve({
        success: true,
        data: jsonString,
        filename: this.options.filename.replace('.json', '_api.json'),
        mimeType: 'application/json',
        size: Buffer.byteLength(jsonString, this.options.encoding),
        metadata: {
          exportedAt: new Date(),
          format: ExportFormat.JSON,
          entriesCount: filteredEntries.length,
          processingTimeMs: processingTime
        }
      });
    } catch (error) {
      return Promise.resolve({
        success: false,
        filename: this.options.filename,
        mimeType: 'application/json',
        size: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: {
          exportedAt: new Date(),
          format: ExportFormat.JSON,
          entriesCount: 0,
          processingTimeMs: Date.now() - startTime
        }
      });
    }
  }
}
