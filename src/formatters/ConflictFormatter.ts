import { BaseScheduleFormatter, FormatterOptions } from './ScheduleFormatter';
import { WeeklySchedule } from '../models/WeeklySchedule';
import { ConstraintViolation } from '../models';

export class ConflictFormatter extends BaseScheduleFormatter {
  constructor(options: FormatterOptions = {}) {
    super(options);
  }

  format(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    
    lines.push('CONFLICT ANALYSIS REPORT');
    lines.push('='.repeat(30));
    lines.push('');

    if (schedule.conflicts.length === 0) {
      lines.push('✅ No conflicts detected in the schedule.');
      lines.push('The timetable is conflict-free and ready for use.');
      return lines.join('\n');
    }

    lines.push(this.formatConflictSummary(schedule));
    lines.push('');
    lines.push(this.formatConflictsByType(schedule));
    lines.push('');
    lines.push(this.formatConflictsBySeverity(schedule));
    lines.push('');
    lines.push(this.formatDetailedConflicts(schedule));

    if (this.options.includeStatistics) {
      lines.push('');
      lines.push(this.formatConflictStatistics(schedule));
    }

    return lines.join('\n');
  }

  formatConflictSummary(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    const errorConflicts = schedule.getConflictsBySeverity('error');
    const warningConflicts = schedule.getConflictsBySeverity('warning');
    
    lines.push('CONFLICT SUMMARY:');
    lines.push(`🚨 Critical Errors: ${errorConflicts.length}`);
    lines.push(`⚠️ Warnings: ${warningConflicts.length}`);
    lines.push(`📊 Total Conflicts: ${schedule.conflicts.length}`);
    
    // Calculate impact
    const affectedEntries = new Set<string>();
    schedule.conflicts.forEach(conflict => {
      conflict.affectedEntries.forEach(entry => {
        affectedEntries.add(`${entry.batchId}_${entry.subjectId}_${entry.timeSlot.day}_${entry.timeSlot.startTime}`);
      });
    });
    
    lines.push(`📍 Affected Entries: ${affectedEntries.size}`);
    
    if (schedule.entries.length > 0) {
      const impactPercentage = (affectedEntries.size / schedule.entries.length * 100).toFixed(1);
      lines.push(`📈 Impact: ${impactPercentage}% of schedule affected`);
    }

    return lines.join('\n');
  }

