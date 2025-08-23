// Simple Weekly Scheduler - Frontend Logic
class SimpleScheduler {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 6;
        this.data = {
            institute: {},
            batches: [],
            subjects: [],
            faculty: [],
            preferences: {},
            schedule: null
        };
        
        this.init();
    }
    
    init() {
        this.updateProgress();
        this.setupEventListeners();
        this.checkForSavedTemplates();
    }
    
    checkForSavedTemplates() {
        const savedTemplates = this.getSavedTemplates();
        if (savedTemplates.length > 0) {
            document.getElementById('showTemplatesBtn').style.display = 'inline-block';
        }
    }
    
    setupEventListeners() {
        // Enter key navigation
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                const activeElement = document.activeElement;
                if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT') {
                    this.handleEnterKey(activeElement);
                }
            }
        });
        
        // Auto-save data on input changes
        document.addEventListener('input', (e) => {
            if (e.target.matches('input, select, textarea')) {
                this.autoSave();
            }
        });
    }
    
    handleEnterKey(element) {
        const stepId = element.closest('.step-section').id;
        
        switch (stepId) {
            case 'step2':
                if (element.id === 'batchName' || element.id === 'studentCount') {
                    this.addBatch();
                }
                break;
            case 'step3':
                if (['subjectName', 'lecturesPerWeek', 'lectureDuration'].includes(element.id)) {
                    this.addSubject();
                }
                break;
            case 'step4':
                if (['facultyName', 'facultyEmail'].includes(element.id)) {
                    this.addFaculty();
                }
                break;
        }
    }
    
    nextStep() {
        if (!this.validateCurrentStep()) {
            return;
        }
        
        this.saveCurrentStepData();
        
        if (this.currentStep < this.totalSteps) {
            document.getElementById(`step${this.currentStep}`).style.display = 'none';
            this.currentStep++;
            document.getElementById(`step${this.currentStep}`).style.display = 'block';
            this.updateProgress();
            this.prepareStep();
        }
    }
    
    prevStep() {
        if (this.currentStep > 1) {
            document.getElementById(`step${this.currentStep}`).style.display = 'none';
            this.currentStep--;
            document.getElementById(`step${this.currentStep}`).style.display = 'block';
            this.updateProgress();
            this.prepareStep();
        }
    }
    
    updateProgress() {
        const progress = (this.currentStep / this.totalSteps) * 100;
        document.getElementById('progressBar').style.width = `${progress}%`;
        document.getElementById('currentStep').textContent = this.currentStep;
        
        const stepTitles = [
            'Institute Information',
            'Batches/Classes',
            'Subjects',
            'Faculty',
            'Preferences',
            'Generate Schedule'
        ];
        
        document.getElementById('stepTitle').textContent = stepTitles[this.currentStep - 1];
    }
    
    validateCurrentStep() {
        switch (this.currentStep) {
            case 1:
                const instituteName = document.getElementById('instituteName').value.trim();
                if (!instituteName) {
                    this.showAlert('Please enter the institute name.', 'warning');
                    document.getElementById('instituteName').focus();
                    return false;
                }
                break;
                
            case 2:
                if (this.data.batches.length === 0) {
                    this.showAlert('Please add at least one batch.', 'warning');
                    document.getElementById('batchName').focus();
                    return false;
                }
                break;
                
            case 3:
                if (this.data.subjects.length === 0) {
                    this.showAlert('Please add at least one subject.', 'warning');
                    return false;
                }
                break;
                
            case 4:
                if (this.data.faculty.length === 0) {
                    this.showAlert('Please add at least one faculty member.', 'warning');
                    return false;
                }
                
                // Check if all subjects have faculty assigned
                const unassignedSubjects = this.data.subjects.filter(subject => 
                    !this.data.faculty.some(faculty => 
                        faculty.subjects.includes(subject.id)
                    )
                );
                
                if (unassignedSubjects.length > 0) {
                    this.showAlert(`Some subjects don't have faculty assigned: ${unassignedSubjects.map(s => s.name).join(', ')}`, 'warning');
                    return false;
                }
                break;
                
            case 5:
                const workingDays = this.getSelectedWorkingDays();
                if (workingDays.length === 0) {
                    this.showAlert('Please select at least one working day.', 'warning');
                    return false;
                }
                break;
        }
        
        return true;
    }
    
    saveCurrentStepData() {
        switch (this.currentStep) {
            case 1:
                this.data.institute = {
                    name: document.getElementById('instituteName').value.trim(),
                    academicYear: document.getElementById('academicYear').value.trim(),
                    contactEmail: document.getElementById('contactEmail').value.trim(),
                    contactPhone: document.getElementById('contactPhone').value.trim()
                };
                break;
                
            case 5:
                this.data.preferences = {
                    workingDays: this.getSelectedWorkingDays(),
                    startTime: document.getElementById('startTime').value,
                    endTime: document.getElementById('endTime').value,
                    lunchBreak: {
                        start: document.getElementById('lunchStart').value,
                        end: document.getElementById('lunchEnd').value
                    },
                    breakDuration: parseInt(document.getElementById('breakDuration').value) || 15
                };
                break;
        }
    }
    
    prepareStep() {
        switch (this.currentStep) {
            case 2:
                this.renderBatches();
                break;
            case 3:
                this.updateSubjectBatchOptions();
                this.renderSubjects();
                break;
            case 4:
                this.updateFacultySubjectOptions();
                this.renderFaculty();
                break;
            case 6:
                this.displayConfigurationSummary();
                break;
        }
    }
    
    // Batch Management
    addBatch() {
        const nameInput = document.getElementById('batchName');
        const countInput = document.getElementById('studentCount');
        
        const name = nameInput.value.trim();
        if (!name) {
            this.showAlert('Please enter a batch name.', 'warning');
            nameInput.focus();
            return;
        }
        
        // Check for duplicate names
        if (this.data.batches.some(batch => batch.name.toLowerCase() === name.toLowerCase())) {
            this.showAlert('A batch with this name already exists.', 'warning');
            nameInput.focus();
            return;
        }
        
        const batch = {
            id: this.generateId('batch'),
            name: name,
            studentCount: parseInt(countInput.value) || null
        };
        
        this.data.batches.push(batch);
        this.renderBatches();
        
        // Clear inputs
        nameInput.value = '';
        countInput.value = '';
        nameInput.focus();
        
        // Enable next button
        document.getElementById('nextToBatches').disabled = false;
        
        this.showAlert(`Batch "${name}" added successfully!`, 'success', 2000);
    }
    
    removeBatch(batchId) {
        this.data.batches = this.data.batches.filter(batch => batch.id !== batchId);
        
        // Remove associated subjects
        this.data.subjects = this.data.subjects.filter(subject => subject.batchId !== batchId);
        
        this.renderBatches();
        
        // Disable next button if no batches
        document.getElementById('nextToBatches').disabled = this.data.batches.length === 0;
    }
    
    renderBatches() {
        const container = document.getElementById('batchesList');
        
        if (this.data.batches.length === 0) {
            container.innerHTML = '<p class="text-muted">No batches added yet.</p>';
            return;
        }
        
        container.innerHTML = this.data.batches.map(batch => `
            <div class="subject-item d-flex justify-content-between align-items-center">
                <div>
                    <strong>${batch.name}</strong>
                    ${batch.studentCount ? `<span class="text-muted ms-2">(${batch.studentCount} students)</span>` : ''}
                </div>
                <button type="button" class="remove-btn" onclick="scheduler.removeBatch('${batch.id}')" title="Remove batch">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
    }
    
    // Subject Management
    updateSubjectBatchOptions() {
        const select = document.getElementById('subjectBatch');
        select.innerHTML = '<option value="">Choose batch...</option>' +
            this.data.batches.map(batch => 
                `<option value="${batch.id}">${batch.name}</option>`
            ).join('');
    }
    
    addSubject() {
        const batchSelect = document.getElementById('subjectBatch');
        const nameInput = document.getElementById('subjectName');
        const lecturesInput = document.getElementById('lecturesPerWeek');
        const durationInput = document.getElementById('lectureDuration');
        
        const batchId = batchSelect.value;
        const name = nameInput.value.trim();
        const lectures = parseInt(lecturesInput.value);
        const duration = parseInt(durationInput.value);
        
        if (!batchId) {
            this.showAlert('Please select a batch.', 'warning');
            batchSelect.focus();
            return;
        }
        
        if (!name) {
            this.showAlert('Please enter a subject name.', 'warning');
            nameInput.focus();
            return;
        }
        
        if (!lectures || lectures < 1 || lectures > 20) {
            this.showAlert('Lectures per week must be between 1 and 20.', 'warning');
            lecturesInput.focus();
            return;
        }
        
        if (!duration || duration < 30 || duration > 180) {
            this.showAlert('Lecture duration must be between 30 and 180 minutes.', 'warning');
            durationInput.focus();
            return;
        }
        
        // Check for duplicate subjects in the same batch
        const batch = this.data.batches.find(b => b.id === batchId);
        if (this.data.subjects.some(subject => 
            subject.batchId === batchId && subject.name.toLowerCase() === name.toLowerCase())) {
            this.showAlert(`Subject "${name}" already exists in batch "${batch.name}".`, 'warning');
            nameInput.focus();
            return;
        }
        
        const subject = {
            id: this.generateId('subject'),
            name: name,
            batchId: batchId,
            batchName: batch.name,
            lecturesPerWeek: lectures,
            lectureDuration: duration
        };
        
        this.data.subjects.push(subject);
        this.renderSubjects();
        
        // Clear inputs except batch selection
        nameInput.value = '';
        lecturesInput.value = '3';
        durationInput.value = '60';
        nameInput.focus();
        
        // Enable next button
        document.getElementById('nextToFaculty').disabled = false;
        
        this.showAlert(`Subject "${name}" added to ${batch.name}!`, 'success', 2000);
    }
    
    removeSubject(subjectId) {
        this.data.subjects = this.data.subjects.filter(subject => subject.id !== subjectId);
        
        // Remove from faculty assignments
        this.data.faculty.forEach(faculty => {
            faculty.subjects = faculty.subjects.filter(id => id !== subjectId);
        });
        
        this.renderSubjects();
        
        // Disable next button if no subjects
        document.getElementById('nextToFaculty').disabled = this.data.subjects.length === 0;
    }
    
    renderSubjects() {
        const container = document.getElementById('subjectsList');
        
        if (this.data.subjects.length === 0) {
            container.innerHTML = '<p class="text-muted">No subjects added yet.</p>';
            return;
        }
        
        // Group subjects by batch
        const subjectsByBatch = this.data.subjects.reduce((acc, subject) => {
            if (!acc[subject.batchId]) {
                acc[subject.batchId] = [];
            }
            acc[subject.batchId].push(subject);
            return acc;
        }, {});
        
        container.innerHTML = Object.entries(subjectsByBatch).map(([batchId, subjects]) => {
            const batch = this.data.batches.find(b => b.id === batchId);
            return `
                <div class="mb-3">
                    <h6 class="text-primary">${batch.name}</h6>
                    ${subjects.map(subject => `
                        <div class="subject-item d-flex justify-content-between align-items-center ms-3">
                            <div>
                                <strong>${subject.name}</strong>
                                <span class="text-muted ms-2">
                                    ${subject.lecturesPerWeek} lectures/week × ${subject.lectureDuration}min
                                </span>
                            </div>
                            <button type="button" class="remove-btn" onclick="scheduler.removeSubject('${subject.id}')" title="Remove subject">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            `;
        }).join('');
    }
    
    // Faculty Management
    updateFacultySubjectOptions() {
        const select = document.getElementById('facultySubjects');
        select.innerHTML = this.data.subjects.map(subject => 
            `<option value="${subject.id}">${subject.name} (${subject.batchName})</option>`
        ).join('');
    }
    
    addFaculty() {
        const nameInput = document.getElementById('facultyName');
        const emailInput = document.getElementById('facultyEmail');
        const subjectsSelect = document.getElementById('facultySubjects');
        
        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const selectedSubjects = Array.from(subjectsSelect.selectedOptions).map(option => option.value);
        
        if (!name) {
            this.showAlert('Please enter faculty name.', 'warning');
            nameInput.focus();
            return;
        }
        
        if (selectedSubjects.length === 0) {
            this.showAlert('Please select at least one subject.', 'warning');
            subjectsSelect.focus();
            return;
        }
        
        // Check for duplicate names
        if (this.data.faculty.some(faculty => faculty.name.toLowerCase() === name.toLowerCase())) {
            this.showAlert('A faculty member with this name already exists.', 'warning');
            nameInput.focus();
            return;
        }
        
        const faculty = {
            id: this.generateId('faculty'),
            name: name,
            email: email,
            subjects: selectedSubjects
        };
        
        this.data.faculty.push(faculty);
        this.renderFaculty();
        
        // Clear inputs
        nameInput.value = '';
        emailInput.value = '';
        subjectsSelect.selectedIndex = -1;
        nameInput.focus();
        
        // Enable next button
        document.getElementById('nextToPreferences').disabled = false;
        
        this.showAlert(`Faculty "${name}" added successfully!`, 'success', 2000);
    }
    
    removeFaculty(facultyId) {
        this.data.faculty = this.data.faculty.filter(faculty => faculty.id !== facultyId);
        this.renderFaculty();
        
        // Disable next button if no faculty
        document.getElementById('nextToPreferences').disabled = this.data.faculty.length === 0;
    }
    
    renderFaculty() {
        const container = document.getElementById('facultyList');
        
        if (this.data.faculty.length === 0) {
            container.innerHTML = '<p class="text-muted">No faculty added yet.</p>';
            return;
        }
        
        container.innerHTML = this.data.faculty.map(faculty => {
            const subjectNames = faculty.subjects.map(subjectId => {
                const subject = this.data.subjects.find(s => s.id === subjectId);
                return subject ? `${subject.name} (${subject.batchName})` : 'Unknown Subject';
            });
            
            return `
                <div class="faculty-item d-flex justify-content-between align-items-start">
                    <div>
                        <strong>${faculty.name}</strong>
                        ${faculty.email ? `<div class="text-muted small">${faculty.email}</div>` : ''}
                        <div class="text-muted small mt-1">
                            <strong>Subjects:</strong> ${subjectNames.join(', ')}
                        </div>
                    </div>
                    <button type="button" class="remove-btn" onclick="scheduler.removeFaculty('${faculty.id}')" title="Remove faculty">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }).join('');
    }
    
    // Utility Functions
    getSelectedWorkingDays() {
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        return days.filter(day => document.getElementById(day).checked)
                  .map(day => day.charAt(0).toUpperCase() + day.slice(1));
    }
    
    generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    showAlert(message, type = 'info', duration = 5000) {
        // Remove existing alerts
        const existingAlerts = document.querySelectorAll('.temp-alert');
        existingAlerts.forEach(alert => alert.remove());
        
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show temp-alert`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        // Insert at the top of current step
        const currentStepElement = document.getElementById(`step${this.currentStep}`);
        currentStepElement.insertBefore(alertDiv, currentStepElement.firstChild);
        
        // Auto-dismiss after duration
        if (duration > 0) {
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, duration);
        }
    }
    
    displayConfigurationSummary() {
        const totalSubjects = this.data.subjects.length;
        const totalLectures = this.data.subjects.reduce((sum, subject) => sum + subject.lecturesPerWeek, 0);
        const workingDays = this.data.preferences.workingDays || this.getSelectedWorkingDays();
        
        const summaryHtml = `
            <div class="row">
                <div class="col-md-6">
                    <strong>Institute:</strong> ${this.data.institute.name}<br>
                    <strong>Batches:</strong> ${this.data.batches.length}<br>
                    <strong>Subjects:</strong> ${totalSubjects}<br>
                    <strong>Faculty:</strong> ${this.data.faculty.length}
                </div>
                <div class="col-md-6">
                    <strong>Total Lectures/Week:</strong> ${totalLectures}<br>
                    <strong>Working Days:</strong> ${workingDays.join(', ')}<br>
                    <strong>Working Hours:</strong> ${document.getElementById('startTime').value} - ${document.getElementById('endTime').value}<br>
                    <strong>Break Duration:</strong> ${document.getElementById('breakDuration').value} minutes
                </div>
            </div>
        `;
        
        document.getElementById('summaryContent').innerHTML = summaryHtml;
    }
    
    async generateSchedule() {
        const generateBtn = document.getElementById('generateBtn');
        const loadingSpinner = document.getElementById('loadingSpinner');
        const scheduleDisplay = document.getElementById('scheduleDisplay');
        
        // Show loading state
        generateBtn.style.display = 'none';
        loadingSpinner.style.display = 'block';
        scheduleDisplay.style.display = 'none';
        
        try {
            // Prepare data for the existing backend
            const scheduleData = this.prepareScheduleData();
            
            // Call the existing timetable generator
            const response = await this.callTimetableGenerator(scheduleData);
            
            if (response.success) {
                this.data.schedule = response.schedule;
                this.displaySchedule(response.schedule);
                this.showAlert('Schedule generated successfully!', 'success');
            } else {
                throw new Error(response.error || 'Failed to generate schedule');
            }
            
        } catch (error) {
            console.error('Schedule generation error:', error);
            this.showAlert(`Failed to generate schedule: ${error.message}`, 'danger');
            generateBtn.style.display = 'block';
        } finally {
            loadingSpinner.style.display = 'none';
        }
    }
    
    prepareScheduleData() {
        // Convert our simple data structure to the format expected by the existing backend
        const batches = this.data.batches.map(batch => ({
            id: batch.id,
            name: batch.name,
            subjects: this.data.subjects
                .filter(subject => subject.batchId === batch.id)
                .map(subject => {
                    const faculty = this.data.faculty.find(f => f.subjects.includes(subject.id));
                    return {
                        id: subject.id,
                        name: subject.name,
                        batchId: subject.batchId,
                        lecturesPerWeek: subject.lecturesPerWeek,
                        lectureDuration: subject.lectureDuration,
                        facultyId: faculty ? faculty.id : null
                    };
                })
        }));
        
        const faculty = this.data.faculty.map(f => ({
            id: f.id,
            name: f.name,
            subjects: f.subjects
        }));
        
        const workingDays = this.getSelectedWorkingDays();
        const preferences = {
            workingDays: workingDays,
            workingHours: {
                start: document.getElementById('startTime').value,
                end: document.getElementById('endTime').value
            },
            slotDuration: 60, // Default 1 hour slots
            breakDuration: parseInt(document.getElementById('breakDuration').value) || 15,
            lunchBreak: {
                start: document.getElementById('lunchStart').value,
                end: document.getElementById('lunchEnd').value
            }
        };
        
        return {
            institute: this.data.institute,
            batches: batches,
            faculty: faculty,
            preferences: preferences,
            holidays: [] // No holidays for simple version
        };
    }
    
    async callTimetableGenerator(data) {
        // For now, simulate the API call with a mock response
        // In a real implementation, this would call the existing backend
        return new Promise((resolve) => {
            setTimeout(() => {
                const mockSchedule = this.generateMockSchedule(data);
                resolve({
                    success: true,
                    schedule: mockSchedule
                });
            }, 2000);
        });
    }
    
    generateMockSchedule(data) {
        const timeSlots = this.generateTimeSlots(
            data.preferences.workingHours.start,
            data.preferences.workingHours.end,
            60 // 1 hour slots
        );
        
        const entries = [];
        const workingDays = data.preferences.workingDays;
        
        // Simple scheduling algorithm for demo
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
                batchCount: data.batches.length
            }
        };
    }
    
    generateTimeSlots(startTime, endTime, duration) {
        const slots = [];
        const start = this.timeToMinutes(startTime);
        const end = this.timeToMinutes(endTime);
        const lunchStart = this.timeToMinutes(document.getElementById('lunchStart').value);
        const lunchEnd = this.timeToMinutes(document.getElementById('lunchEnd').value);
        
        for (let time = start; time + duration <= end; time += duration + 15) { // 15 min break
            // Skip lunch time
            if (time >= lunchStart && time < lunchEnd) {
                time = lunchEnd - duration - 15; // Adjust to continue after lunch
                continue;
            }
            
            slots.push({
                start: this.minutesToTime(time),
                end: this.minutesToTime(time + duration)
            });
        }
        
        return slots;
    }
    
    timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }
    
    minutesToTime(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }
    
    displaySchedule(schedule) {
        const scheduleDisplay = document.getElementById('scheduleDisplay');
        const scheduleGrid = document.getElementById('scheduleGrid');
        
        // Generate time slots
        const timeSlots = this.generateTimeSlots(
            this.data.preferences.startTime || document.getElementById('startTime').value,
            this.data.preferences.endTime || document.getElementById('endTime').value,
            60
        );
        
        const workingDays = this.data.preferences.workingDays || this.getSelectedWorkingDays();
        
        // Create schedule grid
        let gridHtml = '';
        
        timeSlots.forEach(slot => {
            gridHtml += '<div class="row border-bottom">';
            gridHtml += `<div class="col-2 time-slot"><strong>${slot.start}</strong></div>`;
            
            workingDays.forEach(day => {
                const dayEntries = schedule.entries.filter(entry => 
                    entry.timeSlot.day === day && entry.timeSlot.startTime === slot.start
                );
                
                gridHtml += '<div class="col-2 time-slot">';
                dayEntries.forEach(entry => {
                    gridHtml += `
                        <div class="schedule-entry">
                            <div class="fw-bold">${entry.subjectName}</div>
                            <div class="small">${entry.batchName}</div>
                            <div class="small text-muted">${entry.facultyName}</div>
                        </div>
                    `;
                });
                gridHtml += '</div>';
            });
            
            gridHtml += '</div>';
        });
        
        scheduleGrid.innerHTML = gridHtml;
        
        // Display statistics
        this.displayScheduleStatistics(schedule);
        
        // Show the schedule
        scheduleDisplay.style.display = 'block';
        document.getElementById('startOverBtn').style.display = 'inline-block';
        document.getElementById('saveTemplateBtn').style.display = 'inline-block';
    }
    
    displayScheduleStatistics(schedule) {
        const stats = {
            totalLectures: schedule.entries.length,
            totalBatches: new Set(schedule.entries.map(e => e.batchId)).size,
            totalFaculty: new Set(schedule.entries.map(e => e.facultyId)).size,
            totalSubjects: new Set(schedule.entries.map(e => e.subjectId)).size
        };
        
        document.getElementById('scheduleStats').innerHTML = `
            <div><strong>Total Lectures:</strong> ${stats.totalLectures}</div>
            <div><strong>Batches:</strong> ${stats.totalBatches}</div>
            <div><strong>Faculty:</strong> ${stats.totalFaculty}</div>
            <div><strong>Subjects:</strong> ${stats.totalSubjects}</div>
        `;
        
        // Display conflicts if any
        if (schedule.conflicts && schedule.conflicts.length > 0) {
            document.getElementById('conflictsAlert').style.display = 'block';
            document.getElementById('conflictsList').innerHTML = schedule.conflicts
                .map(conflict => `<div>• ${conflict.message}</div>`)
                .join('');
        }
        
        // Display suggestions
        const suggestions = [
            'Schedule generated successfully!',
            'All lectures have been assigned time slots.',
            'You can export this schedule in multiple formats.'
        ];
        
        document.getElementById('suggestionsList').innerHTML = suggestions
            .map(suggestion => `<div>• ${suggestion}</div>`)
            .join('');
    }
    
    async exportSchedule(format) {
        if (!this.data.schedule) {
            this.showAlert('No schedule to export.', 'warning');
            return;
        }
        
        try {
            if (format === 'pdf') {
                await this.exportToPDF();
            } else if (format === 'excel') {
                await this.exportToExcel();
            } else {
                this.showAlert('Unsupported export format.', 'warning');
            }
        } catch (error) {
            console.error('Export error:', error);
            this.showAlert(`Failed to export as ${format.toUpperCase()}: ${error.message}`, 'danger');
        }
    }
    
    async exportToPDF() {
        // Create a printable version of the schedule
        const printWindow = window.open('', '_blank');
        const scheduleHTML = this.generatePrintableHTML();
        
        printWindow.document.write(scheduleHTML);
        printWindow.document.close();
        
        // Wait for content to load, then print
        printWindow.onload = function() {
            printWindow.print();
            // Close the window after printing (optional)
            printWindow.onafterprint = function() {
                printWindow.close();
            };
        };
        
        this.showAlert('PDF export opened in new window. Please use your browser\'s print function to save as PDF.', 'success');
    }
    
    async exportToExcel() {
        // Generate CSV data that can be opened in Excel
        const csvData = this.generateCSVData();
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        
        // Create download link
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${this.data.institute.name || 'Schedule'}_Weekly_Timetable.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showAlert('Excel file downloaded successfully! Open the CSV file in Excel.', 'success');
    }
    
    generatePrintableHTML() {
        const instituteName = this.data.institute.name || 'Institute';
        const academicYear = this.data.institute.academicYear || '';
        const generatedDate = new Date().toLocaleDateString();
        
        const workingDays = this.data.preferences.workingDays || this.getSelectedWorkingDays();
        const timeSlots = this.generateTimeSlots(
            this.data.preferences.startTime || document.getElementById('startTime').value,
            this.data.preferences.endTime || document.getElementById('endTime').value,
            60
        );
        
        let scheduleTable = `
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                    <tr style="background-color: #4CAF50; color: white;">
                        <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Time</th>
        `;
        
        workingDays.forEach(day => {
            scheduleTable += `<th style="border: 1px solid #ddd; padding: 12px; text-align: center;">${day}</th>`;
        });
        
        scheduleTable += `
                    </tr>
                </thead>
                <tbody>
        `;
        
        timeSlots.forEach(slot => {
            scheduleTable += `
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: bold; background-color: #f9f9f9;">
                        ${slot.start}
                    </td>
            `;
            
            workingDays.forEach(day => {
                const dayEntries = this.data.schedule.entries.filter(entry => 
                    entry.timeSlot.day === day && entry.timeSlot.startTime === slot.start
                );
                
                scheduleTable += '<td style="border: 1px solid #ddd; padding: 8px; vertical-align: top;">';
                
                dayEntries.forEach(entry => {
                    scheduleTable += `
                        <div style="background-color: #e3f2fd; border-left: 4px solid #2196F3; padding: 4px; margin: 2px 0; border-radius: 4px;">
                            <div style="font-weight: bold; font-size: 12px;">${entry.subjectName}</div>
                            <div style="font-size: 11px; color: #666;">${entry.batchName}</div>
                            <div style="font-size: 10px; color: #888;">${entry.facultyName}</div>
                        </div>
                    `;
                });
                
                scheduleTable += '</td>';
            });
            
            scheduleTable += '</tr>';
        });
        
        scheduleTable += `
                </tbody>
            </table>
        `;
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Weekly Timetable - ${instituteName}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .header h1 { color: #4CAF50; margin-bottom: 5px; }
                    .header p { color: #666; margin: 5px 0; }
                    @media print {
                        body { margin: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${instituteName}</h1>
                    ${academicYear ? `<p><strong>Academic Year:</strong> ${academicYear}</p>` : ''}
                    <p><strong>Weekly Timetable</strong></p>
                    <p>Generated on: ${generatedDate}</p>
                </div>
                
                ${scheduleTable}
                
                <div style="margin-top: 30px; font-size: 12px; color: #666;">
                    <p><strong>Schedule Statistics:</strong></p>
                    <p>Total Lectures: ${this.data.schedule.entries.length}</p>
                    <p>Total Batches: ${new Set(this.data.schedule.entries.map(e => e.batchId)).size}</p>
                    <p>Total Faculty: ${new Set(this.data.schedule.entries.map(e => e.facultyId)).size}</p>
                </div>
            </body>
            </html>
        `;
    }
    
    generateCSVData() {
        const instituteName = this.data.institute.name || 'Institute';
        const academicYear = this.data.institute.academicYear || '';
        const generatedDate = new Date().toLocaleDateString();
        
        let csvContent = `Weekly Timetable - ${instituteName}\n`;
        if (academicYear) csvContent += `Academic Year: ${academicYear}\n`;
        csvContent += `Generated on: ${generatedDate}\n\n`;
        
        // Add schedule data
        csvContent += 'Day,Time,Subject,Batch,Faculty\n';
        
        this.data.schedule.entries
            .sort((a, b) => {
                const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const dayA = dayOrder.indexOf(a.timeSlot.day);
                const dayB = dayOrder.indexOf(b.timeSlot.day);
                
                if (dayA !== dayB) return dayA - dayB;
                return a.timeSlot.startTime.localeCompare(b.timeSlot.startTime);
            })
            .forEach(entry => {
                csvContent += `${entry.timeSlot.day},${entry.timeSlot.startTime}-${entry.timeSlot.endTime},"${entry.subjectName}","${entry.batchName}","${entry.facultyName}"\n`;
            });
        
        // Add summary
        csvContent += '\n\nSchedule Summary\n';
        csvContent += `Total Lectures,${this.data.schedule.entries.length}\n`;
        csvContent += `Total Batches,${new Set(this.data.schedule.entries.map(e => e.batchId)).size}\n`;
        csvContent += `Total Faculty,${new Set(this.data.schedule.entries.map(e => e.facultyId)).size}\n`;
        
        return csvContent;
    }
    
    startOver() {
        if (confirm('Are you sure you want to start over? All current data will be lost.')) {
            // Reset all data
            this.data = {
                institute: {},
                batches: [],
                subjects: [],
                faculty: [],
                preferences: {},
                schedule: null
            };
            
            // Reset to step 1
            document.getElementById(`step${this.currentStep}`).style.display = 'none';
            this.currentStep = 1;
            document.getElementById('step1').style.display = 'block';
            this.updateProgress();
            
            // Clear all forms
            document.querySelectorAll('input, select, textarea').forEach(element => {
                if (element.type === 'checkbox') {
                    element.checked = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(element.id);
                } else if (element.id === 'startTime') {
                    element.value = '08:00';
                } else if (element.id === 'endTime') {
                    element.value = '17:00';
                } else if (element.id === 'lunchStart') {
                    element.value = '12:00';
                } else if (element.id === 'lunchEnd') {
                    element.value = '13:00';
                } else if (element.id === 'breakDuration') {
                    element.value = '15';
                } else if (element.id === 'lecturesPerWeek') {
                    element.value = '3';
                } else if (element.id === 'lectureDuration') {
                    element.value = '60';
                } else {
                    element.value = '';
                }
            });
            
            // Clear dynamic content
            document.getElementById('batchesList').innerHTML = '';
            document.getElementById('subjectsList').innerHTML = '';
            document.getElementById('facultyList').innerHTML = '';
            
            // Reset button states
            document.getElementById('nextToBatches').disabled = true;
            document.getElementById('nextToFaculty').disabled = true;
            document.getElementById('nextToPreferences').disabled = true;
            
            this.showAlert('Started over! You can now create a new schedule.', 'info');
        }
    }
    
    autoSave() {
        // Save current state to localStorage for recovery
        try {
            localStorage.setItem('simpleSchedulerData', JSON.stringify({
                currentStep: this.currentStep,
                data: this.data,
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            console.warn('Could not save to localStorage:', error);
        }
    }
    
    // Template and Data Persistence Methods
    checkForPreviousData() {
        const instituteName = document.getElementById('instituteName').value.trim();
        const contactEmail = document.getElementById('contactEmail').value.trim();
        
        if (!instituteName && !contactEmail) {
            document.getElementById('previousDataSection').style.display = 'none';
            return;
        }
        
        const savedTemplates = this.getSavedTemplates();
        const matchingTemplate = savedTemplates.find(template => 
            (instituteName && template.institute.name.toLowerCase() === instituteName.toLowerCase()) ||
            (contactEmail && template.institute.contactEmail.toLowerCase() === contactEmail.toLowerCase())
        );
        
        if (matchingTemplate) {
            this.currentMatchingTemplate = matchingTemplate;
            document.getElementById('previousDataSection').style.display = 'block';
        } else {
            document.getElementById('previousDataSection').style.display = 'none';
        }
        
        // Show templates button if there are any saved templates
        if (savedTemplates.length > 0) {
            document.getElementById('showTemplatesBtn').style.display = 'inline-block';
        }
    }
    
    loadPreviousData() {
        if (!this.currentMatchingTemplate) return;
        
        const template = this.currentMatchingTemplate;
        
        // Load institute data
        document.getElementById('instituteName').value = template.institute.name || '';
        document.getElementById('academicYear').value = template.institute.academicYear || '';
        document.getElementById('contactEmail').value = template.institute.contactEmail || '';
        document.getElementById('contactPhone').value = template.institute.contactPhone || '';
        
        // Load all data
        this.data = {
            institute: { ...template.institute },
            batches: template.batches.map(batch => ({ ...batch })),
            subjects: template.subjects.map(subject => ({ ...subject })),
            faculty: template.faculty.map(faculty => ({ ...faculty })),
            preferences: { ...template.preferences },
            schedule: null
        };
        
        // Update UI elements
        this.updateUIAfterDataLoad();
        
        // Hide the previous data section
        document.getElementById('previousDataSection').style.display = 'none';
        
        this.showAlert(`Loaded previous data for ${template.institute.name}! You can modify it as needed.`, 'success', 5000);
    }
    
    startFresh() {
        document.getElementById('previousDataSection').style.display = 'none';
        this.currentMatchingTemplate = null;
        this.showAlert('Starting with fresh data.', 'info', 3000);
    }
    
    showSavedTemplates() {
        const savedTemplates = this.getSavedTemplates();
        const templatesSection = document.getElementById('savedTemplatesSection');
        const templatesList = document.getElementById('templatesList');
        
        if (savedTemplates.length === 0) {
            this.showAlert('No saved templates found.', 'info');
            return;
        }
        
        templatesList.innerHTML = savedTemplates.map((template, index) => `
            <div class="col-md-6 mb-3">
                <div class="card template-card">
                    <div class="card-body">
                        <h6 class="card-title">
                            <i class="fas fa-bookmark text-primary me-2"></i>${template.institute.name}
                        </h6>
                        <p class="card-text small text-muted">
                            <i class="fas fa-users me-1"></i>${template.batches.length} batches, 
                            <i class="fas fa-book me-1"></i>${template.subjects.length} subjects, 
                            <i class="fas fa-chalkboard-teacher me-1"></i>${template.faculty.length} faculty<br>
                            <i class="fas fa-calendar me-1"></i>Saved: ${new Date(template.savedAt).toLocaleDateString()}
                        </p>
                        <div class="template-actions">
                            <button class="btn btn-sm btn-primary" onclick="scheduler.loadTemplate(${index})" title="Load this template">
                                <i class="fas fa-download me-1"></i>Load
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="scheduler.deleteTemplate(${index})" title="Delete this template">
                                <i class="fas fa-trash me-1"></i>Delete
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        
        templatesSection.style.display = 'block';
    }
    
    loadTemplate(templateIndex) {
        const savedTemplates = this.getSavedTemplates();
        const template = savedTemplates[templateIndex];
        
        if (!template) {
            this.showAlert('Template not found.', 'danger');
            return;
        }
        
        // Load institute data
        document.getElementById('instituteName').value = template.institute.name || '';
        document.getElementById('academicYear').value = template.institute.academicYear || '';
        document.getElementById('contactEmail').value = template.institute.contactEmail || '';
        document.getElementById('contactPhone').value = template.institute.contactPhone || '';
        
        // Load all data
        this.data = {
            institute: { ...template.institute },
            batches: template.batches.map(batch => ({ ...batch })),
            subjects: template.subjects.map(subject => ({ ...subject })),
            faculty: template.faculty.map(faculty => ({ ...faculty })),
            preferences: { ...template.preferences },
            schedule: null
        };
        
        // Update UI elements
        this.updateUIAfterDataLoad();
        
        // Hide templates section
        document.getElementById('savedTemplatesSection').style.display = 'none';
        
        this.showAlert(`Loaded template: ${template.institute.name}`, 'success', 3000);
    }
    
    deleteTemplate(templateIndex) {
        const savedTemplates = this.getSavedTemplates();
        const template = savedTemplates[templateIndex];
        
        if (!template) return;
        
        if (confirm(`Are you sure you want to delete the template for "${template.institute.name}"?`)) {
            savedTemplates.splice(templateIndex, 1);
            this.saveTemplates(savedTemplates);
            this.showSavedTemplates(); // Refresh the display
            this.showAlert('Template deleted successfully.', 'success', 3000);
        }
    }
    
    saveAsTemplate() {
        if (!this.data.institute.name) {
            this.showAlert('Please enter an institute name before saving as template.', 'warning');
            return;
        }
        
        const templateName = prompt('Enter a name for this template:', this.data.institute.name);
        if (!templateName) return;
        
        const template = {
            name: templateName,
            institute: { ...this.data.institute },
            batches: this.data.batches.map(batch => ({ ...batch })),
            subjects: this.data.subjects.map(subject => ({ ...subject })),
            faculty: this.data.faculty.map(faculty => ({ ...faculty })),
            preferences: { ...this.data.preferences },
            savedAt: new Date().toISOString()
        };
        
        const savedTemplates = this.getSavedTemplates();
        
        // Check if template with same name exists
        const existingIndex = savedTemplates.findIndex(t => 
            t.institute.name.toLowerCase() === template.institute.name.toLowerCase()
        );
        
        if (existingIndex !== -1) {
            if (confirm(`A template for "${template.institute.name}" already exists. Do you want to update it?`)) {
                savedTemplates[existingIndex] = template;
            } else {
                return;
            }
        } else {
            savedTemplates.push(template);
        }
        
        this.saveTemplates(savedTemplates);
        this.showAlert(`Template saved successfully as "${templateName}"!`, 'success', 3000);
    }
    
    getSavedTemplates() {
        try {
            const templates = localStorage.getItem('schedulerTemplates');
            return templates ? JSON.parse(templates) : [];
        } catch (error) {
            console.warn('Could not load templates:', error);
            return [];
        }
    }
    
    saveTemplates(templates) {
        try {
            localStorage.setItem('schedulerTemplates', JSON.stringify(templates));
        } catch (error) {
            console.warn('Could not save templates:', error);
            this.showAlert('Failed to save template. Storage may be full.', 'danger');
        }
    }
    
    updateUIAfterDataLoad() {
        // Update button states
        document.getElementById('nextToBatches').disabled = this.data.batches.length === 0;
        document.getElementById('nextToFaculty').disabled = this.data.subjects.length === 0;
        document.getElementById('nextToPreferences').disabled = this.data.faculty.length === 0;
        
        // Update preferences UI if we're on that step
        if (this.data.preferences.workingDays) {
            this.data.preferences.workingDays.forEach(day => {
                const checkbox = document.getElementById(day.toLowerCase());
                if (checkbox) checkbox.checked = true;
            });
        }
        
        if (this.data.preferences.startTime) {
            const startTimeInput = document.getElementById('startTime');
            if (startTimeInput) startTimeInput.value = this.data.preferences.startTime;
        }
        
        if (this.data.preferences.endTime) {
            const endTimeInput = document.getElementById('endTime');
            if (endTimeInput) endTimeInput.value = this.data.preferences.endTime;
        }
        
        if (this.data.preferences.lunchBreak) {
            const lunchStartInput = document.getElementById('lunchStart');
            const lunchEndInput = document.getElementById('lunchEnd');
            if (lunchStartInput) lunchStartInput.value = this.data.preferences.lunchBreak.start || '12:00';
            if (lunchEndInput) lunchEndInput.value = this.data.preferences.lunchBreak.end || '13:00';
        }
        
        if (this.data.preferences.breakDuration) {
            const breakDurationInput = document.getElementById('breakDuration');
            if (breakDurationInput) breakDurationInput.value = this.data.preferences.breakDuration;
        }
    }
    
    loadSavedData() {
        try {
            const saved = localStorage.getItem('simpleSchedulerData');
            if (saved) {
                const parsedData = JSON.parse(saved);
                const savedTime = new Date(parsedData.timestamp);
                const now = new Date();
                
                // Only restore if saved within last 24 hours
                if (now - savedTime < 24 * 60 * 60 * 1000) {
                    if (confirm('Found previously saved data. Would you like to restore it?')) {
                        this.data = parsedData.data;
                        // Restore UI state would go here
                        this.showAlert('Previous data restored!', 'success');
                    }
                }
            }
        } catch (error) {
            console.warn('Could not load from localStorage:', error);
        }
    }
}

// Global functions for HTML onclick handlers
let scheduler;

function nextStep() {
    scheduler.nextStep();
}

function prevStep() {
    scheduler.prevStep();
}

function addBatch() {
    scheduler.addBatch();
}

function addSubject() {
    scheduler.addSubject();
}

function addFaculty() {
    scheduler.addFaculty();
}

function generateSchedule() {
    scheduler.generateSchedule();
}

function exportSchedule(format) {
    scheduler.exportSchedule(format);
}

function startOver() {
    scheduler.startOver();
}

// Initialize the scheduler when the page loads
document.addEventListener('DOMContentLoaded', function() {
    scheduler = new SimpleScheduler();
    scheduler.loadSavedData();
});