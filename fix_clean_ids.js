// Fix Clean IDs Script
// This script regenerates all data with clean, readable IDs

const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://agham-ff2f5-default-rtdb.firebaseio.com"
});

const db = admin.firestore();

class CleanIdFixer {
  constructor() {
    this.batch = db.batch();
    this.batchCount = 0;
    this.maxBatchSize = 500;
  }

  // Helper function to commit batch
  async commitBatch() {
    if (this.batchCount > 0) {
      await this.batch.commit();
      this.batch = db.batch();
      this.batchCount = 0;
      console.log('✅ Batch committed successfully');
    }
  }

  // Helper function to add to batch
  addToBatch(ref, data, options = {}) {
    if (options.merge) {
      this.batch.set(ref, data, { merge: true });
    } else {
      this.batch.set(ref, data);
    }
    this.batchCount++;
    
    if (this.batchCount >= this.maxBatchSize) {
      return this.commitBatch();
    }
  }

  // Helper function to generate clean IDs
  generateCleanId(prefix, data = {}) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${prefix}_${timestamp}_${random}`;
  }

  // 1. Fix Students with Clean IDs
  async fixStudents() {
    console.log('🔄 Fixing students with clean IDs...');
    
    try {
      const studentsSnapshot = await db.collection('users').doc('students').collection('students').get();
      let fixedCount = 0;

      for (const doc of studentsSnapshot.docs) {
        const studentData = doc.data();
        const newId = this.generateCleanId('student', studentData);
        
        // Create new document with clean ID
        const newRef = db.collection('users').doc('students').collection('students').doc(newId);
        this.addToBatch(newRef, {
          ...studentData,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Delete old document (we'll do this separately)
        // const oldRef = db.collection('users').doc('students').collection('students').doc(doc.id);
        // this.addToBatch(oldRef, admin.firestore.FieldValue.delete());
        
        fixedCount++;
        console.log(`   📝 Fixed student: ${studentData.firstName} ${studentData.lastName} (${doc.id} → ${newId})`);
      }

      await this.commitBatch();
      console.log(`✅ Fixed ${fixedCount} students with clean IDs`);
      
    } catch (error) {
      console.error('❌ Error fixing students:', error);
      throw error;
    }
  }

  // 2. Fix Sections with Clean IDs
  async fixSections() {
    console.log('🔄 Fixing sections with clean IDs...');
    
    try {
      const sectionsSnapshot = await db.collection('academic').doc('sections').collection('sections').get();
      let fixedCount = 0;
      const sectionMappings = {};

      for (const doc of sectionsSnapshot.docs) {
        const sectionData = doc.data();
        const newId = this.generateCleanId('section', sectionData);
        
        // Store mapping for updating student references
        sectionMappings[doc.id] = newId;
        
        // Create new document with clean ID
        const newRef = db.collection('academic').doc('sections').collection('sections').doc(newId);
        this.addToBatch(newRef, {
          ...sectionData,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Delete old document (we'll do this separately)
        // const oldRef = db.collection('academic').doc('sections').collection('sections').doc(doc.id);
        // this.addToBatch(oldRef, admin.firestore.FieldValue.delete());
        
        fixedCount++;
        console.log(`   📝 Fixed section: ${sectionData.name || 'Unnamed'} (${doc.id} → ${newId})`);
      }

      await this.commitBatch();
      console.log(`✅ Fixed ${fixedCount} sections with clean IDs`);
      
      return sectionMappings;
      
    } catch (error) {
      console.error('❌ Error fixing sections:', error);
      throw error;
    }
  }

  // 3. Update Student Section References
  async updateStudentSectionReferences(sectionMappings) {
    console.log('🔄 Updating student section references...');
    
    try {
      const studentsSnapshot = await db.collection('users').doc('students').collection('students').get();
      let updatedCount = 0;

      for (const doc of studentsSnapshot.docs) {
        const studentData = doc.data();
        
        if (studentData.sectionId && sectionMappings[studentData.sectionId]) {
          const newSectionId = sectionMappings[studentData.sectionId];
          const studentRef = db.collection('users').doc('students').collection('students').doc(doc.id);
          
          this.addToBatch(studentRef, {
            sectionId: newSectionId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
          
          updatedCount++;
          console.log(`   📝 Updated student ${studentData.firstName} ${studentData.lastName} section reference`);
        }
      }

      await this.commitBatch();
      console.log(`✅ Updated ${updatedCount} student section references`);
      
    } catch (error) {
      console.error('❌ Error updating section references:', error);
      throw error;
    }
  }

  // 4. Fix Quizzes with Clean IDs
  async fixQuizzes() {
    console.log('🔄 Fixing quizzes with clean IDs...');
    
    try {
      const quizzesSnapshot = await db.collection('assessments').doc('quizzes').collection('quizzes').get();
      let fixedCount = 0;

      for (const doc of quizzesSnapshot.docs) {
        const quizData = doc.data();
        const newId = this.generateCleanId('quiz', quizData);
        
        // Create new document with clean ID
        const newRef = db.collection('assessments').doc('quizzes').collection('quizzes').doc(newId);
        this.addToBatch(newRef, {
          ...quizData,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Delete old document (we'll do this separately)
        // const oldRef = db.collection('assessments').doc('quizzes').collection('quizzes').doc(doc.id);
        // this.addToBatch(oldRef, admin.firestore.FieldValue.delete());
        
        fixedCount++;
        console.log(`   📝 Fixed quiz: ${quizData.title || 'Unnamed'} (${doc.id} → ${newId})`);
      }

      await this.commitBatch();
      console.log(`✅ Fixed ${fixedCount} quizzes with clean IDs`);
      
    } catch (error) {
      console.error('❌ Error fixing quizzes:', error);
      throw error;
    }
  }

  // 5. Clean up old documents
  async cleanupOldDocuments() {
    console.log('🔄 Cleaning up old documents...');
    
    try {
      // Clean up old students
      const studentsSnapshot = await db.collection('users').doc('students').collection('students').get();
      for (const doc of studentsSnapshot.docs) {
        if (!doc.id.startsWith('student_')) {
          await doc.ref.delete();
          console.log(`   🗑️  Deleted old student: ${doc.id}`);
        }
      }
      
      // Clean up old sections
      const sectionsSnapshot = await db.collection('academic').doc('sections').collection('sections').get();
      for (const doc of sectionsSnapshot.docs) {
        if (!doc.id.startsWith('section_')) {
          await doc.ref.delete();
          console.log(`   🗑️  Deleted old section: ${doc.id}`);
        }
      }
      
      // Clean up old quizzes
      const quizzesSnapshot = await db.collection('assessments').doc('quizzes').collection('quizzes').get();
      for (const doc of quizzesSnapshot.docs) {
        if (!doc.id.startsWith('quiz_')) {
          await doc.ref.delete();
          console.log(`   🗑️  Deleted old quiz: ${doc.id}`);
        }
      }
      
      console.log('✅ Old documents cleaned up');
      
    } catch (error) {
      console.error('❌ Error cleaning up old documents:', error);
      throw error;
    }
  }

  // Run complete fix
  async runCleanIdFix() {
    console.log('🚀 Starting clean ID fix...');
    console.log('⚠️  This will regenerate all documents with clean, readable IDs!');
    console.log('');
    
    try {
      // Step 1: Fix sections first (so we can update student references)
      const sectionMappings = await this.fixSections();
      
      // Step 2: Fix students
      await this.fixStudents();
      
      // Step 3: Update student section references
      await this.updateStudentSectionReferences(sectionMappings);
      
      // Step 4: Fix quizzes
      await this.fixQuizzes();
      
      // Step 5: Clean up old documents
      await this.cleanupOldDocuments();
      
      console.log('');
      console.log('🎉 Clean ID fix completed successfully!');
      console.log('');
      console.log('📊 What was accomplished:');
      console.log('✅ All students now have clean, readable IDs');
      console.log('✅ All sections now have clean, readable IDs');
      console.log('✅ All quizzes now have clean, readable IDs');
      console.log('✅ Student section references updated');
      console.log('✅ Old documents cleaned up');
      console.log('');
      console.log('🔗 Check your Firebase Console to see the clean IDs!');
      console.log('');
      console.log('📋 New ID format:');
      console.log('   Students: student_xxxxx_xxxxx');
      console.log('   Sections: section_xxxxx_xxxxx');
      console.log('   Quizzes: quiz_xxxxx_xxxxx');
      
    } catch (error) {
      console.error('❌ Clean ID fix failed:', error);
      throw error;
    }
  }
}

// Run fix if this file is executed directly
if (require.main === module) {
  const fixer = new CleanIdFixer();
  fixer.runCleanIdFix().then(() => {
    console.log('✨ Clean ID fix process completed!');
    process.exit(0);
  }).catch((error) => {
    console.error('Clean ID fix failed:', error);
    process.exit(1);
  });
}

module.exports = CleanIdFixer;
