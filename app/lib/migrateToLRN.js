import { db, collection, getDocs, doc, setDoc, deleteDoc, studentsCollection } from '../../lib/firebase';

/**
 * Migrate existing students to use LRN as document ID
 * WARNING: This will delete old documents and create new ones with LRN as ID
 */
export const migrateToLRN = async () => {
  try {
    console.log('Starting migration to LRN-based document IDs...');
    
    // Get all existing students
    const studentsSnapshot = await getDocs(studentsCollection());
    const students = studentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const student of students) {
      // Skip if no LRN or if already using LRN as ID
      if (!student.lrn || student.id === student.lrn) {
        skippedCount++;
        continue;
      }
      
      try {
        // Create new document with LRN as ID
        await setDoc(doc(studentsCollection(), student.lrn), {
          ...student,
          // Remove the old id field
          id: undefined
        });
        
        // Delete old document
        await deleteDoc(doc(studentsCollection(), student.id));
        
        migratedCount++;
        console.log(`Migrated student: ${student.firstName} ${student.lastName} (LRN: ${student.lrn})`);
      } catch (error) {
        console.error(`Error migrating student ${student.firstName} ${student.lastName}:`, error);
      }
    }
    
    console.log(`Migration complete! Migrated: ${migratedCount}, Skipped: ${skippedCount}`);
    return { migratedCount, skippedCount };
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
};

/**
 * Check if any students need migration
 */
export const checkMigrationNeeded = async () => {
  try {
    const studentsSnapshot = await getDocs(studentsCollection());
    const students = studentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    const needsMigration = students.filter(student => 
      student.lrn && student.id !== student.lrn
    );
    
    return {
      totalStudents: students.length,
      needsMigration: needsMigration.length,
      students: needsMigration
    };
  } catch (error) {
    console.error('Error checking migration status:', error);
    throw error;
  }
};
