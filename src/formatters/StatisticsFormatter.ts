import { BaseScheduleFormatter, FormatterOptions } from './ScheduleFormatter';
import { WeeklySchedule } from '../models/WeeklySchedule';
import { DayOfWeek } from '../models';

export class StatisticsFormatter extends BaseScheduleFormatter {
  constructor(options: FormatterOptions = {}) {
    super(options);
  }

  format(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    
    lines.push('SCHEDULE STATISTICS REPORT');
    lines.push('='.repeat(35));
    lines.push('');

    lines.push(this.formatOverallStatistics(schedule));
    lines.push('');
    lines.push(this.formatDistributionAnalysis(schedule));
    lines.push('');
    lines.push(this.formatUtilizationAnalysis(schedule));
    lines.push('');
    lines.push(this.formatWorkloadAnalysis(schedule));
    lines.push('');
    lines.push(this.formatEfficiencyMetrics(schedule));

    return lines.join('\n');
  }

  formatOverallStatistics(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    const summary = schedule.getSummary();
    const stats = schedule.calculateStatistics();
    
    lines.push('📊 OVERALL STATISTICS:');
    lines.push('-'.repeat(25));
    lines.push(`📚 Total Lectures: ${summary.totalLectures}`);
    lines.push(`🎓 Total Batches: ${summary.totalBatches}`);
    lines.push(`👨‍🏫 Total Faculty: ${summary.totalFaculties}`);
    lines.push(`📖 Total Subjects: ${summary.totalSubjects}`);
    lines.push(`⚠️ Total Conflicts: ${summary.totalConflicts}`);
    
    if (summary.totalConflicts > 0) {
      lines.push(`   🚨 Errors: ${summary.errorConflicts}`);
      lines.push(`   ⚠️ Warnings: ${summary.warningConflicts}`);
    }

    // Schedule health score
    const healthScore = this.calculateScheduleHealthScore(schedule);
    lines.push(`💚 Schedule Health: ${healthScore.toFixed(1)}%`);

    return lines.join('\n');
  }

  formatDistributionAnalysis(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    const stats = schedule.calculateStatistics();
    
    lines.push('📈 DISTRIBUTION ANALYSIS:');
    lines.push('-'.repeat(25));

    // Daily distribution
    lines.push('Daily Lecture Distribution:');
    const workingDays = [
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY
    ];

    workingDays.forEach(day => {
      const count = stats.entriesPerDay.get(day) || 0;
      const percentage = stats.totalEntries > 0 ? (count / stats.totalEntries * 100).toFixed(1) : '0.0';
      const bar = this.createProgressBar(count, stats.dailyLoadDistribution.maxEntriesPerDay, 20);
      lines.push(`  ${day.padEnd(10)}: ${count.toString().padStart(3)} (${percentage.padStart(5)}%) ${bar}`);
    });

    lines.push('');
    lines.push(`Average per Day: ${stats.dailyLoadDistribution.averageEntriesPerDay}`);
    lines.push(`Standard Deviation: ${stats.dailyLoadDistribution.standardDeviation}`);
    lines.push(`Distribution Quality: ${this.assessDistributionQuality(stats)}`);

    return lines.join('\n');
  }

  formatUtilizationAnalysis(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    const stats = schedule.calculateStatistics();
    
    lines.push('⏰ UTILIZATION ANALYSIS:');
    lines.push('-'.repeat(25));

    lines.push(`Time Slot Utilization: ${stats.timeSlotUtilization.utilizationRate}%`);
    lines.push(`Total Available Slots: ${stats.timeSlotUtilization.totalSlots}`);
    lines.push(`Occupied Slots: ${stats.timeSlotUtilization.occupiedSlots}`);
    lines.push(`Free Slots: ${stats.timeSlotUtilization.totalSlots - stats.timeSlotUtilization.occupiedSlots}`);

    // Utilization assessment
    const utilizationAssessment = this.assessUtilization(stats.timeSlotUtilization.utilizationRate);
    lines.push(`Utilization Level: ${utilizationAssessment}`);

    // Peak hours analysis
    lines.push('');
    lines.push(this.formatPeakHoursAnalysis(schedule));

    return lines.join('\n');
  }

