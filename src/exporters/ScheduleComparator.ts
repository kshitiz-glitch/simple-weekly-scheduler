import { 
  ScheduleComparisonExporter, 
  ComparisonOptions, 
  ComparisonResult, 
  ExportOptions, 
  ExportResult,
  ExportFormat 
} from './ExportInterfaces';
import { WeeklySchedule } from '../models/WeeklySchedule';
import { ScheduleEntry } from '../models';

export class ScheduleComparator implements ScheduleComparisonExporter {
  
  async compareSchedules(options: ComparisonOptions): Promise<ComparisonResult> {
    const { scheduleA, scheduleB, labelA = 'Schedule A', labelB = 'Schedule B' } = options;
    
    // Find differences in entries
    const entryDifferences = this.compareEntries(scheduleA.entries, scheduleB.entries);
    
    // Find differences in conflicts
    const conflictChanges = this.compareConflicts(scheduleA.conflicts, scheduleB.conflicts);
    
    // Calculate similarity score
    const similarityScore = this.calculateSimilarityScore(scheduleA, scheduleB, entryDifferences);
    
    // Categorize changes
    const { majorChanges, minorChanges } = this.categorizeChanges(entryDifferences);
    
    // Generate comparison report
    const report = this.generateComparisonReport(
      entryDifferences, 
      conflictChanges, 
      similarityScore, 
      labelA, 
      labelB,
      options
    );

    return {
      differences: {
        addedEntries: entryDifferences.added,
        removedEntries: entryDifferences.removed,
        modifiedEntries: entryDifferences.modified,
        conflictChanges
      },
      summary: {
        totalDifferences: entryDifferences.added.length + entryDifferences.removed.length + entryDifferences.modified.length,
        similarityScore,
        majorChanges,
        minorChanges
      },
      report
    };
  }

