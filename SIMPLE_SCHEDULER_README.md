# 📅 Simple Weekly Scheduler

A user-friendly, no-authentication-required weekly schedule generator for educational institutions. This application provides a streamlined interface for creating professional timetables in minutes.

## ✨ Features

- **🎯 Simple 6-Step Process**: Guided workflow from institute info to final schedule
- **👥 Batch Management**: Add multiple classes/batches with ease
- **📚 Subject Configuration**: Define subjects with lecture requirements
- **👨‍🏫 Faculty Assignment**: Assign teachers to subjects with conflict detection
- **⚙️ Flexible Preferences**: Customize working days, hours, and break times
- **📊 Automatic Generation**: Smart algorithm creates conflict-free schedules
- **📱 Mobile Responsive**: Works perfectly on all devices
- **💾 Auto-Save**: Automatically saves progress locally
- **📄 Multiple Export Options**: PDF, Excel, and HTML formats (coming soon)

## 🚀 Quick Start

### Option 1: Standalone Simple Scheduler

1. **Install Dependencies**:
   ```bash
   npm install express cors
   ```

2. **Start the Server**:
   ```bash
   node simple-server.js
   ```

3. **Open Your Browser**:
   Navigate to `http://localhost:3000`

### Option 2: Using Existing Infrastructure

If you have the full automated timetable generator installed:

1. **Copy Files**: Copy the simple scheduler files to your project directory
2. **Integrate**: The simple scheduler can use the existing backend algorithms
3. **Run**: Start your existing server and access the simple interface

## 📋 How to Use

### Step 1: Institute Information
- Enter your institute name (required)
- Add optional details like academic year and contact info

### Step 2: Add Batches/Classes
- Add one or more batches (e.g., "Grade 10A", "CS-101")
- Optionally specify student count

### Step 3: Configure Subjects
- For each batch, add subjects
- Specify lectures per week (1-20)
- Set lecture duration (30-180 minutes)

### Step 4: Assign Faculty
- Add faculty members
- Assign subjects to each faculty member
- System prevents double-booking conflicts

### Step 5: Set Preferences
- Choose working days (Monday-Saturday)
- Set working hours (start and end time)
- Configure lunch break and inter-class breaks

### Step 6: Generate & Export
- Review configuration summary
- Generate schedule with one click
- Export in multiple formats

## 🎨 User Interface

The application features a modern, intuitive interface with:

- **Progress Indicator**: Shows current step and overall progress
- **Responsive Design**: Adapts to desktop, tablet, and mobile screens
- **Real-time Validation**: Immediate feedback on input errors
- **Visual Schedule Grid**: Interactive weekly calendar view
- **Professional Styling**: Clean, modern design with smooth animations

## 🔧 Technical Details

### Frontend
- **Pure HTML/CSS/JavaScript**: No framework dependencies
- **Bootstrap 5.3**: For responsive design and components
- **Font Awesome**: For icons and visual elements
- **Local Storage**: Automatic data persistence

### Backend
- **Express.js**: Lightweight web server
- **CORS Enabled**: Cross-origin request support
- **JSON API**: RESTful endpoints for schedule generation
- **Mock Algorithm**: Simple round-robin scheduling (can be replaced with advanced algorithms)

### Integration Points
The simple scheduler is designed to integrate with the existing automated timetable generator:

- **Data Models**: Compatible with existing Batch, Subject, Faculty models
- **API Endpoints**: Can call existing ScheduleGenerator and ExportManager
- **Export Formats**: Supports all existing export options

## 📊 Sample Data Flow

```javascript
// Input Data Structure
{
  institute: { name: "ABC School", academicYear: "2024-25" },
  batches: [
    { id: "batch_1", name: "Grade 10A", subjects: [...] }
  ],
  faculty: [
    { id: "faculty_1", name: "Dr. Smith", subjects: ["subject_1"] }
  ],
  preferences: {
    workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    workingHours: { start: "08:00", end: "17:00" },
    breakDuration: 15
  }
}

// Output Schedule Structure
{
  entries: [
    {
      batchName: "Grade 10A",
      subjectName: "Mathematics",
      facultyName: "Dr. Smith",
      timeSlot: { day: "Monday", startTime: "08:00", endTime: "09:00" }
    }
  ],
  conflicts: [],
  metadata: { totalLectures: 25, generatedAt: "2024-01-15T10:30:00Z" }
}
```

## 🔄 Integration with Full System

To integrate with the existing automated timetable generator:

1. **Replace Mock Functions**: Update `callTimetableGenerator()` to use real backend
2. **Add Export Integration**: Connect export functions to existing ExportManager
3. **Enhanced Algorithms**: Use advanced scheduling algorithms instead of simple round-robin
4. **Conflict Resolution**: Add sophisticated conflict detection and resolution

### Example Integration

```javascript
// In simple-scheduler.js, replace mock function:
async callTimetableGenerator(data) {
  const response = await fetch('/api/generate-advanced-schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await response.json();
}
```

## 🎯 Use Cases

Perfect for:
- **Small Schools**: Quick schedule creation without complex setup
- **Departments**: Individual department scheduling
- **Training Centers**: Course and instructor scheduling
- **Tutoring Centers**: Student and teacher coordination
- **Summer Programs**: Temporary schedule creation
- **Proof of Concept**: Demonstrating scheduling capabilities

## 🔮 Future Enhancements

- **Real Export Functionality**: PDF, Excel, and HTML generation
- **Advanced Algorithms**: Integration with constraint satisfaction algorithms
- **User Accounts**: Optional user management and data persistence
- **Templates**: Save and reuse schedule templates
- **Conflict Resolution**: Interactive conflict resolution interface
- **Mobile App**: Native mobile application
- **API Integration**: Connect with student information systems

## 🤝 Contributing

This simple scheduler is designed to be easily extensible:

1. **Frontend Enhancements**: Improve UI/UX, add new features
2. **Backend Integration**: Connect with existing algorithms
3. **Export Options**: Add new export formats
4. **Mobile Optimization**: Enhance mobile experience
5. **Accessibility**: Improve accessibility features

## 📄 License

MIT License - feel free to use, modify, and distribute.

## 🆘 Support

For questions or issues:
1. Check the browser console for error messages
2. Verify all required fields are filled
3. Ensure working days and hours are properly configured
4. Try refreshing the page to restore auto-saved data

---

**🎉 Start creating professional weekly schedules in minutes with the Simple Weekly Scheduler!**