  formatWorkloadAnalysis(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    const stats = schedule.calculateStatistics();
    
    lines.push('💼 WORKLOAD ANALYSIS:');
    lines.push('-'.repeat(20));

    // Batch workload
    lines.push('Batch Workload Distribution:');
    const sortedBatches = Array.from(stats.entriesPerBatch.entries())
      .sort(([,a], [,b]) => b - a);

    if (sortedBatches.length > 0) {
      const maxBatchLoad = sortedBatches[0][1];
      sortedBatches.forEach(([batch, count]) => {
        const bar = this.createProgressBar(count, maxBatchLoad, 15);
        lines.push(`  ${batch.padEnd(12)}: ${count.toString().padStart(3)} ${bar}`);
      });

      // Batch workload statistics
      const batchLoads = sortedBatches.map(([,count]) => count);
      const avgBatchLoad = batchLoads.reduce((sum, load) => sum + load, 0) / batchLoads.length;
      lines.push(`  Average: ${avgBatchLoad.toFixed(1)} lectures per batch`);
    }

    lines.push('');

    // Faculty workload
    lines.push('Faculty Workload Distribution:');
    const sortedFaculty = Array.from(stats.entriesPerFaculty.entries())
      .sort(([,a], [,b]) => b - a);

    if (sortedFaculty.length > 0) {
      const maxFacultyLoad = sortedFaculty[0][1];
      sortedFaculty.slice(0, 10).forEach(([faculty, count]) => {
        const bar = this.createProgressBar(count, maxFacultyLoad, 15);
        lines.push(`  ${faculty.padEnd(12)}: ${count.toString().padStart(3)} ${bar}`);
      });

      if (sortedFaculty.length > 10) {
        lines.push(`  ... and ${sortedFaculty.length - 10} more faculty members`);
      }

      // Faculty workload statistics
      const facultyLoads = sortedFaculty.map(([,count]) => count);
      const avgFacultyLoad = facultyLoads.reduce((sum, load) => sum + load, 0) / facultyLoads.length;
      lines.push(`  Average: ${avgFacultyLoad.toFixed(1)} lectures per faculty`);
    }

    return lines.join('\n');
  }

  formatEfficiencyMetrics(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    
    lines.push('⚡ EFFICIENCY METRICS:');
    lines.push('-'.repeat(20));

    // Calculate various efficiency metrics
    const metrics = this.calculateEfficiencyMetrics(schedule);

    lines.push(`Schedule Density: ${metrics.density.toFixed(2)}`);
    lines.push(`Load Balance Score: ${metrics.loadBalance.toFixed(2)}`);
    lines.push(`Conflict Rate: ${metrics.conflictRate.toFixed(2)}%`);
    lines.push(`Resource Utilization: ${metrics.resourceUtilization.toFixed(1)}%`);
    lines.push(`Distribution Evenness: ${metrics.distributionEvenness.toFixed(2)}`);

    lines.push('');
    lines.push('Efficiency Assessment:');
    lines.push(`  Overall Score: ${metrics.overallScore.toFixed(1)}/10`);
    lines.push(`  Grade: ${this.getEfficiencyGrade(metrics.overallScore)}`);

    // Recommendations
    lines.push('');
    lines.push('Recommendations:');
    const recommendations = this.generateEfficiencyRecommendations(metrics);
    recommendations.forEach(rec => {
      lines.push(`  • ${rec}`);
    });

    return lines.join('\n');
  }

  formatTimeSlotAnalysis(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    
    lines.push('🕐 TIME SLOT ANALYSIS:');
    lines.push('-'.repeat(22));

    // Analyze time slot usage patterns
    const timeSlotUsage = new Map<string, number>();
    schedule.entries.forEach(entry => {
      const timeSlot = entry.timeSlot.startTime;
      const count = timeSlotUsage.get(timeSlot) || 0;
      timeSlotUsage.set(timeSlot, count + 1);
    });

    if (timeSlotUsage.size > 0) {
      lines.push('Most Popular Time Slots:');
      const sortedTimeSlots = Array.from(timeSlotUsage.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);

      const maxUsage = sortedTimeSlots[0][1];
      sortedTimeSlots.forEach(([timeSlot, count]) => {
        const bar = this.createProgressBar(count, maxUsage, 15);
        lines.push(`  ${this.formatTime(timeSlot)}: ${count.toString().padStart(3)} ${bar}`);
      });

      lines.push('');
      lines.push('Time Slot Insights:');
      const insights = this.generateTimeSlotInsights(timeSlotUsage);
      insights.forEach(insight => {
        lines.push(`  • ${insight}`);
      });
    } else {
      lines.push('No time slot data to analyze.');
    }

    return lines.join('\n');
  }

