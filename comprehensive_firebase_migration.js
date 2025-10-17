// Comprehensive Firebase Database Migration Script
// This script fixes all structural issues and migrates to the clean structure

const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://agham-ff2f5-default-rtdb.firebaseio.com"
});

const db = admin.firestore();

class ComprehensiveFirebaseMigration {
  constructor() {
    this.batch = db.batch();
    this.batchCount = 0;
    this.maxBatchSize = 500;
    this.migrationLog = [];
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

  // Log migration activity
  logActivity(action, details) {
    this.migrationLog.push({
      timestamp: new Date(),
      action,
      details
    });
    console.log(`📝 ${action}: ${details}`);
  }

  // 1. BACKUP EXISTING DATA
  async backupExistingData() {
    console.log('🔄 Creating backup of existing data...');
    
    try {
      const backupData = {
        students: [],
        sections: [],
        quizzes: [],
        admins: [],
        admin_activity: [],
        notifications: [],
        teacher_credentials: [],
        assignments: [],
        deleted_students: [],
        deleted_quizzes: [],
        deleted_admins: []
      };

      // Backup all collections
      for (const collectionName of Object.keys(backupData)) {
        try {
          const snapshot = await db.collection(collectionName).get();
          backupData[collectionName] = snapshot.docs.map(doc => ({
            id: doc.id,
            data: doc.data()
          }));
          console.log(`📦 Backed up ${snapshot.size} documents from ${collectionName}`);
        } catch (error) {
          console.log(`⚠️  Collection ${collectionName} not found or empty`);
        }
      }

      // Save backup
      const backupRef = db.collection('migration_backup').doc('backup_' + Date.now());
      await backupRef.set({
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        data: backupData,
        version: '1.0'
      });

      this.logActivity('backup_created', `Backed up data to migration_backup collection`);
      console.log('✅ Data backup completed successfully');
      
    } catch (error) {
      console.error('❌ Error creating backup:', error);
      throw error;
    }
  }

  // 2. MIGRATE STUDENTS TO CLEAN STRUCTURE
  async migrateStudents() {
    console.log('🔄 Migrating students to clean structure...');
    
    try {
      const studentsSnapshot = await db.collection('students').get();
      let migratedCount = 0;
      const sectionMappings = {};

      for (const doc of studentsSnapshot.docs) {
        const studentData = doc.data();
        const newId = this.generateCleanId('student', studentData);
        
        // Normalize student data
        const cleanStudentData = {
          lrn: studentData.lrn || studentData.LRN || '',
          firstName: studentData.firstName || studentData.first_name || '',
          lastName: studentData.lastName || studentData.last_name || '',
          middleName: studentData.middleName || studentData.middle_name || '',
          username: studentData.userName || studentData.username || studentData.user_name || '',
          address: studentData.address || '',
          contact: studentData.contact || studentData.phone || '',
          gender: studentData.gender || '',
          gradeLevel: studentData.gradeLevel || studentData.grade_level || '',
          parentName: studentData.parentGuardianName || studentData.parentName || studentData.parent_name || '',
          dateOfEnrollment: studentData.dateOfEnrollment || studentData.date_of_enrollment || new Date(),
          status: studentData.currentStatus || studentData.status || 'active',
          sectionId: studentData.sectionId || null,
          avatar: studentData.avatar || '/avatar3.png',
          createdAt: studentData.createdAt || new Date(),
          updatedAt: new Date(),
          createdBy: studentData.createdBy || 'system'
        };

        // Store section mapping for later reference
        if (studentData.sectionId) {
          sectionMappings[studentData.sectionId] = studentData.sectionId;
        }

        const newRef = db.collection('users').doc('students').collection('students').doc(newId);
        this.addToBatch(newRef, cleanStudentData);
        migratedCount++;

        // Create mapping for reference
        const mappingRef = db.collection('migration_mappings').doc(`student_${doc.id}`);
        this.addToBatch(mappingRef, {
          oldId: doc.id,
          newId: newId,
          type: 'student',
          migratedAt: new Date()
        });
      }

      await this.commitBatch();
      this.logActivity('students_migrated', `Migrated ${migratedCount} students`);
      console.log(`✅ Migrated ${migratedCount} students`);
      
      return sectionMappings;
      
    } catch (error) {
      console.error('❌ Error migrating students:', error);
      throw error;
    }
  }

  // 3. MIGRATE SECTIONS TO CLEAN STRUCTURE
  async migrateSections(sectionMappings = {}) {
    console.log('🔄 Migrating sections to clean structure...');
    
    try {
      const sectionsSnapshot = await db.collection('sections').get();
      let migratedCount = 0;
      const newSectionMappings = {};

      for (const doc of sectionsSnapshot.docs) {
        const sectionData = doc.data();
        const newId = this.generateCleanId('section', sectionData);
        
        // Normalize section data
        const cleanSectionData = {
          name: sectionData.name || '',
          description: sectionData.description || '',
          gradeLevel: sectionData.gradeLevel || sectionData.grade_level || 'Grade 7',
          maxStudents: sectionData.maxStudents || sectionData.max_students || 40,
          currentStudents: sectionData.studentCount || sectionData.currentStudents || 0,
          teacherId: sectionData.teacherId || sectionData.teacher_id || null,
          createdAt: sectionData.createdAt || new Date(),
          updatedAt: new Date(),
          createdBy: sectionData.createdBy || 'system'
        };

        const newRef = db.collection('academic').doc('sections').collection('sections').doc(newId);
        this.addToBatch(newRef, cleanSectionData);
        migratedCount++;

        // Store new mapping
        newSectionMappings[doc.id] = newId;

        // Create mapping for reference
        const mappingRef = db.collection('migration_mappings').doc(`section_${doc.id}`);
        this.addToBatch(mappingRef, {
          oldId: doc.id,
          newId: newId,
          type: 'section',
          migratedAt: new Date()
        });
      }

      await this.commitBatch();
      this.logActivity('sections_migrated', `Migrated ${migratedCount} sections`);
      console.log(`✅ Migrated ${migratedCount} sections`);
      
      return newSectionMappings;
      
    } catch (error) {
      console.error('❌ Error migrating sections:', error);
      throw error;
    }
  }

  // 4. UPDATE STUDENT SECTION REFERENCES
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
            updatedAt: new Date()
          }, { merge: true });
          
          updatedCount++;
        }
      }

      await this.commitBatch();
      this.logActivity('section_references_updated', `Updated ${updatedCount} student section references`);
      console.log(`✅ Updated ${updatedCount} student section references`);
      
    } catch (error) {
      console.error('❌ Error updating section references:', error);
      throw error;
    }
  }

  // 5. MIGRATE QUIZZES TO CLEAN STRUCTURE
  async migrateQuizzes() {
    console.log('🔄 Migrating quizzes to clean structure...');
    
    try {
      const quizzesSnapshot = await db.collection('quizzes').get();
      let migratedCount = 0;

      for (const doc of quizzesSnapshot.docs) {
        const quizData = doc.data();
        const newId = this.generateCleanId('quiz', quizData);
        
        // Normalize quiz data
        const cleanQuizData = {
          title: quizData.title || '',
          description: quizData.description || '',
          subjectId: quizData.subjectId || quizData.subject_id || null,
          gradeLevel: quizData.gradeLevel || quizData.grade_level || '',
          questions: quizData.questions || [],
          timeLimit: quizData.timeLimit || quizData.time_limit || 30,
          totalPoints: quizData.totalPoints || quizData.total_points || 100,
          status: quizData.status || 'active',
          isCustom: quizData.isCustom || false,
          category: quizData.category || 'General',
          createdBy: quizData.createdBy || 'system',
          createdAt: quizData.createdAt || new Date(),
          updatedAt: new Date()
        };

        const newRef = db.collection('assessments').doc('quizzes').collection('quizzes').doc(newId);
        this.addToBatch(newRef, cleanQuizData);
        migratedCount++;

        // Create mapping for reference
        const mappingRef = db.collection('migration_mappings').doc(`quiz_${doc.id}`);
        this.addToBatch(mappingRef, {
          oldId: doc.id,
          newId: newId,
          type: 'quiz',
          migratedAt: new Date()
        });
      }

      await this.commitBatch();
      this.logActivity('quizzes_migrated', `Migrated ${migratedCount} quizzes`);
      console.log(`✅ Migrated ${migratedCount} quizzes`);
      
    } catch (error) {
      console.error('❌ Error migrating quizzes:', error);
      throw error;
    }
  }

  // 6. MIGRATE ADMINS TO CLEAN STRUCTURE
  async migrateAdmins() {
    console.log('🔄 Migrating admins to clean structure...');
    
    try {
      const adminsSnapshot = await db.collection('admins').get();
      let migratedCount = 0;

      for (const doc of adminsSnapshot.docs) {
        const adminData = doc.data();
        const newId = this.generateCleanId('admin', adminData);
        
        // Normalize admin data
        const cleanAdminData = {
          email: adminData.email || '',
          name: adminData.name || adminData.fullName || '',
          role: adminData.role || 'admin',
          status: adminData.status || 'active',
          permissions: adminData.permissions || {},
          createdAt: adminData.createdAt || new Date(),
          updatedAt: new Date(),
          lastLogin: adminData.lastLogin || null
        };

        const newRef = db.collection('users').doc('admins').collection('admins').doc(newId);
        this.addToBatch(newRef, cleanAdminData);
        migratedCount++;

        // Create mapping for reference
        const mappingRef = db.collection('migration_mappings').doc(`admin_${doc.id}`);
        this.addToBatch(mappingRef, {
          oldId: doc.id,
          newId: newId,
          type: 'admin',
          migratedAt: new Date()
        });
      }

      await this.commitBatch();
      this.logActivity('admins_migrated', `Migrated ${migratedCount} admins`);
      console.log(`✅ Migrated ${migratedCount} admins`);
      
    } catch (error) {
      console.error('❌ Error migrating admins:', error);
      throw error;
    }
  }

  // 7. MIGRATE TEACHER CREDENTIALS
  async migrateTeacherCredentials() {
    console.log('🔄 Migrating teacher credentials...');
    
    try {
      const credentialsSnapshot = await db.collection('teacher_credentials').get();
      let migratedCount = 0;

      for (const doc of credentialsSnapshot.docs) {
        const credData = doc.data();
        const newId = this.generateCleanId('teacher', credData);
        
        // Normalize teacher data
        const cleanTeacherData = {
          email: credData.email || '',
          name: credData.name || credData.fullName || '',
          role: 'teacher',
          status: 'active',
          subjects: credData.subjects || [],
          createdAt: credData.createdAt || new Date(),
          updatedAt: new Date(),
          lastLogin: credData.lastLogin || null
        };

        const newRef = db.collection('users').doc('teachers').collection('teachers').doc(newId);
        this.addToBatch(newRef, cleanTeacherData);
        migratedCount++;

        // Create mapping for reference
        const mappingRef = db.collection('migration_mappings').doc(`teacher_${doc.id}`);
        this.addToBatch(mappingRef, {
          oldId: doc.id,
          newId: newId,
          type: 'teacher',
          migratedAt: new Date()
        });
      }

      await this.commitBatch();
      this.logActivity('teachers_migrated', `Migrated ${migratedCount} teachers`);
      console.log(`✅ Migrated ${migratedCount} teachers`);
      
    } catch (error) {
      console.error('❌ Error migrating teachers:', error);
      throw error;
    }
  }

  // 8. MIGRATE ACTIVITY LOGS
  async migrateActivityLogs() {
    console.log('🔄 Migrating activity logs...');
    
    try {
      const activitySnapshot = await db.collection('admin_activity').get();
      let migratedCount = 0;

      for (const doc of activitySnapshot.docs) {
        const activityData = doc.data();
        const newId = this.generateCleanId('log', activityData);
        
        // Normalize activity data
        const cleanActivityData = {
          userId: activityData.adminId || activityData.userId || '',
          action: activityData.action || '',
          targetType: this.getTargetType(activityData.action),
          targetId: activityData.details?.targetAdminId || activityData.details?.targetStudentId || null,
          details: activityData.details || {},
          ipAddress: activityData.ipAddress || null,
          timestamp: activityData.timestamp || new Date()
        };

        const newRef = db.collection('system').doc('activity_logs').collection('logs').doc(newId);
        this.addToBatch(newRef, cleanActivityData);
        migratedCount++;
      }

      await this.commitBatch();
      this.logActivity('activity_logs_migrated', `Migrated ${migratedCount} activity logs`);
      console.log(`✅ Migrated ${migratedCount} activity logs`);
      
    } catch (error) {
      console.error('❌ Error migrating activity logs:', error);
      throw error;
    }
  }

  // Helper function to determine target type from action
  getTargetType(action) {
    if (action.includes('admin')) return 'admin';
    if (action.includes('student')) return 'student';
    if (action.includes('quiz')) return 'quiz';
    if (action.includes('section')) return 'section';
    if (action.includes('teacher')) return 'teacher';
    return 'unknown';
  }

  // 9. MIGRATE NOTIFICATIONS
  async migrateNotifications() {
    console.log('🔄 Migrating notifications...');
    
    try {
      const notificationsSnapshot = await db.collection('notifications').get();
      let migratedCount = 0;

      for (const doc of notificationsSnapshot.docs) {
        const notificationData = doc.data();
        const newId = this.generateCleanId('notification', notificationData);
        
        // Normalize notification data
        const cleanNotificationData = {
          userId: notificationData.teacherEmail || notificationData.userId || '',
          type: notificationData.type || 'general',
          title: notificationData.title || '',
          message: notificationData.message || '',
          isRead: notificationData.isRead || false,
          details: notificationData.details || {},
          createdAt: notificationData.createdAt || new Date()
        };

        const newRef = db.collection('system').doc('notifications').collection('notifications').doc(newId);
        this.addToBatch(newRef, cleanNotificationData);
        migratedCount++;
      }

      await this.commitBatch();
      this.logActivity('notifications_migrated', `Migrated ${migratedCount} notifications`);
      console.log(`✅ Migrated ${migratedCount} notifications`);
      
    } catch (error) {
      console.error('❌ Error migrating notifications:', error);
      throw error;
    }
  }

  // 10. MIGRATE ASSIGNMENTS
  async migrateAssignments() {
    console.log('🔄 Migrating assignments...');
    
    try {
      const assignmentsSnapshot = await db.collection('assignments').get();
      let migratedCount = 0;

      for (const doc of assignmentsSnapshot.docs) {
        const assignmentData = doc.data();
        const newId = this.generateCleanId('assignment', assignmentData);
        
        // Normalize assignment data
        const cleanAssignmentData = {
          quizId: assignmentData.quizId || assignmentData.quiz_id || '',
          assignedTo: assignmentData.assignedTo || assignmentData.assigned_to || [],
          startTime: assignmentData.startTime || assignmentData.start_time || null,
          dueDate: assignmentData.dueDate || assignmentData.due_date || null,
          attempts: assignmentData.attempts || 1,
          status: assignmentData.status || 'active',
          createdBy: assignmentData.createdBy || 'system',
          createdAt: assignmentData.createdAt || new Date(),
          updatedAt: new Date()
        };

        const newRef = db.collection('assessments').doc('assignments').collection('assignments').doc(newId);
        this.addToBatch(newRef, cleanAssignmentData);
        migratedCount++;
      }

      await this.commitBatch();
      this.logActivity('assignments_migrated', `Migrated ${migratedCount} assignments`);
      console.log(`✅ Migrated ${migratedCount} assignments`);
      
    } catch (error) {
      console.error('❌ Error migrating assignments:', error);
      throw error;
    }
  }

  // 11. CREATE SYSTEM SETTINGS
  async createSystemSettings() {
    console.log('🔄 Creating system settings...');
    
    try {
      // School info
      const schoolInfoRef = db.collection('system').doc('settings').collection('settings').doc('school_info');
      this.addToBatch(schoolInfoRef, {
        name: 'AGHAM School',
        address: '123 School Street, City, State',
        phone: '+1-234-567-8900',
        email: 'info@agham.edu',
        website: 'https://agham.edu',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // System config
      const systemConfigRef = db.collection('system').doc('settings').collection('settings').doc('system_config');
      this.addToBatch(systemConfigRef, {
        maxStudentsPerSection: 40,
        defaultQuizTimeLimit: 30,
        allowStudentRegistration: true,
        allowTeacherRegistration: false,
        requireEmailVerification: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await this.commitBatch();
      this.logActivity('system_settings_created', 'System settings created');
      console.log('✅ System settings created');
      
    } catch (error) {
      console.error('❌ Error creating system settings:', error);
      throw error;
    }
  }

  // 12. ARCHIVE OLD COLLECTIONS
  async archiveOldCollections() {
    console.log('🔄 Archiving old collections...');
    
    try {
      const collectionsToArchive = [
        'students',
        'sections', 
        'quizzes',
        'admin_activity',
        'notifications',
        'admins',
        'teacher_credentials',
        'assignments'
      ];

      for (const collectionName of collectionsToArchive) {
        try {
          const snapshot = await db.collection(collectionName).get();
          if (snapshot.size > 0) {
            // Move to archive
            const archiveRef = db.collection('archive').doc('old_collections').collection(collectionName);
            
            for (const doc of snapshot.docs) {
              const archiveDocRef = archiveRef.doc(doc.id);
              this.addToBatch(archiveDocRef, {
                originalData: doc.data(),
                archivedAt: admin.firestore.FieldValue.serverTimestamp(),
                originalCollection: collectionName
              });
            }
            
            console.log(`📦 Archived ${snapshot.size} documents from ${collectionName}`);
          }
        } catch (error) {
          console.log(`⚠️  Collection ${collectionName} not found or already archived`);
        }
      }

      await this.commitBatch();
      this.logActivity('old_collections_archived', 'Old collections archived');
      console.log('✅ Old collections archived');
      
    } catch (error) {
      console.error('❌ Error archiving old collections:', error);
      throw error;
    }
  }

  // 13. CREATE MIGRATION SUMMARY
  async createMigrationSummary() {
    console.log('🔄 Creating migration summary...');
    
    try {
      const summaryRef = db.collection('system').doc('migration_summary').collection('summaries').doc('comprehensive_migration_' + Date.now());
      
      const summary = {
        migrationType: 'comprehensive_restructure',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'completed',
        log: this.migrationLog,
        newStructure: {
          users: {
            students: 'users/students/students',
            admins: 'users/admins/admins',
            teachers: 'users/teachers/teachers'
          },
          academic: {
            sections: 'academic/sections/sections'
          },
          assessments: {
            quizzes: 'assessments/quizzes/quizzes',
            assignments: 'assessments/assignments/assignments'
          },
          system: {
            activity_logs: 'system/activity_logs/logs',
            notifications: 'system/notifications/notifications',
            settings: 'system/settings/settings'
          },
          archive: {
            old_collections: 'archive/old_collections'
          }
        }
      };

      await summaryRef.set(summary);
      this.logActivity('migration_summary_created', 'Migration summary created');
      console.log('✅ Migration summary created');
      
    } catch (error) {
      console.error('❌ Error creating migration summary:', error);
      throw error;
    }
  }

  // Run complete migration
  async runComprehensiveMigration() {
    console.log('🚀 Starting comprehensive Firebase migration...');
    console.log('⚠️  This will restructure your entire database!');
    console.log('📋 Migration steps:');
    console.log('1. Backup existing data');
    console.log('2. Migrate students to clean structure');
    console.log('3. Migrate sections to clean structure');
    console.log('4. Update student section references');
    console.log('5. Migrate quizzes to clean structure');
    console.log('6. Migrate admins to clean structure');
    console.log('7. Migrate teacher credentials');
    console.log('8. Migrate activity logs');
    console.log('9. Migrate notifications');
    console.log('10. Migrate assignments');
    console.log('11. Create system settings');
    console.log('12. Archive old collections');
    console.log('13. Create migration summary');
    console.log('');
    
    try {
      // Step 1: Backup
      await this.backupExistingData();
      
      // Step 2: Migrate students
      const sectionMappings = await this.migrateStudents();
      
      // Step 3: Migrate sections
      const newSectionMappings = await this.migrateSections();
      
      // Step 4: Update student section references
      await this.updateStudentSectionReferences(newSectionMappings);
      
      // Step 5: Migrate quizzes
      await this.migrateQuizzes();
      
      // Step 6: Migrate admins
      await this.migrateAdmins();
      
      // Step 7: Migrate teacher credentials
      await this.migrateTeacherCredentials();
      
      // Step 8: Migrate activity logs
      await this.migrateActivityLogs();
      
      // Step 9: Migrate notifications
      await this.migrateNotifications();
      
      // Step 10: Migrate assignments
      await this.migrateAssignments();
      
      // Step 11: Create system settings
      await this.createSystemSettings();
      
      // Step 12: Archive old collections
      await this.archiveOldCollections();
      
      // Step 13: Create migration summary
      await this.createMigrationSummary();
      
      console.log('🎉 Comprehensive migration completed successfully!');
      console.log('\n📊 What was accomplished:');
      console.log('✅ All data backed up safely');
      console.log('✅ Students migrated to clean structure');
      console.log('✅ Sections migrated to clean structure');
      console.log('✅ Student-section references updated');
      console.log('✅ Quizzes migrated to clean structure');
      console.log('✅ Admins migrated to clean structure');
      console.log('✅ Teachers migrated to clean structure');
      console.log('✅ Activity logs migrated');
      console.log('✅ Notifications migrated');
      console.log('✅ Assignments migrated');
      console.log('✅ System settings created');
      console.log('✅ Old collections archived');
      console.log('✅ Migration summary created');
      console.log('\n🔗 Check your Firebase Console to see the new clean structure!');
      console.log('\n📋 Next steps:');
      console.log('1. Update your application code to use the new structure');
      console.log('2. Test all functionality');
      console.log('3. Update Firebase security rules');
      console.log('4. Remove old collection references from your code');
      
    } catch (error) {
      console.error('❌ Comprehensive migration failed:', error);
      console.log('\n🆘 If migration failed:');
      console.log('1. Check the error message above');
      console.log('2. Check your Firebase Console for any issues');
      console.log('3. Review the migration logs in migration_mappings collection');
      console.log('4. Restore from backup if needed');
      throw error;
    }
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  const migration = new ComprehensiveFirebaseMigration();
  migration.runComprehensiveMigration().then(() => {
    console.log('✨ Comprehensive migration process completed!');
    process.exit(0);
  }).catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

module.exports = ComprehensiveFirebaseMigration;
