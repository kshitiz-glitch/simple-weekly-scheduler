import express from 'express';
import cors from 'cors';
import path from 'path';
import { DayOfWeek, ScheduleEntry } from './models';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Sample data for demonstration
const sampleScheduleData: ScheduleEntry[] = [
  {
    batchId: 'CS-A',
    subjectId: 'Mathematics',
    facultyId: 'Dr. Smith',
    timeSlot: {
      day: DayOfWeek.MONDAY,
      startTime: '09:00',
      endTime: '10:00',
      isAvailable: true
    }
  },
  {
    batchId: 'CS-A',
    subjectId: 'Programming',
    facultyId: 'Dr. Johnson',
    timeSlot: {
      day: DayOfWeek.MONDAY,
      startTime: '10:00',
      endTime: '11:00',
      isAvailable: true
    }
  },
  {
    batchId: 'CS-A',
    subjectId: 'Physics',
    facultyId: 'Dr. Brown',
    timeSlot: {
      day: DayOfWeek.TUESDAY,
      startTime: '09:00',
      endTime: '10:00',
      isAvailable: true
    }
  },
  {
    batchId: 'CS-B',
    subjectId: 'Mathematics',
    facultyId: 'Dr. Smith',
    timeSlot: {
      day: DayOfWeek.TUESDAY,
      startTime: '10:00',
      endTime: '11:00',
      isAvailable: true
    }
  },
  {
    batchId: 'CS-B',
    subjectId: 'Database',
    facultyId: 'Dr. Wilson',
    timeSlot: {
      day: DayOfWeek.WEDNESDAY,
      startTime: '09:00',
      endTime: '10:00',
      isAvailable: true
    }
  },
  {
    batchId: 'CS-B',
    subjectId: 'Networks',
    facultyId: 'Dr. Davis',
    timeSlot: {
      day: DayOfWeek.WEDNESDAY,
      startTime: '10:00',
      endTime: '11:00',
      isAvailable: true
    }
  }
];

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Timetable Generator API is running' });
});

app.get('/api/schedule', (req, res) => {
  try {
    const schedule = {
      entries: sampleScheduleData,
      statistics: {
        totalEntries: sampleScheduleData.length,
        batches: new Set(sampleScheduleData.map(e => e.batchId)).size,
        subjects: new Set(sampleScheduleData.map(e => e.subjectId)).size,
        faculty: new Set(sampleScheduleData.map(e => e.facultyId)).size,
        conflicts: 0
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '2.0.0'
      }
    };
    
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate schedule' });
  }
});

app.get('/api/schedule/by-day/:day', (req, res) => {
  try {
    const day = req.params.day.toUpperCase() as DayOfWeek;
    const dayEntries = sampleScheduleData.filter(entry => entry.timeSlot.day === day);
    
    res.json({
      day,
      entries: dayEntries.sort((a, b) => a.timeSlot.startTime.localeCompare(b.timeSlot.startTime))
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get schedule for day' });
  }
});

app.get('/api/schedule/by-batch/:batchId', (req, res) => {
  try {
    const batchId = req.params.batchId;
    const batchEntries = sampleScheduleData.filter(entry => entry.batchId === batchId);
    
    res.json({
      batchId,
      entries: batchEntries.sort((a, b) => {
        const dayOrder = Object.values(DayOfWeek).indexOf(a.timeSlot.day) - Object.values(DayOfWeek).indexOf(b.timeSlot.day);
        return dayOrder !== 0 ? dayOrder : a.timeSlot.startTime.localeCompare(b.timeSlot.startTime);
      })
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get schedule for batch' });
  }
});

app.get('/api/schedule/by-faculty/:facultyId', (req, res) => {
  try {
    const facultyId = req.params.facultyId;
    const facultyEntries = sampleScheduleData.filter(entry => entry.facultyId === facultyId);
    
    res.json({
      facultyId,
      entries: facultyEntries.sort((a, b) => {
        const dayOrder = Object.values(DayOfWeek).indexOf(a.timeSlot.day) - Object.values(DayOfWeek).indexOf(b.timeSlot.day);
        return dayOrder !== 0 ? dayOrder : a.timeSlot.startTime.localeCompare(b.timeSlot.startTime);
      })
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get schedule for faculty' });
  }
});

app.post('/api/schedule/generate', (req, res) => {
  try {
    const { batches, subjects, options } = req.body;
    
    // For now, return the sample data
    // In a full implementation, this would use the actual generation logic
    res.json({
      success: true,
      schedule: {
        entries: sampleScheduleData,
        conflicts: [],
        metadata: {
          generatedAt: new Date().toISOString(),
          totalLectures: sampleScheduleData.length,
          batchCount: new Set(sampleScheduleData.map(e => e.batchId)).size
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate schedule' });
  }
});

app.get('/api/conflicts', (req, res) => {
  try {
    const conflicts = [];
    
    // Check for conflicts in sample data
    for (let i = 0; i < sampleScheduleData.length; i++) {
      for (let j = i + 1; j < sampleScheduleData.length; j++) {
        const entry1 = sampleScheduleData[i];
        const entry2 = sampleScheduleData[j];
        
        if (entry1.facultyId === entry2.facultyId && 
            entry1.timeSlot.day === entry2.timeSlot.day &&
            entry1.timeSlot.startTime === entry2.timeSlot.startTime) {
          conflicts.push({
            type: 'faculty',
            message: `Faculty conflict: ${entry1.facultyId} assigned to both ${entry1.batchId} and ${entry2.batchId}`,
            entries: [entry1, entry2],
            severity: 'error'
          });
        }
      }
    }
    
    res.json({ conflicts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to analyze conflicts' });
  }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Timetable Generator Server running on http://localhost:${PORT}`);
  console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
});

export default app;