  formatTrendAnalysis(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    
    lines.push('📊 TREND ANALYSIS:');
    lines.push('-'.repeat(18));

    // Analyze patterns and trends
    const trends = this.analyzeTrends(schedule);

    lines.push('Scheduling Patterns:');
    trends.patterns.forEach(pattern => {
      lines.push(`  • ${pattern}`);
    });

    lines.push('');
    lines.push('Optimization Opportunities:');
    trends.opportunities.forEach(opportunity => {
      lines.push(`  • ${opportunity}`);
    });

    return lines.join('\n');
  }

  private calculateScheduleHealthScore(schedule: WeeklySchedule): number {
    const summary = schedule.getSummary();
    const stats = schedule.calculateStatistics();
    
    let score = 100;

    // Deduct points for conflicts
    score -= summary.errorConflicts * 10; // 10 points per error
    score -= summary.warningConflicts * 5; // 5 points per warning

    // Deduct points for poor distribution
    const distributionScore = 1 - (stats.dailyLoadDistribution.standardDeviation / stats.dailyLoadDistribution.averageEntriesPerDay);
    score -= (1 - distributionScore) * 20;

    // Deduct points for low utilization
    if (stats.timeSlotUtilization.utilizationRate < 50) {
      score -= (50 - stats.timeSlotUtilization.utilizationRate) * 0.5;
    }

    return Math.max(0, Math.min(100, score));
  }

  private assessDistributionQuality(stats: any): string {
    const cv = stats.dailyLoadDistribution.standardDeviation / stats.dailyLoadDistribution.averageEntriesPerDay;
    
    if (cv < 0.2) return 'Excellent';
    if (cv < 0.4) return 'Good';
    if (cv < 0.6) return 'Fair';
    return 'Poor';
  }

  private assessUtilization(rate: number): string {
    if (rate >= 80) return 'High (may be overloaded)';
    if (rate >= 60) return 'Optimal';
    if (rate >= 40) return 'Moderate';
    if (rate >= 20) return 'Low';
    return 'Very Low';
  }

  private formatPeakHoursAnalysis(schedule: WeeklySchedule): string {
    const lines: string[] = [];
    const hourlyUsage = new Map<string, number>();

    // Count usage by hour
    schedule.entries.forEach(entry => {
      const hour = entry.timeSlot.startTime.split(':')[0];
      const count = hourlyUsage.get(hour) || 0;
      hourlyUsage.set(hour, count + 1);
    });

    if (hourlyUsage.size > 0) {
      lines.push('Peak Hours Analysis:');
      const sortedHours = Array.from(hourlyUsage.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);

      sortedHours.forEach(([hour, count], index) => {
        const timeLabel = `${hour}:00`;
        lines.push(`  ${index + 1}. ${this.formatTime(timeLabel)}: ${count} lectures`);
      });
    }

    return lines.join('\n');
  }

  private calculateEfficiencyMetrics(schedule: WeeklySchedule): {
    density: number;
    loadBalance: number;
    conflictRate: number;
    resourceUtilization: number;
    distributionEvenness: number;
    overallScore: number;
  } {
    const stats = schedule.calculateStatistics();
    const summary = schedule.getSummary();

    // Schedule density (lectures per available slot)
    const density = stats.totalEntries / Math.max(1, stats.timeSlotUtilization.totalSlots);

    // Load balance (1 - coefficient of variation)
    const cv = stats.dailyLoadDistribution.standardDeviation / Math.max(1, stats.dailyLoadDistribution.averageEntriesPerDay);
    const loadBalance = Math.max(0, 1 - cv);

    // Conflict rate
    const conflictRate = stats.totalEntries > 0 ? (summary.totalConflicts / stats.totalEntries * 100) : 0;

    // Resource utilization
    const resourceUtilization = stats.timeSlotUtilization.utilizationRate;

    // Distribution evenness (based on standard deviation)
    const distributionEvenness = Math.max(0, 1 - (stats.dailyLoadDistribution.standardDeviation / 10));

    // Overall score (weighted average)
    const overallScore = (
      density * 2 +
      loadBalance * 3 +
      (1 - conflictRate / 100) * 3 +
      (resourceUtilization / 100) * 1 +
      distributionEvenness * 1
    );

    return {
      density,
      loadBalance,
      conflictRate,
      resourceUtilization,
      distributionEvenness,
      overallScore
    };
  }