  async exportComparison(comparison: ComparisonResult, exportOptions: ExportOptions): Promise<ExportResult> {
    const startTime = Date.now();
    
    try {
      let exportData: string;
      let mimeType: string;

      switch (exportOptions.format) {
        case ExportFormat.JSON:
          exportData = JSON.stringify(comparison, null, exportOptions.pretty ? 2 : 0);
          mimeType = 'application/json';
          break;
        case ExportFormat.HTML:
          exportData = this.generateHtmlComparison(comparison);
          mimeType = 'text/html';
          break;
        case ExportFormat.CSV:
          exportData = this.generateCsvComparison(comparison);
          mimeType = 'text/csv';
          break;
        case ExportFormat.TEXT:
        default:
          exportData = comparison.report;
          mimeType = 'text/plain';
          break;
      }

      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        data: exportData,
        filename: exportOptions.filename || `schedule_comparison.${exportOptions.format}`,
        mimeType,
        size: Buffer.byteLength(exportData, exportOptions.encoding || 'utf8'),
        metadata: {
          exportedAt: new Date(),
          format: exportOptions.format,
          entriesCount: comparison.summary.totalDifferences,
          processingTimeMs: processingTime
        }
      };
    } catch (error) {
      return {
        success: false,
        filename: exportOptions.filename || `schedule_comparison.${exportOptions.format}`,
        mimeType: 'text/plain',
        size: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: {
          exportedAt: new Date(),
          format: exportOptions.format,
          entriesCount: 0,
          processingTimeMs: Date.now() - startTime
        }
      };
    }
  }

  private compareEntries(entriesA: ScheduleEntry[], entriesB: ScheduleEntry[]): {
    added: ScheduleEntry[];
    removed: ScheduleEntry[];
    modified: {
      original: ScheduleEntry;
      modified: ScheduleEntry;
      changes: string[];
    }[];
  } {
    const added: ScheduleEntry[] = [];
    const removed: ScheduleEntry[] = [];
    const modified: {
      original: ScheduleEntry;
      modified: ScheduleEntry;
      changes: string[];
    }[] = [];

    // Create maps for efficient lookup
    const mapA = new Map<string, ScheduleEntry>();
    const mapB = new Map<string, ScheduleEntry>();

    entriesA.forEach(entry => {
      const key = this.getEntryKey(entry);
      mapA.set(key, entry);
    });

    entriesB.forEach(entry => {
      const key = this.getEntryKey(entry);
      mapB.set(key, entry);
    });

    // Find added entries (in B but not in A)
    mapB.forEach((entryB, key) => {
      if (!mapA.has(key)) {
        added.push(entryB);
      }
    });

    // Find removed entries (in A but not in B)
    mapA.forEach((entryA, key) => {
      if (!mapB.has(key)) {
        removed.push(entryA);
      }
    });

    // Find modified entries (different content for same key)
    mapA.forEach((entryA, key) => {
      const entryB = mapB.get(key);
      if (entryB) {
        const changes = this.findEntryChanges(entryA, entryB);
        if (changes.length > 0) {
          modified.push({
            original: entryA,
            modified: entryB,
            changes
          });
        }
      }
    });

    return { added, removed, modified };
  }

  private compareConflicts(conflictsA: any[], conflictsB: any[]): {
    added: number;
    removed: number;
    modified: number;
  } {
    const countA = conflictsA.length;
    const countB = conflictsB.length;

    // Simple comparison based on count and types
    const typesA = new Set(conflictsA.map(c => c.type));
    const typesB = new Set(conflictsB.map(c => c.type));

    const addedTypes = [...typesB].filter(type => !typesA.has(type));
    const removedTypes = [...typesA].filter(type => !typesB.has(type));

    return {
      added: Math.max(0, countB - countA),
      removed: Math.max(0, countA - countB),
      modified: addedTypes.length + removedTypes.length
    };
  }

  private calculateSimilarityScore(
    scheduleA: WeeklySchedule, 
    scheduleB: WeeklySchedule, 
    differences: any
  ): number {
    const totalEntriesA = scheduleA.entries.length;
    const totalEntriesB = scheduleB.entries.length;
    const maxEntries = Math.max(totalEntriesA, totalEntriesB);

    if (maxEntries === 0) {
      return 1.0; // Both schedules are empty
    }

    const totalDifferences = differences.added.length + differences.removed.length + differences.modified.length;
    const similarity = Math.max(0, 1 - (totalDifferences / maxEntries));

    return Math.round(similarity * 1000) / 1000; // Round to 3 decimal places
  }

  private categorizeChanges(differences: any): { majorChanges: number; minorChanges: number } {
    let majorChanges = 0;
    let minorChanges = 0;

    // Added and removed entries are major changes
    majorChanges += differences.added.length + differences.removed.length;

    // Categorize modified entries
    differences.modified.forEach((mod: any) => {
      const hasMajorChange = mod.changes.some((change: string) => 
        change.includes('day') || change.includes('time') || change.includes('faculty')
      );
      
      if (hasMajorChange) {
        majorChanges++;
      } else {
        minorChanges++;
      }
    });

    return { majorChanges, minorChanges };
  }

  private generateComparisonReport(
    differences: any,
    conflictChanges: any,
    similarityScore: number,
    labelA: string,
    labelB: string,
    options: ComparisonOptions
  ): string {
    const lines: string[] = [];
    
    lines.push('SCHEDULE COMPARISON REPORT');
    lines.push('='.repeat(40));
    lines.push('');
    lines.push(`Comparing: ${labelA} vs ${labelB}`);
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push(`Similarity Score: ${(similarityScore * 100).toFixed(1)}%`);
    lines.push('');

    // Summary
    lines.push('SUMMARY:');
    lines.push(`Added Entries: ${differences.added.length}`);
    lines.push(`Removed Entries: ${differences.removed.length}`);
    lines.push(`Modified Entries: ${differences.modified.length}`);
    lines.push(`Total Differences: ${differences.added.length + differences.removed.length + differences.modified.length}`);
    lines.push('');

    // Conflict changes
    if (conflictChanges.added > 0 || conflictChanges.removed > 0 || conflictChanges.modified > 0) {
      lines.push('CONFLICT CHANGES:');
      lines.push(`Added Conflicts: ${conflictChanges.added}`);
      lines.push(`Removed Conflicts: ${conflictChanges.removed}`);
      lines.push(`Modified Conflicts: ${conflictChanges.modified}`);
      lines.push('');
    }

    // Detailed differences
    if (!options.showOnlyDifferences || differences.added.length > 0) {
      lines.push('ADDED ENTRIES:');
      if (differences.added.length === 0) {
        lines.push('None');
      } else {
        differences.added.forEach((entry: ScheduleEntry, index: number) => {
          lines.push(`${index + 1}. ${entry.subjectId} - ${entry.batchId} (${entry.timeSlot.day} ${entry.timeSlot.startTime})`);
        });
      }
      lines.push('');
    }

    if (!options.showOnlyDifferences || differences.removed.length > 0) {
      lines.push('REMOVED ENTRIES:');
      if (differences.removed.length === 0) {
        lines.push('None');
      } else {
        differences.removed.forEach((entry: ScheduleEntry, index: number) => {
          lines.push(`${index + 1}. ${entry.subjectId} - ${entry.batchId} (${entry.timeSlot.day} ${entry.timeSlot.startTime})`);
        });
      }
      lines.push('');
    }

    if (!options.showOnlyDifferences || differences.modified.length > 0) {
      lines.push('MODIFIED ENTRIES:');
      if (differences.modified.length === 0) {
        lines.push('None');
      } else {
        differences.modified.forEach((mod: any, index: number) => {
          lines.push(`${index + 1}. ${mod.original.subjectId} - ${mod.original.batchId}`);
          lines.push(`   Changes: ${mod.changes.join(', ')}`);
        });
      }
      lines.push('');
    }

    // Assessment
    lines.push('ASSESSMENT:');
    if (similarityScore >= 0.9) {
      lines.push('✅ Schedules are very similar with minimal differences');
    } else if (similarityScore >= 0.7) {
      lines.push('⚠️ Schedules have moderate differences');
    } else if (similarityScore >= 0.5) {
      lines.push('🔄 Schedules have significant differences');
    } else {
      lines.push('❌ Schedules are substantially different');
    }

    return lines.join('\n');
  }

  private generateHtmlComparison(comparison: ComparisonResult): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Schedule Comparison Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .section { margin-bottom: 30px; }
        .section h3 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        .added { color: #27ae60; }
        .removed { color: #e74c3c; }
        .modified { color: #f39c12; }
        .similarity-score { font-size: 24px; font-weight: bold; color: #3498db; }
        .entry-item { background: #fff; border: 1px solid #ddd; padding: 10px; margin: 5px 0; border-radius: 4px; }
        .changes { font-style: italic; color: #7f8c8d; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Schedule Comparison Report</h1>
        <div class="similarity-score">Similarity: ${(comparison.summary.similarityScore * 100).toFixed(1)}%</div>
    </div>
    
    <div class="summary">
        <h3>Summary</h3>
        <p><strong>Total Differences:</strong> ${comparison.summary.totalDifferences}</p>
        <p><strong>Major Changes:</strong> ${comparison.summary.majorChanges}</p>
        <p><strong>Minor Changes:</strong> ${comparison.summary.minorChanges}</p>
    </div>
    
    <div class="section">
        <h3 class="added">Added Entries (${comparison.differences.addedEntries.length})</h3>
        ${comparison.differences.addedEntries.map(entry => `
            <div class="entry-item added">
                ${entry.subjectId} - ${entry.batchId} (${entry.timeSlot.day} ${entry.timeSlot.startTime})
            </div>
        `).join('')}
    </div>
    
    <div class="section">
        <h3 class="removed">Removed Entries (${comparison.differences.removedEntries.length})</h3>
        ${comparison.differences.removedEntries.map(entry => `
            <div class="entry-item removed">
                ${entry.subjectId} - ${entry.batchId} (${entry.timeSlot.day} ${entry.timeSlot.startTime})
            </div>
        `).join('')}
    </div>
    
    <div class="section">
        <h3 class="modified">Modified Entries (${comparison.differences.modifiedEntries.length})</h3>
        ${comparison.differences.modifiedEntries.map(mod => `
            <div class="entry-item modified">
                <strong>${mod.original.subjectId} - ${mod.original.batchId}</strong>
                <div class="changes">Changes: ${mod.changes.join(', ')}</div>
            </div>
        `).join('')}
    </div>
</body>
</html>`;
  }

  private generateCsvComparison(comparison: ComparisonResult): string {
    const lines: string[] = [];
    
    // Header
    lines.push('Type,Subject,Batch,Faculty,Day,Start Time,End Time,Changes');
    
    // Added entries
    comparison.differences.addedEntries.forEach(entry => {
      lines.push(`Added,${entry.subjectId},${entry.batchId},${entry.facultyId},${entry.timeSlot.day},${entry.timeSlot.startTime},${entry.timeSlot.endTime},`);
    });
    
    // Removed entries
    comparison.differences.removedEntries.forEach(entry => {
      lines.push(`Removed,${entry.subjectId},${entry.batchId},${entry.facultyId},${entry.timeSlot.day},${entry.timeSlot.startTime},${entry.timeSlot.endTime},`);
    });
    
    // Modified entries
    comparison.differences.modifiedEntries.forEach(mod => {
      lines.push(`Modified,${mod.original.subjectId},${mod.original.batchId},${mod.original.facultyId},${mod.original.timeSlot.day},${mod.original.timeSlot.startTime},${mod.original.timeSlot.endTime},"${mod.changes.join('; ')}"`);
    });
    
    return lines.join('\n');
  }

  private getEntryKey(entry: ScheduleEntry): string {
    return `${entry.batchId}_${entry.subjectId}_${entry.timeSlot.day}_${entry.timeSlot.startTime}`;
  }

  private findEntryChanges(entryA: ScheduleEntry, entryB: ScheduleEntry): string[] {
    const changes: string[] = [];

    if (entryA.facultyId !== entryB.facultyId) {
      changes.push(`faculty: ${entryA.facultyId} → ${entryB.facultyId}`);
    }

    if (entryA.timeSlot.day !== entryB.timeSlot.day) {
      changes.push(`day: ${entryA.timeSlot.day} → ${entryB.timeSlot.day}`);
    }

    if (entryA.timeSlot.startTime !== entryB.timeSlot.startTime) {
      changes.push(`start time: ${entryA.timeSlot.startTime} → ${entryB.timeSlot.startTime}`);
    }

    if (entryA.timeSlot.endTime !== entryB.timeSlot.endTime) {
      changes.push(`end time: ${entryA.timeSlot.endTime} → ${entryB.timeSlot.endTime}`);
    }

    return changes;
  }
}