  formatConflictsByType(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    const conflictsByType = new Map<string, ConstraintViolation[]>();
    
    // Group conflicts by type
    schedule.conflicts.forEach(conflict => {
      if (!conflictsByType.has(conflict.type)) {
        conflictsByType.set(conflict.type, []);
      }
      conflictsByType.get(conflict.type)!.push(conflict);
    });

    lines.push('CONFLICTS BY TYPE:');
    lines.push('-'.repeat(20));

    if (conflictsByType.size === 0) {
      lines.push('No conflicts to categorize.');
    } else {
      // Sort by count (descending)
      const sortedTypes = Array.from(conflictsByType.entries())
        .sort(([,a], [,b]) => b.length - a.length);

      sortedTypes.forEach(([type, conflicts]) => {
        const errorCount = conflicts.filter(c => c.severity === 'error').length;
        const warningCount = conflicts.filter(c => c.severity === 'warning').length;
        
        lines.push(`${type.replace(/_/g, ' ').toUpperCase()}: ${conflicts.length}`);
        lines.push(`  🚨 Errors: ${errorCount}, ⚠️ Warnings: ${warningCount}`);
        
        // Show sample conflict
        if (conflicts.length > 0) {
          lines.push(`  Sample: ${conflicts[0].message}`);
        }
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  formatConflictsBySeverity(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    const errorConflicts = schedule.getConflictsBySeverity('error');
    const warningConflicts = schedule.getConflictsBySeverity('warning');

    lines.push('CONFLICTS BY SEVERITY:');
    lines.push('-'.repeat(20));

    if (errorConflicts.length > 0) {
      lines.push(`🚨 CRITICAL ERRORS (${errorConflicts.length}):`);
      lines.push('These conflicts must be resolved before the schedule can be used.');
      lines.push('');
      
      errorConflicts.forEach((conflict, index) => {
        lines.push(`  ${index + 1}. ${conflict.type}: ${conflict.message}`);
        lines.push(`     Affected: ${conflict.affectedEntries.length} entries`);
        
        // Show affected entries briefly
        if (conflict.affectedEntries.length > 0) {
          const entryDescriptions = conflict.affectedEntries.slice(0, 2).map(entry => 
            `${entry.batchId}/${entry.subjectId} (${entry.timeSlot.day} ${entry.timeSlot.startTime})`
          );
          lines.push(`     Entries: ${entryDescriptions.join(', ')}${conflict.affectedEntries.length > 2 ? '...' : ''}`);
        }
        lines.push('');
      });
    }

    if (warningConflicts.length > 0) {
      lines.push(`⚠️ WARNINGS (${warningConflicts.length}):`);
      lines.push('These issues should be reviewed but may not prevent schedule usage.');
      lines.push('');
      
      warningConflicts.forEach((conflict, index) => {
        lines.push(`  ${index + 1}. ${conflict.type}: ${conflict.message}`);
        lines.push(`     Affected: ${conflict.affectedEntries.length} entries`);
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  formatDetailedConflicts(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    
    lines.push('DETAILED CONFLICT ANALYSIS:');
    lines.push('-'.repeat(30));

    if (schedule.conflicts.length === 0) {
      lines.push('No detailed conflicts to analyze.');
      return lines.join('\n');
    }

    schedule.conflicts.forEach((conflict, index) => {
      lines.push(`${index + 1}. CONFLICT: ${conflict.type.replace(/_/g, ' ').toUpperCase()}`);
      lines.push(`   Severity: ${conflict.severity.toUpperCase()}`);
      lines.push(`   Message: ${conflict.message}`);
      lines.push(`   Affected Entries: ${conflict.affectedEntries.length}`);
      
      if (conflict.affectedEntries.length > 0) {
        lines.push('   Details:');
        conflict.affectedEntries.forEach((entry, entryIndex) => {
          lines.push(`     ${entryIndex + 1}. ${entry.batchId} - ${entry.subjectId}`);
          lines.push(`        Faculty: ${entry.facultyId}`);
          lines.push(`        Time: ${entry.timeSlot.day} ${entry.timeSlot.startTime} - ${entry.timeSlot.endTime}`);
        });
      }
      
      lines.push('');
    });

    return lines.join('\n');
  }

  formatConflictResolutionSuggestions(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    
    lines.push('CONFLICT RESOLUTION SUGGESTIONS:');
    lines.push('-'.repeat(35));

    if (schedule.conflicts.length === 0) {
      lines.push('No conflicts to resolve.');
      return lines.join('\n');
    }

    const conflictsByType = new Map<string, ConstraintViolation[]>();
    schedule.conflicts.forEach(conflict => {
      if (!conflictsByType.has(conflict.type)) {
        conflictsByType.set(conflict.type, []);
      }
      conflictsByType.get(conflict.type)!.push(conflict);
    });

    conflictsByType.forEach((conflicts, type) => {
      lines.push(`${type.replace(/_/g, ' ').toUpperCase()} (${conflicts.length} conflicts):`);
      lines.push(this.generateResolutionSuggestion(type, conflicts));
      lines.push('');
    });

    return lines.join('\n');
  }

  formatConflictImpactAnalysis(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    
    lines.push('CONFLICT IMPACT ANALYSIS:');
    lines.push('-'.repeat(25));

    if (schedule.conflicts.length === 0) {
      lines.push('No conflicts to analyze.');
      return lines.join('\n');
    }

    // Analyze impact by batch
    const batchImpact = new Map<string, number>();
    const facultyImpact = new Map<string, number>();
    const dayImpact = new Map<string, number>();

    schedule.conflicts.forEach(conflict => {
      conflict.affectedEntries.forEach(entry => {
        // Count batch impact
        const batchCount = batchImpact.get(entry.batchId) || 0;
        batchImpact.set(entry.batchId, batchCount + 1);

        // Count faculty impact
        const facultyCount = facultyImpact.get(entry.facultyId) || 0;
        facultyImpact.set(entry.facultyId, facultyCount + 1);

        // Count day impact
        const dayCount = dayImpact.get(entry.timeSlot.day) || 0;
        dayImpact.set(entry.timeSlot.day, dayCount + 1);
      });
    });

    // Most affected batches
    if (batchImpact.size > 0) {
      lines.push('Most Affected Batches:');
      const sortedBatches = Array.from(batchImpact.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
      
      sortedBatches.forEach(([batch, count]) => {
        lines.push(`  ${batch}: ${count} conflicts`);
      });
      lines.push('');
    }

    // Most affected faculty
    if (facultyImpact.size > 0) {
      lines.push('Most Affected Faculty:');
      const sortedFaculty = Array.from(facultyImpact.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
      
      sortedFaculty.forEach(([faculty, count]) => {
        lines.push(`  ${faculty}: ${count} conflicts`);
      });
      lines.push('');
    }

    // Most problematic days
    if (dayImpact.size > 0) {
      lines.push('Most Problematic Days:');
      const sortedDays = Array.from(dayImpact.entries())
        .sort(([,a], [,b]) => b - a);
      
      sortedDays.forEach(([day, count]) => {
        lines.push(`  ${day}: ${count} conflicts`);
      });
    }

    return lines.join('\n');
  }

  private formatConflictStatistics(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    
    lines.push('CONFLICT STATISTICS:');
    lines.push('-'.repeat(20));

    const totalEntries = schedule.entries.length;
    const totalConflicts = schedule.conflicts.length;
    
    if (totalEntries === 0) {
      lines.push('No entries to analyze.');
      return lines.join('\n');
    }

    const conflictRate = (totalConflicts / totalEntries * 100).toFixed(2);
    lines.push(`Conflict Rate: ${conflictRate}% (${totalConflicts}/${totalEntries})`);

    // Severity distribution
    const errorConflicts = schedule.getConflictsBySeverity('error').length;
    const warningConflicts = schedule.getConflictsBySeverity('warning').length;
    
    if (totalConflicts > 0) {
      const errorPercentage = (errorConflicts / totalConflicts * 100).toFixed(1);
      const warningPercentage = (warningConflicts / totalConflicts * 100).toFixed(1);
      
      lines.push(`Error Rate: ${errorPercentage}% (${errorConflicts}/${totalConflicts})`);
      lines.push(`Warning Rate: ${warningPercentage}% (${warningConflicts}/${totalConflicts})`);
    }

    // Resolution priority
    lines.push('');
    lines.push('Resolution Priority:');
    if (errorConflicts > 0) {
      lines.push(`  1. Resolve ${errorConflicts} critical errors first`);
    }
    if (warningConflicts > 0) {
      lines.push(`  2. Review ${warningConflicts} warnings`);
    }
    if (totalConflicts === 0) {
      lines.push('  ✅ No conflicts to resolve');
    }

    return lines.join('\n');
  }

  private generateResolutionSuggestion(type: string, conflicts: ConstraintViolation[]): string {
    const lines: string[] = [];
    
    switch (type.toLowerCase()) {
      case 'faculty_double_booking':
      case 'faculty_conflict':
        lines.push('  💡 Suggestions:');
        lines.push('     - Reschedule one of the conflicting lectures');
        lines.push('     - Assign a different faculty member if possible');
        lines.push('     - Split the lecture into multiple sessions');
        break;
        
      case 'time_slot_overlap':
      case 'batch_conflict':
        lines.push('  💡 Suggestions:');
        lines.push('     - Move one lecture to a different time slot');
        lines.push('     - Reschedule to a different day');
        lines.push('     - Check if lectures can be combined');
        break;
        
      case 'holiday_conflict':
        lines.push('  💡 Suggestions:');
        lines.push('     - Reschedule all holiday lectures to working days');
        lines.push('     - Distribute lectures across the week');
        lines.push('     - Consider makeup sessions');
        break;
        
      case 'batch_overload':
        lines.push('  💡 Suggestions:');
        lines.push('     - Distribute lectures more evenly across days');
        lines.push('     - Move some lectures to less loaded days');
        lines.push('     - Consider extending the schedule to more days');
        break;
        
      default:
        lines.push('  💡 General Suggestions:');
        lines.push('     - Review the conflicting entries manually');
        lines.push('     - Consider adjusting constraints if appropriate');
        lines.push('     - Use the manual adjustment tools');
        break;
    }
    
    lines.push(`  📊 Priority: ${conflicts.filter(c => c.severity === 'error').length > 0 ? 'HIGH' : 'MEDIUM'}`);
    
    return lines.join('\n');
  }
}