  private getEfficiencyGrade(score: number): string {
    if (score >= 9) return 'A+ (Excellent)';
    if (score >= 8) return 'A (Very Good)';
    if (score >= 7) return 'B+ (Good)';
    if (score >= 6) return 'B (Satisfactory)';
    if (score >= 5) return 'C+ (Fair)';
    if (score >= 4) return 'C (Poor)';
    return 'D (Needs Improvement)';
  }

  private generateEfficiencyRecommendations(metrics: any): string[] {
    const recommendations: string[] = [];

    if (metrics.conflictRate > 5) {
      recommendations.push('Resolve conflicts to improve schedule quality');
    }

    if (metrics.loadBalance < 0.7) {
      recommendations.push('Redistribute lectures for better load balancing');
    }

    if (metrics.resourceUtilization < 50) {
      recommendations.push('Consider increasing schedule density');
    } else if (metrics.resourceUtilization > 85) {
      recommendations.push('Schedule may be too dense - consider adding time slots');
    }

    if (metrics.distributionEvenness < 0.6) {
      recommendations.push('Improve distribution evenness across days');
    }

    if (recommendations.length === 0) {
      recommendations.push('Schedule efficiency is good - no major improvements needed');
    }

    return recommendations;
  }

  private generateTimeSlotInsights(timeSlotUsage: Map<string, number>): string[] {
    const insights: string[] = [];
    const sortedSlots = Array.from(timeSlotUsage.entries()).sort(([,a], [,b]) => b - a);

    if (sortedSlots.length > 0) {
      const mostPopular = sortedSlots[0];
      const leastPopular = sortedSlots[sortedSlots.length - 1];

      insights.push(`Most popular time: ${this.formatTime(mostPopular[0])} (${mostPopular[1]} lectures)`);
      insights.push(`Least popular time: ${this.formatTime(leastPopular[0])} (${leastPopular[1]} lectures)`);

      // Check for morning vs afternoon preference
      const morningSlots = sortedSlots.filter(([time]) => parseInt(time.split(':')[0]) < 12);
      const afternoonSlots = sortedSlots.filter(([time]) => parseInt(time.split(':')[0]) >= 12);

      const morningTotal = morningSlots.reduce((sum, [,count]) => sum + count, 0);
      const afternoonTotal = afternoonSlots.reduce((sum, [,count]) => sum + count, 0);

      if (morningTotal > afternoonTotal * 1.2) {
        insights.push('Strong preference for morning time slots');
      } else if (afternoonTotal > morningTotal * 1.2) {
        insights.push('Strong preference for afternoon time slots');
      } else {
        insights.push('Balanced distribution between morning and afternoon');
      }
    }

    return insights;
  }

  private analyzeTrends(schedule: WeeklySchedule): {
    patterns: string[];
    opportunities: string[];
  } {
    const patterns: string[] = [];
    const opportunities: string[] = [];
    const stats = schedule.calculateStatistics();

    // Analyze daily patterns
    const dailyEntries = Array.from(stats.entriesPerDay.values());
    const maxDay = Math.max(...dailyEntries);
    const minDay = Math.min(...dailyEntries);

    if (maxDay > minDay * 2) {
      patterns.push('Significant variation in daily lecture loads');
      opportunities.push('Balance daily loads by redistributing lectures');
    }

    // Analyze faculty distribution
    const facultyLoads = Array.from(stats.entriesPerFaculty.values());
    const maxFaculty = Math.max(...facultyLoads);
    const minFaculty = Math.min(...facultyLoads);

    if (maxFaculty > minFaculty * 2) {
      patterns.push('Uneven faculty workload distribution');
      opportunities.push('Redistribute subjects among faculty for better balance');
    }

    // Analyze utilization
    if (stats.timeSlotUtilization.utilizationRate < 60) {
      opportunities.push('Increase schedule density to better utilize available time slots');
    }

    return { patterns, opportunities };
  }

  private createProgressBar(value: number, max: number, width: number): string {
    const percentage = max > 0 ? value / max : 0;
    const filled = Math.round(percentage * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }
}
