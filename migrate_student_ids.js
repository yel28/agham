const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateStudentIds() {
  try {
    console.log('Starting student ID migration...');
    
    // Get all students from the current collection
    const studentsSnapshot = await db.collection('users/students/students').get();
    
    if (studentsSnapshot.empty) {
      console.log('No students found to migrate.');
      return;
    }
    
    console.log(`Found ${studentsSnapshot.size} students to migrate.`);
    
    const batch = db.batch();
    const newStudents = [];
    
    // Process each student and create new documents with simplified IDs
    let index = 0;
    studentsSnapshot.forEach((doc) => {
      const studentData = doc.data();
      index++;
      const newId = `student${index.toString().padStart(3, '0')}`; // student001, student002, etc.
      
      console.log(`Migrating ${doc.id} -> ${newId}`);
      
      // Add the new student document to batch
      const newStudentRef = db.collection('users/students/students').doc(newId);
      batch.set(newStudentRef, {
        ...studentData,
        // Update any LRN-related fields if they exist
        studentId: newId,
        originalId: doc.id, // Keep reference to original ID
        migratedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      newStudents.push({ oldId: doc.id, newId, data: studentData });
    });
    
    // Commit the batch to create new documents
    await batch.commit();
    console.log('New student documents created successfully!');
    
    // Now delete the old documents
    console.log('Deleting old student documents...');
    const deleteBatch = db.batch();
    
    studentsSnapshot.forEach((doc) => {
      deleteBatch.delete(doc.ref);
    });
    
    await deleteBatch.commit();
    console.log('Old student documents deleted successfully!');
    
    // Update any references in other collections if needed
    console.log('Updating references in other collections...');
    
    // Update sections collection if it references students
    const sectionsSnapshot = await db.collection('users/sections/sections').get();
    if (!sectionsSnapshot.empty) {
      const sectionBatch = db.batch();
      
      sectionsSnapshot.forEach((sectionDoc) => {
        const sectionData = sectionDoc.data();
        let updated = false;
        const newData = { ...sectionData };
        
        // Update student references in section data
        if (sectionData.students && Array.isArray(sectionData.students)) {
          newData.students = sectionData.students.map(studentRef => {
            const oldStudentId = studentRef.split('/').pop();
            const studentIndex = newStudents.findIndex(s => s.oldId === oldStudentId);
            if (studentIndex !== -1) {
              updated = true;
              return `users/students/students/${newStudents[studentIndex].newId}`;
            }
            return studentRef;
          });
        }
        
        if (updated) {
          sectionBatch.update(sectionDoc.ref, newData);
        }
      });
      
      await sectionBatch.commit();
      console.log('Section references updated successfully!');
    }
    
    console.log('Migration completed successfully!');
    console.log('Summary:');
    newStudents.forEach(({ oldId, newId }) => {
      console.log(`  ${oldId} -> ${newId}`);
    });
    
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

// Run the migration
migrateStudentIds()
  .then(() => {
    console.log('Migration script completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
