import { BaseExporter, ExportResult, ExportFormat, PrintableOptions } from './ExportInterfaces';
import { WeeklySchedule } from '../models/WeeklySchedule';
import { ScheduleEntry, DayOfWeek } from '../models';

export class HtmlExporter extends BaseExporter {
  private printOptions: PrintableOptions;

  constructor(options: PrintableOptions) {
    super(options);
    this.printOptions = {
      ...options,
      title: options.title ?? 'Weekly Timetable',
      subtitle: options.subtitle ?? 'Generated Schedule',
      headerText: options.headerText ?? '',
      footerText: options.footerText ?? '',
      showPageNumbers: options.showPageNumbers ?? true,
      margins: options.margins ?? { top: 20, right: 20, bottom: 20, left: 20 },
      fontSize: options.fontSize ?? 12,
      fontFamily: options.fontFamily ?? 'Arial, sans-serif',
      colorScheme: options.colorScheme ?? 'color',
      logoUrl: options.logoUrl ?? '',
      watermark: options.watermark ?? ''
    };
  }

  async export(schedule: WeeklySchedule): Promise<ExportResult> {
    const startTime = Date.now();
    
    try {
      const filteredEntries = this.filterEntries(schedule.entries);
      const sortedEntries = this.sortEntries(filteredEntries);
      
      const htmlContent = this.generateHtmlDocument(schedule, sortedEntries);
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        data: htmlContent,
        filename: this.options.filename,
        mimeType: 'text/html',
        size: Buffer.byteLength(htmlContent, this.options.encoding),
        metadata: {
          exportedAt: new Date(),
          format: ExportFormat.HTML,
          entriesCount: sortedEntries.length,
          processingTimeMs: processingTime
        }
      };
    } catch (error) {
      return {
        success: false,
        filename: this.options.filename,
        mimeType: 'text/html',
        size: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: {
          exportedAt: new Date(),
          format: ExportFormat.HTML,
          entriesCount: 0,
          processingTimeMs: Date.now() - startTime
        }
      };
    }
  }

  private generateHtmlDocument(schedule: WeeklySchedule, entries: ScheduleEntry[]): string {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(this.printOptions.title!)}</title>
    <style>
        ${this.generateStyles()}
    </style>
</head>
<body>
    ${this.generateHeader(schedule)}
    
    <main class="content">
        ${this.generateMainScheduleTable(entries)}
        
        ${this.options.includeConflicts && schedule.conflicts.length > 0 ? this.generateConflictsSection(schedule) : ''}
        
        ${this.options.includeStatistics ? this.generateStatisticsSection(schedule) : ''}
    </main>
    
    ${this.generateFooter()}
    
    ${this.printOptions.watermark ? this.generateWatermark() : ''}
