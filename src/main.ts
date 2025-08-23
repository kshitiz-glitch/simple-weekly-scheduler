#!/usr/bin/env node

/**
 * Main entry point for the Automated Timetable Generator
 * This is a simplified version that demonstrates basic functionality
 */

import { DayOfWeek, ScheduleEntry } from './models';

console.log('🎓 Automated Timetable Generator v2.0.0');
console.log('=====================================');

async function main() {
  try {
    console.log('📊 Creating sample timetable data...');
    
    // Create sample schedule entries
    const sampleEntries: ScheduleEntry[] = [
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
    
    console.log(`✅ Created ${sampleEntries.length} schedule entries`);
    
    // Display basic statistics
    console.log('\\n📈 Schedule Statistics:');
    console.log(`Total Entries: ${sampleEntries.length}`);
    console.log(`Batches: ${new Set(sampleEntries.map(e => e.batchId)).size}`);
    console.log(`Subjects: ${new Set(sampleEntries.map(e => e.subjectId)).size}`);
    console.log(`Faculty: ${new Set(sampleEntries.map(e => e.facultyId)).size}`);
    
    // Display schedule by day
    console.log('\\n📋 Generated Timetable:');
    console.log('========================');
    
    const days = [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY];
    
    for (const day of days) {
      const dayEntries = sampleEntries.filter(entry => entry.timeSlot.day === day);
      if (dayEntries.length > 0) {
        console.log(`\\n${day}:`);
        dayEntries
          .sort((a, b) => a.timeSlot.startTime.localeCompare(b.timeSlot.startTime))
          .forEach(entry => {
            console.log(`  ${entry.timeSlot.startTime}-${entry.timeSlot.endTime}: ${entry.subjectId} (${entry.batchId}) - ${entry.facultyId}`);
          });
      }
    }
    
    // Display by batch
    console.log('\\n📚 Schedule by Batch:');
    console.log('=====================');
    
    const batches = new Set(sampleEntries.map(e => e.batchId));
    for (const batchId of batches) {
      console.log(`\\n${batchId}:`);
      const batchEntries = sampleEntries.filter(e => e.batchId === batchId);
      batchEntries
        .sort((a, b) => {
          const dayOrder = Object.values(DayOfWeek).indexOf(a.timeSlot.day) - Object.values(DayOfWeek).indexOf(b.timeSlot.day);
          return dayOrder !== 0 ? dayOrder : a.timeSlot.startTime.localeCompare(b.timeSlot.startTime);
        })
        .forEach(entry => {
          console.log(`  ${entry.timeSlot.day} ${entry.timeSlot.startTime}-${entry.timeSlot.endTime}: ${entry.subjectId} - ${entry.facultyId}`);
        });
    }
    
    // Check for conflicts
    console.log('\\n🔍 Conflict Analysis:');
    console.log('=====================');
    
    const conflicts = [];
    
    // Check for faculty conflicts (same faculty, same time)
    for (let i = 0; i < sampleEntries.length; i++) {
      for (let j = i + 1; j < sampleEntries.length; j++) {
        const entry1 = sampleEntries[i];
        const entry2 = sampleEntries[j];
        
        if (entry1.facultyId === entry2.facultyId && 
            entry1.timeSlot.day === entry2.timeSlot.day &&
            entry1.timeSlot.startTime === entry2.timeSlot.startTime) {
          conflicts.push(`Faculty conflict: ${entry1.facultyId} assigned to both ${entry1.batchId} and ${entry2.batchId} at ${entry1.timeSlot.day} ${entry1.timeSlot.startTime}`);
        }
        
        // Check for batch conflicts (same batch, same time)
        if (entry1.batchId === entry2.batchId && 
            entry1.timeSlot.day === entry2.timeSlot.day &&
            entry1.timeSlot.startTime === entry2.timeSlot.startTime) {
          conflicts.push(`Batch conflict: ${entry1.batchId} has overlapping subjects at ${entry1.timeSlot.day} ${entry1.timeSlot.startTime}`);
        }
      }
    }
    
    if (conflicts.length === 0) {
      console.log('✅ No conflicts detected!');
    } else {
      console.log(`⚠️  Found ${conflicts.length} conflicts:`);
      conflicts.forEach(conflict => console.log(`  - ${conflict}`));
    }
    
    console.log('\\n✅ Timetable generation completed successfully!');
    console.log('\\n💡 This is a basic demonstration of the timetable generator.');
    console.log('   For advanced features like automatic generation, optimization,');
    console.log('   and export options, the full system implementation is available.');
    
    // Show next steps
    console.log('\\n🚀 Next Steps:');
    console.log('  1. Use CSV input files for larger datasets');
    console.log('  2. Configure working hours and days');
    console.log('  3. Set up holiday exclusions');
    console.log('  4. Export to multiple formats (JSON, CSV, HTML)');
    console.log('  5. Use interactive conflict resolution');
    
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the main function
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { main };