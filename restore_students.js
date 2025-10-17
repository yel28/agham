const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccount = require('./service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function restoreStudents() {
  try {
    console.log('Restoring students from backup...');
    
    // Find the latest backup file
    const backupFiles = fs.readdirSync('.').filter(file => file.startsWith('students_backup_') && file.endsWith('.json'));
    if (backupFiles.length === 0) {
      console.log('No backup files found.');
      return;
    }
    
    const latestBackup = backupFiles.sort().pop();
    console.log(`Using backup file: ${latestBackup}`);
    
    // Read backup data
    const backupData = JSON.parse(fs.readFileSync(latestBackup, 'utf8'));
    console.log(`Found ${backupData.length} students in backup.`);
    
    // Clear current students collection
    console.log('Clearing current students collection...');
    const currentStudents = await db.collection('users/students/students').get();
    const deleteBatch = db.batch();
    currentStudents.forEach(doc => {
      deleteBatch.delete(doc.ref);
    });
    await deleteBatch.commit();
    
    // Restore students
    console.log('Restoring students...');
    const restoreBatch = db.batch();
    
    backupData.forEach(({ id, data }) => {
      const studentRef = db.collection('users/students/students').doc(id);
      restoreBatch.set(studentRef, data);
    });
    
    await restoreBatch.commit();
    console.log('Students restored successfully!');
    
  } catch (error) {
    console.error('Error during restore:', error);
  }
}

// Run the restore
restoreStudents()
  .then(() => {
    console.log('Restore completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Restore failed:', error);
    process.exit(1);
  });