</body>
</html>`;

    return html;
  }

  private generateStyles(): string {
    const colorScheme = this.getColorScheme();
    
    return `
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: ${this.printOptions.fontFamily};
            font-size: ${this.printOptions.fontSize}px;
            line-height: 1.4;
            color: ${colorScheme.text};
            background-color: ${colorScheme.background};
            margin: ${this.printOptions.margins!.top}mm ${this.printOptions.margins!.right}mm ${this.printOptions.margins!.bottom}mm ${this.printOptions.margins!.left}mm;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid ${colorScheme.border};
            padding-bottom: 20px;
        }
        
        .header h1 {
            font-size: 24px;
            color: ${colorScheme.primary};
            margin-bottom: 10px;
        }
        
        .header h2 {
            font-size: 18px;
            color: ${colorScheme.secondary};
            margin-bottom: 15px;
        }
        
        .header-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
            color: ${colorScheme.muted};
        }
        
        .logo {
            max-height: 50px;
            max-width: 200px;
        }
        
        .schedule-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .schedule-table th,
        .schedule-table td {
            border: 1px solid ${colorScheme.border};
            padding: 8px;
            text-align: left;
            vertical-align: top;
        }
        
        .schedule-table th {
            background-color: ${colorScheme.headerBg};
            color: ${colorScheme.headerText};
            font-weight: bold;
            text-align: center;
        }
        
        .time-column {
            width: 80px;
            text-align: center;
            font-weight: bold;
            background-color: ${colorScheme.timeBg};
        }
        
        .day-column {
            width: calc((100% - 80px) / 5);
        }
        
        .lecture-entry {
            background-color: ${colorScheme.entryBg};
            border-radius: 4px;
            padding: 4px;
            margin: 2px 0;
            font-size: 10px;
            line-height: 1.2;
        }
        
        .lecture-subject {
            font-weight: bold;
            color: ${colorScheme.primary};
        }
        
        .lecture-batch {
            color: ${colorScheme.secondary};
        }
        
        .lecture-faculty {
            color: ${colorScheme.muted};
            font-style: italic;
        }
        
        .conflict-entry {
            background-color: ${colorScheme.conflictBg} !important;
            border-left: 3px solid ${colorScheme.conflict};
        }
        
        .conflicts-section {
            margin-top: 30px;
            page-break-inside: avoid;
        }
        
        .section-title {
            font-size: 16px;
            font-weight: bold;
            color: ${colorScheme.primary};
            margin-bottom: 15px;
            border-bottom: 1px solid ${colorScheme.border};
            padding-bottom: 5px;
        }
        
        .conflict-item {
            background-color: ${colorScheme.conflictBg};
            border-left: 4px solid ${colorScheme.conflict};
            padding: 10px;
            margin-bottom: 10px;
            border-radius: 4px;
        }
        
        .conflict-type {
            font-weight: bold;
            color: ${colorScheme.conflict};
        }
        
        .conflict-severity {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .severity-error {
            background-color: #dc3545;
            color: white;
        }
        
        .severity-warning {
            background-color: #ffc107;
            color: black;
        }
        
        .statistics-section {
            margin-top: 30px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        
        .stat-card {
            background-color: ${colorScheme.cardBg};
            border: 1px solid ${colorScheme.border};
            border-radius: 6px;
            padding: 15px;
        }
        
        .stat-title {
            font-weight: bold;
            color: ${colorScheme.primary};
            margin-bottom: 10px;
        }
        
        .stat-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
        }
        
        .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 10px;
            color: ${colorScheme.muted};
            border-top: 1px solid ${colorScheme.border};
            padding-top: 15px;
        }
        
        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 48px;
            color: rgba(0,0,0,0.1);
            z-index: -1;
            pointer-events: none;
        }
        
        @media print {
            body {
                margin: 0;
            }
            
            .schedule-table {
                page-break-inside: avoid;
            }
            
            .conflicts-section,
            .statistics-section {
                page-break-before: auto;
            }
            
            .watermark {
                color: rgba(0,0,0,0.05);
            }
        }
        
        @page {
            size: ${this.printOptions.pageSize} ${this.printOptions.orientation};
            margin: ${this.printOptions.margins!.top}mm ${this.printOptions.margins!.right}mm ${this.printOptions.margins!.bottom}mm ${this.printOptions.margins!.left}mm;
        }
    `;
  }

  private getColorScheme() {
    switch (this.printOptions.colorScheme) {
      case 'grayscale':
        return {
          primary: '#333333',
          secondary: '#666666',
          muted: '#999999',
          text: '#000000',
          background: '#ffffff',
          border: '#cccccc',
          headerBg: '#f0f0f0',
          headerText: '#333333',
          timeBg: '#f8f8f8',
          entryBg: '#f5f5f5',
          conflict: '#666666',
          conflictBg: '#e8e8e8',
          cardBg: '#fafafa'
        };
      case 'blackwhite':
        return {
          primary: '#000000',
          secondary: '#000000',
          muted: '#666666',
          text: '#000000',
          background: '#ffffff',
          border: '#000000',
          headerBg: '#ffffff',
          headerText: '#000000',
          timeBg: '#ffffff',
          entryBg: '#ffffff',
          conflict: '#000000',
          conflictBg: '#ffffff',
          cardBg: '#ffffff'
        };
      case 'color':
      default:
        return {
          primary: '#2c3e50',
          secondary: '#3498db',
          muted: '#7f8c8d',
          text: '#2c3e50',
          background: '#ffffff',
          border: '#bdc3c7',
          headerBg: '#3498db',
          headerText: '#ffffff',
          timeBg: '#ecf0f1',
          entryBg: '#e8f4fd',
          conflict: '#e74c3c',
          conflictBg: '#fdf2f2',
          cardBg: '#f8f9fa'
        };
    }
  }

  private generateHeader(schedule: WeeklySchedule): string {
    const generatedDate = this.formatDate(schedule.metadata.generatedAt);
    const exportDate = this.formatDate(new Date());
    
    return `
    <header class="header">
        <div class="header-info">
            <div>
                ${this.printOptions.logoUrl ? `<img src="${this.printOptions.logoUrl}" alt="Logo" class="logo">` : ''}
            </div>
            <div>
                ${this.printOptions.headerText ? `<div>${this.escapeHtml(this.printOptions.headerText)}</div>` : ''}
                ${this.printOptions.showPageNumbers ? '<div>Page 1</div>' : ''}
            </div>
        </div>
        
        <h1>${this.escapeHtml(this.printOptions.title!)}</h1>
        <h2>${this.escapeHtml(this.printOptions.subtitle!)}</h2>
        
        <div class="header-info">
            <div>Generated: ${generatedDate}</div>
            <div>Exported: ${exportDate}</div>
            <div>Total Lectures: ${schedule.metadata.totalLectures}</div>
        </div>
    </header>`;
  }

  private generateMainScheduleTable(entries: ScheduleEntry[]): string {
    const workingDays = [
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY
    ];

    // Get unique time slots
    const timeSlots = [...new Set(entries.map(e => e.timeSlot.startTime))]
      .sort((a, b) => this.timeToMinutes(a) - this.timeToMinutes(b));

    let tableHtml = `
    <table class="schedule-table">
        <thead>
            <tr>
                <th class="time-column">Time</th>
                ${workingDays.map(day => `<th class="day-column">${day}</th>`).join('')}
            </tr>
        </thead>
        <tbody>`;

    timeSlots.forEach(timeSlot => {
      tableHtml += `<tr>`;
      tableHtml += `<td class="time-column">${this.formatTime(timeSlot)}</td>`;
      
      workingDays.forEach(day => {
        const dayEntries = entries.filter(entry => 
          entry.timeSlot.day === day && entry.timeSlot.startTime === timeSlot
        );
        
        tableHtml += `<td class="day-column">`;
        dayEntries.forEach(entry => {
          const isConflicting = false; // Would need to check against schedule conflicts
          const entryClass = isConflicting ? 'lecture-entry conflict-entry' : 'lecture-entry';
          
          tableHtml += `
            <div class="${entryClass}">
                <div class="lecture-subject">${this.escapeHtml(entry.subjectId)}</div>
                <div class="lecture-batch">${this.escapeHtml(entry.batchId)}</div>
                <div class="lecture-faculty">${this.escapeHtml(entry.facultyId)}</div>
            </div>`;
        });
        tableHtml += `</td>`;
      });
      
      tableHtml += `</tr>`;
    });

    tableHtml += `
        </tbody>
    </table>`;

    return tableHtml;
  }

  private generateConflictsSection(schedule: WeeklySchedule): string {
    if (schedule.conflicts.length === 0) {
      return '';
    }

    let html = `
    <section class="conflicts-section">
        <h3 class="section-title">Conflicts (${schedule.conflicts.length})</h3>`;

    schedule.conflicts.forEach(conflict => {
      const severityClass = `severity-${conflict.severity}`;
      html += `
        <div class="conflict-item">
            <div class="conflict-type">${this.escapeHtml(conflict.type.replace(/_/g, ' ').toUpperCase())}</div>
            <span class="conflict-severity ${severityClass}">${conflict.severity}</span>
            <p>${this.escapeHtml(conflict.message)}</p>
            <small>Affects ${conflict.affectedEntries.length} entries</small>
        </div>`;
    });

    html += `</section>`;
    return html;
  }

  private generateStatisticsSection(schedule: WeeklySchedule): string {
    const stats = schedule.calculateStatistics();
    
    return `
    <section class="statistics-section">
        <div class="stat-card">
            <div class="stat-title">Daily Distribution</div>
            ${Array.from(stats.entriesPerDay.entries()).map(([day, count]) => {
              const percentage = stats.totalEntries > 0 ? (count / stats.totalEntries * 100).toFixed(1) : '0.0';
              return `<div class="stat-item"><span>${day}</span><span>${count} (${percentage}%)</span></div>`;
            }).join('')}
        </div>
        
        <div class="stat-card">
            <div class="stat-title">Utilization Metrics</div>
            <div class="stat-item"><span>Total Entries</span><span>${stats.totalEntries}</span></div>
            <div class="stat-item"><span>Utilization Rate</span><span>${stats.timeSlotUtilization.utilizationRate}%</span></div>
            <div class="stat-item"><span>Avg per Day</span><span>${stats.dailyLoadDistribution.averageEntriesPerDay}</span></div>
            <div class="stat-item"><span>Max per Day</span><span>${stats.dailyLoadDistribution.maxEntriesPerDay}</span></div>
        </div>
    </section>`;
  }

  private generateFooter(): string {
    return `
    <footer class="footer">
        ${this.printOptions.footerText ? `<div>${this.escapeHtml(this.printOptions.footerText)}</div>` : ''}
        <div>Generated by Automated Timetable Generator</div>
    </footer>`;
  }

  private generateWatermark(): string {
    return `<div class="watermark">${this.escapeHtml(this.printOptions.watermark!)}</div>`;
  }

  private escapeHtml(text: string): string {
    const div = { innerHTML: '' } as any;
    div.textContent = text;
    return div.innerHTML;
  }

  private timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Export schedule in a compact HTML format suitable for mobile viewing
   */
  exportMobileFormat(schedule: WeeklySchedule): Promise<ExportResult> {
    const startTime = Date.now();
    
    try {
      const filteredEntries = this.filterEntries(schedule.entries);
      const sortedEntries = this.sortEntries(filteredEntries);
      
      const mobileHtml = this.generateMobileHtml(schedule, sortedEntries);
      const processingTime = Date.now() - startTime;
      
      return Promise.resolve({
        success: true,
        data: mobileHtml,
        filename: this.options.filename.replace('.html', '_mobile.html'),
        mimeType: 'text/html',
        size: Buffer.byteLength(mobileHtml, this.options.encoding),
        metadata: {
          exportedAt: new Date(),
          format: ExportFormat.HTML,
          entriesCount: sortedEntries.length,
          processingTimeMs: processingTime
        }
      });
    } catch (error) {
      return Promise.resolve({
        success: false,
        filename: this.options.filename,
        mimeType: 'text/html',
        size: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: {
          exportedAt: new Date(),
          format: ExportFormat.HTML,
          entriesCount: 0,
          processingTimeMs: Date.now() - startTime
        }
      });
    }
  }

  private generateMobileHtml(schedule: WeeklySchedule, entries: ScheduleEntry[]): string {
    const workingDays = [
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY
    ];

    let mobileContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(this.printOptions.title!)} - Mobile</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 10px; font-size: 14px; }
        .day-section { margin-bottom: 20px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
        .day-header { background: #3498db; color: white; padding: 10px; font-weight: bold; }
        .lecture-item { padding: 10px; border-bottom: 1px solid #eee; }
        .lecture-item:last-child { border-bottom: none; }
        .lecture-time { font-weight: bold; color: #2c3e50; }
        .lecture-details { margin-top: 5px; }
        .subject { color: #e74c3c; font-weight: bold; }
        .batch { color: #27ae60; }
        .faculty { color: #8e44ad; font-style: italic; }
    </style>
</head>
<body>
    <h1>${this.escapeHtml(this.printOptions.title!)}</h1>
    <p>Generated: ${this.formatDate(schedule.metadata.generatedAt)}</p>
`;

    workingDays.forEach(day => {
      const dayEntries = entries.filter(entry => entry.timeSlot.day === day)
        .sort((a, b) => this.timeToMinutes(a.timeSlot.startTime) - this.timeToMinutes(b.timeSlot.startTime));

      mobileContent += `
        <div class="day-section">
            <div class="day-header">${day} (${dayEntries.length} lectures)</div>`;

      if (dayEntries.length === 0) {
        mobileContent += `<div class="lecture-item">No lectures scheduled</div>`;
      } else {
        dayEntries.forEach(entry => {
          mobileContent += `
            <div class="lecture-item">
                <div class="lecture-time">${this.formatTime(entry.timeSlot.startTime)} - ${this.formatTime(entry.timeSlot.endTime)}</div>
                <div class="lecture-details">
                    <span class="subject">${this.escapeHtml(entry.subjectId)}</span> |
                    <span class="batch">${this.escapeHtml(entry.batchId)}</span> |
                    <span class="faculty">${this.escapeHtml(entry.facultyId)}</span>
                </div>
            </div>`;
        });
      }

      mobileContent += `</div>`;
    });

    mobileContent += `
</body>
</html>`;

    return mobileContent;
  }
}
