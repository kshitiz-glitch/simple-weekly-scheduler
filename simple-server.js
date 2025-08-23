const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('.'));

// API Routes for future integration with existing backend
app.post('/api/generate-schedule', async (req, res) => {
    try {
        const { institute, batches, faculty, preferences } = req.body;
        
        // For now, return a mock response
        // In a real implementation, this would integrate with the existing ScheduleGenerator
        const mockSchedule = generateMockSchedule(req.body);
        
        res.json({
            success: true,
            schedule: mockSchedule,
            message: 'Schedule generated successfully'
        });
        
    } catch (error) {
        console.error('Schedule generation error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Failed to generate schedule'
        });
    }
});

app.post('/api/export-schedule', async (req, res) => {
    try {
        const { schedule, format, options = {} } = req.body;
        
        if (!schedule || !schedule.entries) {
            return res.status(400).json({
                success: false,
                error: 'Invalid schedule data',
                message: 'Schedule data is required'
            });
        }
        
        // Generate export based on format
        let exportData;
        let mimeType;
        let filename = `schedule_${new Date().toISOString().split('T')[0]}.${format}`;
        
        switch (format.toLowerCase()) {
            case 'csv':
                exportData = generateCSVExport(schedule);
                mimeType = 'text/csv';
                break;
            case 'html':
                exportData = generateHTMLExport(schedule, options);
                mimeType = 'text/html';
                break;
            case 'json':
                exportData = JSON.stringify(schedule, null, 2);
                mimeType = 'application/json';
                break;
            case 'excel':
                // For now, generate CSV that can be opened in Excel
                exportData = generateCSVExport(schedule);
                mimeType = 'application/vnd.ms-excel';
                filename = filename.replace('.excel', '.csv');
                break;
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
        
        // Create exports directory if it doesn't exist
        const exportsDir = path.join(__dirname, 'exports');
        if (!fs.existsSync(exportsDir)) {
            fs.mkdirSync(exportsDir, { recursive: true });
        }
        
        // Save file
        const filePath = path.join(exportsDir, filename);
        fs.writeFileSync(filePath, exportData, 'utf8');
        
        res.json({
            success: true,
            downloadUrl: `/exports/${filename}`,
            filename: filename,
            mimeType: mimeType,
            size: Buffer.byteLength(exportData, 'utf8'),
            message: `Schedule exported as ${format.toUpperCase()}`
        });
        
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Failed to export schedule'
        });
    }
});

// Serve export files
app.use('/exports', express.static(path.join(__dirname, 'exports')));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Serve the main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'simple-scheduler.html'));
});

// Mock schedule generation function
function generateMockSchedule(data) {
    const timeSlots = generateTimeSlots(
        data.preferences.workingHours.start,
        data.preferences.workingHours.end,
        60 // 1 hour slots
    );
    
    const entries = [];
    const workingDays = data.preferences.workingDays;
    
    // Simple round-robin scheduling
    let currentSlotIndex = 0;
    let currentDayIndex = 0;
    
    data.batches.forEach(batch => {
        batch.subjects.forEach(subject => {
            for (let i = 0; i < subject.lecturesPerWeek; i++) {
                if (currentDayIndex >= workingDays.length) {
                    currentDayIndex = 0;
                    currentSlotIndex++;
                }
                
                if (currentSlotIndex >= timeSlots.length) {
                    break; // No more slots available
                }
                
                const faculty = data.faculty.find(f => f.subjects.includes(subject.id));
                const timeSlot = timeSlots[currentSlotIndex];
                
                entries.push({
                    batchId: batch.id,
                    batchName: batch.name,
                    subjectId: subject.id,
                    subjectName: subject.name,
                    facultyId: faculty ? faculty.id : null,
                    facultyName: faculty ? faculty.name : 'Unassigned',
                    timeSlot: {
                        day: workingDays[currentDayIndex],
                        startTime: timeSlot.start,
                        endTime: timeSlot.end
                    }
                });
                
                currentDayIndex++;
            }
        });
    });
    
    return {
        entries: entries,
        conflicts: [],
        metadata: {
            generatedAt: new Date(),
            totalLectures: entries.length,
            batchCount: data.batches.length,
            facultyCount: data.faculty.length,
            generationTimeMs: Math.random() * 2000 + 500 // Mock generation time
        }
    };
}

function generateTimeSlots(startTime, endTime, duration) {
    const slots = [];
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    const lunchStart = timeToMinutes('12:00'); // Default lunch time
    const lunchEnd = timeToMinutes('13:00');
    
    for (let time = start; time + duration <= end; time += duration + 15) { // 15 min break
        // Skip lunch time
        if (time >= lunchStart && time < lunchEnd) {
            time = lunchEnd - duration - 15; // Adjust to continue after lunch
            continue;
        }
        
        slots.push({
            start: minutesToTime(time),
            end: minutesToTime(time + duration)
        });
    }
    
    return slots;
}

