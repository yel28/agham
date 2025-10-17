// Firebase Database Migration Script
// This script helps migrate from the old messy structure to the new clean structure

const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://agham-ff2f5-default-rtdb.firebaseio.com"
});

const db = admin.firestore();

// Migration functions
class FirebaseMigration {
  constructor() {
    this.batch = db.batch();
    this.batchCount = 0;
    this.maxBatchSize = 500; // Firestore batch limit
  }

  // Helper function to generate clean IDs
  generateCleanId(prefix, data) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${prefix}_${timestamp}_${random}`;
  }

  // Helper function to commit batch
  async commitBatch() {
    if (this.batchCount > 0) {
      await this.batch.commit();
      this.batch = db.batch();
      this.batchCount = 0;
      console.log('Batch committed successfully');
    }
  }

  // Helper function to add to batch
  addToBatch(ref, data) {
    this.batch.set(ref, data);
    this.batchCount++;
    
    if (this.batchCount >= this.maxBatchSize) {
      return this.commitBatch();
    }
  }

  // 1. Migrate Students
  async migrateStudents() {
    console.log('🔄 Migrating students...');
    
    try {
      const studentsSnapshot = await db.collection('students').get();
      let migratedCount = 0;

      for (const doc of studentsSnapshot.docs) {
        const studentData = doc.data();
        const newId = this.generateCleanId('student', studentData);
        
        const newStudentData = {
          lrn: studentData.lrn || '',
          firstName: studentData.firstName || '',
          lastName: studentData.lastName || '',
          middleName: studentData.middleName || '',
          username: studentData.username || '',
          address: studentData.address || '',
          contact: studentData.contact || '',
          gender: studentData.gender || '',
          gradeLevel: studentData.gradeLevel || '',
          parentName: studentData.parentName || '',
          dateOfEnrollment: studentData.dateOfEnrollment || new Date(),
          status: studentData.status || 'active',
          sectionId: studentData.sectionId || null,
          createdAt: studentData.createdAt || new Date(),
          updatedAt: new Date()
        };

        const newRef = db.collection('users').doc('students').collection('students').doc(newId);
        this.addToBatch(newRef, newStudentData);
        migratedCount++;

        // Also create a mapping for reference
        const mappingRef = db.collection('migration_mappings').doc(`student_${doc.id}`);
        this.addToBatch(mappingRef, {
          oldId: doc.id,
          newId: newId,
          type: 'student',
          migratedAt: new Date()
        });
      }

      await this.commitBatch();
      console.log(`✅ Migrated ${migratedCount} students`);
      
    } catch (error) {
      console.error('❌ Error migrating students:', error);
    }
  }

  // 2. Migrate Sections
  async migrateSections() {
    console.log('🔄 Migrating sections...');
    
    try {
      const sectionsSnapshot = await db.collection('sections').get();
      let migratedCount = 0;

      for (const doc of sectionsSnapshot.docs) {
        const sectionData = doc.data();
        const newId = this.generateCleanId('section', sectionData);
        
        const newSectionData = {
          name: sectionData.name || '',
          description: sectionData.description || '',
          gradeLevel: sectionData.gradeLevel || '',
          maxStudents: sectionData.maxStudents || 40,
          currentStudents: sectionData.currentStudents || 0,
          teacherId: sectionData.teacherId || null,
          createdAt: sectionData.createdAt || new Date(),
          updatedAt: new Date()
        };

        const newRef = db.collection('academic').doc('sections').collection('sections').doc(newId);
        this.addToBatch(newRef, newSectionData);
        migratedCount++;

        // Create mapping
        const mappingRef = db.collection('migration_mappings').doc(`section_${doc.id}`);
        this.addToBatch(mappingRef, {
          oldId: doc.id,
          newId: newId,
          type: 'section',
          migratedAt: new Date()
        });
      }

      await this.commitBatch();
      console.log(`✅ Migrated ${migratedCount} sections`);
      
    } catch (error) {
      console.error('❌ Error migrating sections:', error);
    }
  }

  // 3. Migrate Quizzes
  async migrateQuizzes() {
    console.log('🔄 Migrating quizzes...');
    
    try {
      const quizzesSnapshot = await db.collection('quizzes').get();
      let migratedCount = 0;

      for (const doc of quizzesSnapshot.docs) {
        const quizData = doc.data();
        const newId = this.generateCleanId('quiz', quizData);
        
        const newQuizData = {
          title: quizData.title || '',
          description: quizData.description || '',
          subjectId: quizData.subjectId || null,
          gradeLevel: quizData.gradeLevel || '',
          questions: quizData.questions || [],
          timeLimit: quizData.timeLimit || 30,
          totalPoints: quizData.totalPoints || 100,
          status: quizData.status || 'active',
          createdBy: quizData.createdBy || null,
          createdAt: quizData.createdAt || new Date(),
          updatedAt: new Date()
        };

        const newRef = db.collection('assessments').doc('quizzes').collection('quizzes').doc(newId);
        this.addToBatch(newRef, newQuizData);
        migratedCount++;

        // Create mapping
        const mappingRef = db.collection('migration_mappings').doc(`quiz_${doc.id}`);
        this.addToBatch(mappingRef, {
          oldId: doc.id,
          newId: newId,
          type: 'quiz',
          migratedAt: new Date()
        });
      }

      await this.commitBatch();
      console.log(`✅ Migrated ${migratedCount} quizzes`);
      
    } catch (error) {
      console.error('❌ Error migrating quizzes:', error);
    }
  }

  // 4. Migrate Admin Activity Logs
  async migrateAdminActivity() {
    console.log('🔄 Migrating admin activity logs...');
    
    try {
      const activitySnapshot = await db.collection('admin_activity').get();
      let migratedCount = 0;

      for (const doc of activitySnapshot.docs) {
        const activityData = doc.data();
        const newId = this.generateCleanId('log', activityData);
        
        const newActivityData = {
          userId: activityData.adminId || '',
          action: activityData.action || '',
          targetType: this.getTargetType(activityData.action),
          targetId: activityData.details?.targetAdminId || activityData.details?.targetStudentId || null,
          details: activityData.details || {},
          ipAddress: activityData.ipAddress || null,
          timestamp: activityData.timestamp || new Date()
        };

        const newRef = db.collection('system').doc('activity_logs').collection('logs').doc(newId);
        this.addToBatch(newRef, newActivityData);
        migratedCount++;
      }

      await this.commitBatch();
      console.log(`✅ Migrated ${migratedCount} activity logs`);
      
    } catch (error) {
      console.error('❌ Error migrating admin activity:', error);
    }
  }

  // Helper function to determine target type from action
  getTargetType(action) {
    if (action.includes('admin')) return 'admin';
    if (action.includes('student')) return 'student';
    if (action.includes('quiz')) return 'quiz';
    if (action.includes('section')) return 'section';
    return 'unknown';
  }

  // 5. Create System Settings
  async createSystemSettings() {
    console.log('🔄 Creating system settings...');
    
    try {
      const schoolInfoRef = db.collection('system').doc('settings').collection('settings').doc('school_info');
      this.addToBatch(schoolInfoRef, {
        name: 'AGHAM School',
        address: '123 School Street, City, State',
        phone: '+1-234-567-8900',
        email: 'info@agham.edu',
        website: 'https://agham.edu',
        createdAt: new Date()
      });

      const systemConfigRef = db.collection('system').doc('settings').collection('settings').doc('system_config');
      this.addToBatch(systemConfigRef, {
        maxStudentsPerSection: 40,
        defaultQuizTimeLimit: 30,
        allowStudentRegistration: true,
        allowTeacherRegistration: false,
        requireEmailVerification: true,
        createdAt: new Date()
      });

      await this.commitBatch();
      console.log('✅ System settings created');
      
    } catch (error) {
      console.error('❌ Error creating system settings:', error);
    }
  }

  // 6. Update Student Section References
  async updateStudentSectionReferences() {
    console.log('🔄 Updating student section references...');
    
    try {
      // This would need to be done after both students and sections are migrated
      // to update the sectionId references with new IDs
      console.log('⚠️  This step requires manual review after migration');
      
    } catch (error) {
      console.error('❌ Error updating section references:', error);
    }
  }

  // Run all migrations
  async runMigration() {
    console.log('🚀 Starting Firebase migration...');
    console.log('⚠️  Make sure to backup your data before running this migration!');
    
    try {
      await this.migrateStudents();
      await this.migrateSections();
      await this.migrateQuizzes();
      await this.migrateAdminActivity();
      await this.createSystemSettings();
      
      console.log('🎉 Migration completed successfully!');
      console.log('📋 Next steps:');
      console.log('1. Review the migrated data');
      console.log('2. Update your application code to use new structure');
      console.log('3. Test all functionality');
      console.log('4. Archive old collections');
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
    }
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  const migration = new FirebaseMigration();
  migration.runMigration().then(() => {
    console.log('Migration process completed');
    process.exit(0);
  }).catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

module.exports = FirebaseMigration;