function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Export generation functions
function generateCSVExport(schedule) {
    const headers = ['Day', 'Time', 'Batch', 'Subject', 'Faculty', 'Duration'];
    const rows = [headers.join(',')];
    
    // Sort entries by day and time
    const sortedEntries = schedule.entries.sort((a, b) => {
        const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayA = dayOrder.indexOf(a.timeSlot.day);
        const dayB = dayOrder.indexOf(b.timeSlot.day);
        
        if (dayA !== dayB) {
            return dayA - dayB;
        }
        
        return a.timeSlot.startTime.localeCompare(b.timeSlot.startTime);
    });
    
    sortedEntries.forEach(entry => {
        const duration = calculateDuration(entry.timeSlot.startTime, entry.timeSlot.endTime);
        const row = [
            entry.timeSlot.day,
            `${entry.timeSlot.startTime} - ${entry.timeSlot.endTime}`,
            entry.batchName || entry.batchId,
            entry.subjectName || entry.subjectId,
            entry.facultyName || entry.facultyId,
            `${duration} min`
        ];
        rows.push(row.map(field => `"${field}"`).join(','));
    });
    
    return rows.join('\n');
}

function generateHTMLExport(schedule, options = {}) {
    const title = options.title || 'Weekly Schedule';
    const instituteName = options.instituteName || 'Educational Institution';
    
    // Group entries by day and time
    const timeSlots = [...new Set(schedule.entries.map(e => e.timeSlot.startTime))].sort();
    const workingDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const daysWithEntries = [...new Set(schedule.entries.map(e => e.timeSlot.day))];
    const activeDays = workingDays.filter(day => daysWithEntries.includes(day));
    
    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 20px;
            background-color: #f8f9fa;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 10px;
        }
        .schedule-table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        .schedule-table th {
            background: linear-gradient(90deg, #4CAF50, #45a049);
            color: white;
            padding: 15px 10px;
            text-align: center;
            font-weight: 600;
        }
        .schedule-table td {
            padding: 12px 8px;
            border: 1px solid #e9ecef;
            vertical-align: top;
            min-height: 60px;
        }
        .time-cell {
            background-color: #f8f9fa;
            font-weight: 600;
            text-align: center;
            width: 100px;
        }
        .schedule-entry {
            background: linear-gradient(45deg, #e3f2fd, #bbdefb);
            border-radius: 6px;
            padding: 8px;
            margin: 2px 0;
            border-left: 4px solid #2196F3;
            font-size: 0.9em;
        }
        .subject-name {
            font-weight: 600;
            color: #1976D2;
        }
        .batch-name {
            color: #666;
            font-size: 0.85em;
        }
        .faculty-name {
            color: #888;
            font-size: 0.8em;
            font-style: italic;
        }
        .stats {
            margin-top: 30px;
            display: flex;
            justify-content: space-around;
            flex-wrap: wrap;
        }
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
            margin: 10px;
            min-width: 150px;
        }
        .stat-number {
            font-size: 2em;
            font-weight: bold;
            color: #4CAF50;
        }
        .stat-label {
            color: #666;
            margin-top: 5px;
        }
        @media print {
            body { margin: 0; background: white; }
            .header { background: #333 !important; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${title}</h1>
        <h2>${instituteName}</h2>
        <p>Generated on ${new Date().toLocaleDateString()}</p>
    </div>
    
    <table class="schedule-table">
        <thead>
            <tr>
                <th>Time</th>
                ${activeDays.map(day => `<th>${day}</th>`).join('')}
            </tr>
        </thead>
        <tbody>`;
    
    timeSlots.forEach(timeSlot => {
        html += `<tr><td class="time-cell">${timeSlot}</td>`;
        
        activeDays.forEach(day => {
            const dayEntries = schedule.entries.filter(entry => 
                entry.timeSlot.day === day && entry.timeSlot.startTime === timeSlot
            );
            
            html += '<td>';
            dayEntries.forEach(entry => {
                html += `
                    <div class="schedule-entry">
                        <div class="subject-name">${entry.subjectName || entry.subjectId}</div>
                        <div class="batch-name">${entry.batchName || entry.batchId}</div>
                        <div class="faculty-name">${entry.facultyName || entry.facultyId}</div>
                    </div>
                `;
            });
            html += '</td>';
        });
        
        html += '</tr>';
    });
    
    html += `
        </tbody>
    </table>
    
    <div class="stats">
        <div class="stat-card">
            <div class="stat-number">${schedule.entries.length}</div>
            <div class="stat-label">Total Lectures</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${new Set(schedule.entries.map(e => e.batchId)).size}</div>
            <div class="stat-label">Batches</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${new Set(schedule.entries.map(e => e.facultyId)).size}</div>
            <div class="stat-label">Faculty</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${new Set(schedule.entries.map(e => e.subjectId)).size}</div>
            <div class="stat-label">Subjects</div>
        </div>
    </div>
    
</body>
</html>`;
    
    return html;
}

function calculateDuration(startTime, endTime) {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    return end - start;
}

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Simple Weekly Scheduler running on http://localhost:${PORT}`);
    console.log(`📅 Open your browser and navigate to the URL above to start creating schedules!`);
    console.log(`💡 This is a simplified interface that can be extended to use the full timetable generator backend.`);
});

module.exports = app;