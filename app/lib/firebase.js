// Updated Firebase Configuration - Now uses clean structure
// This file has been updated to use the new clean database structure

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, collectionGroup, getDocs, getDoc, query, where, doc, setDoc, updateDoc, onSnapshot, addDoc, deleteDoc, orderBy, limit, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'; 

const firebaseConfig = {
  apiKey: "AIzaSyAky7OMzUKnrdk53hXFmaNn0pGctxlwHt0",
  authDomain: "agham-ff2f5.firebaseapp.com",
  projectId: "agham-ff2f5",
  storageBucket: "agham-ff2f5.firebasestorage.app",
  messagingSenderId: "558175716350",
  appId: "1:558175716350:web:384a2b7660e003c0e2f6af",
  measurementId: "G-WNCTBLEDZ0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); 

// ========================================
// CLEAN COLLECTION REFERENCES
// ========================================

// Students collection (clean structure)
export const studentsCollection = () => collection(db, 'users', 'students', 'students');

// Sections collection (clean structure)
export const sectionsCollection = () => collection(db, 'academic', 'sections', 'sections');

// Quizzes collection (renamed to quizzestopic)
export const quizzesCollection = () => collection(db, 'assessments', 'quizzes', 'quizzestopic');

// Leaderboard collection (one document per section)
export const leaderboardCollection = () => collection(db, 'leaderboard');

// Admins collection (clean structure)
export const adminsCollection = () => collection(db, 'users', 'admins', 'admins');

// Teachers collection (clean structure)
export const teachersCollection = () => collection(db, 'users', 'teachers', 'teachers');

// Notifications collection (clean structure)
export const notificationsCollection = () => collection(db, 'system', 'notifications', 'notifications');

// Activity logs collection (clean structure)
export const activityLogsCollection = () => collection(db, 'system', 'activity_logs', 'logs');

// Assignments collection (clean structure)
export const assignmentsCollection = () => collection(db, 'assessments', 'assignments', 'assignments');

// Set or clear a per-student quiz-unlock boolean field
export const setStudentQuizUnlock = async (studentId, fieldName, value = true) => {
  try {
    if (!studentId || !fieldName) throw new Error('Missing studentId or fieldName');
    const studentRef = doc(studentsCollection(), studentId);
    await updateDoc(studentRef, { [fieldName]: value, updatedAt: serverTimestamp() });
  } catch (error) {
    console.error('Error setting student quiz unlock:', error);
    throw error;
  }
};

// ========================================
// STUDENT MANAGEMENT FUNCTIONS
// ========================================

// Get all students
export const getAllStudents = async () => {
  try {
    const snapshot = await getDocs(studentsCollection());
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting students:', error);
    throw error;
  }
};

// Get students by section
export const getStudentsBySection = async (sectionId) => {
  try {
    const q = query(
      studentsCollection(),
      where('sectionId', '==', sectionId),
      orderBy('lastName', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting students by section:', error);
    throw error;
  }
};

// Update student quiz completion and progress
export const updateStudentQuizCompletion = async (studentId, quizId, quizTitle, score) => {
  try {
    if (!studentId || !quizId) throw new Error('Missing studentId or quizId');
    
    const studentRef = doc(studentsCollection(), studentId);
    
    // Add completed quiz to student's quizzes array
    const completedQuiz = {
      quizId: quizId,
      quizTitle: quizTitle,
      score: score,
      completedAt: new Date(),
      status: 'completed'
    };
    
    await updateDoc(studentRef, {
      quizzes: arrayUnion(completedQuiz),
      updatedAt: serverTimestamp()
    });
    
    console.log(`Student ${studentId} completed quiz ${quizTitle} with score ${score}%`);
    return true;
  } catch (error) {
    console.error('Error updating student quiz completion:', error);
    throw error;
  }
};

// Add new student
export const addStudent = async (studentData) => {
  try {
    // Build an identity signature to detect exact duplicates across key fields
    const normalize = (v) => (v || '').toString().trim().toLowerCase();
    const identitySignature = [
      normalize(studentData.firstName),
      normalize(studentData.middleName),
      normalize(studentData.lastName),
      normalize(studentData.userName),
      normalize(studentData.lrn),
      normalize(studentData.gender),
      normalize(studentData.gradeLevel),
      normalize(studentData.dateOfEnrollment),
      normalize(studentData.currentStatus),
    ].join('|');

    // Check for exact duplicate by identitySignature (if any stored)
    const existingBySignature = query(
      studentsCollection(),
      where('identitySignature', '==', identitySignature)
    );
    const existingBySignatureSnap = await getDocs(existingBySignature);
    if (!existingBySignatureSnap.empty) {
      return { success: false, error: 'Duplicate: identical student record already exists', type: 'duplicate' };
    }

    // Check for duplicates by LRN
    if (studentData.lrn) {
      const existingStudentQuery = query(
        studentsCollection(), 
        where('lrn', '==', studentData.lrn)
      );
      const existingStudentSnapshot = await getDocs(existingStudentQuery);
      if (!existingStudentSnapshot.empty) {
        return { success: false, error: `Duplicate: LRN ${studentData.lrn} already exists`, type: 'duplicate' };
      }
    }
    
    // Check for duplicates by userName
    if (studentData.userName) {
      const existingByUsername = query(
        studentsCollection(),
        where('userName', '==', studentData.userName)
      );
      const existingByUsernameSnap = await getDocs(existingByUsername);
      if (!existingByUsernameSnap.empty) {
        return { success: false, error: `Duplicate: Username ${studentData.userName} already exists`, type: 'duplicate' };
      }
    }
    
    // Generate clean ID
    const cleanId = await generateCleanId('student', studentData);
    
    // Check if a doc with the same ID already exists
    const existingDoc = await getDoc(doc(studentsCollection(), cleanId));
    if (existingDoc.exists()) {
      return { success: false, error: `Duplicate: ID ${cleanId} already exists`, type: 'duplicate' };
    }

    // Use setDoc with the clean ID instead of addDoc
    const studentRef = doc(studentsCollection(), cleanId);
    await setDoc(studentRef, {
      ...studentData,
      identitySignature,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { success: true, id: cleanId };
  } catch (error) {
    console.error('Error adding student:', error);
    return { success: false, error: error.message, type: 'error' };
  }
};

// Update student
export const updateStudent = async (studentId, updateData) => {
  try {
    const studentRef = doc(studentsCollection(), studentId);
    await updateDoc(studentRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating student:', error);
    throw error;
  }
};

// Delete student (move to archive)
export const deleteStudent = async (studentId, deletedBy) => {
  try {
    // Get student data first
    const studentRef = doc(studentsCollection(), studentId);
    const studentDoc = await getDoc(studentRef);
    
    if (studentDoc.exists()) {
      const studentData = studentDoc.data();
      
      // Read quizResults first so we can archive them
      let quizResultsBackup = [];
      try {
        const quizResultsRef = collection(db, 'users', 'students', 'students', studentId, 'quizResults');
        const quizResultsSnap = await getDocs(quizResultsRef);
        quizResultsBackup = quizResultsSnap.docs.map(d => ({ id: d.id, data: d.data() }));
      } catch (subErr) {
        console.warn('Warning: failed to read quizResults for archiving', studentId, subErr);
      }

      // Add to archive (include quizResults backup)
      await addDoc(collection(db, 'archive', 'deleted_users', 'students'), {
        originalId: studentId,
        deletedAt: serverTimestamp(),
        deletedBy: deletedBy,
        data: studentData,
        quizResults: quizResultsBackup
      });
      
      // Recursively delete subcollections (e.g., quizResults)
      try {
        const quizResultsRef = collection(db, 'users', 'students', 'students', studentId, 'quizResults');
        const quizResultsSnap = await getDocs(quizResultsRef);
        const deletions = quizResultsSnap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletions);
      } catch (subErr) {
        console.warn('Warning: failed to delete quizResults for', studentId, subErr);
      }

      // Delete from main collection
      await deleteDoc(studentRef);
    }
  } catch (error) {
    console.error('Error deleting student:', error);
    throw error;
  }
};

// Restore student (including quizResults) from archive
export const restoreStudent = async (studentId, restoredBy) => {
  try {
    // Find the archive record by originalId
    const q = query(collection(db, 'archive', 'deleted_users', 'students'), where('originalId', '==', studentId));
    let snap = await getDocs(q);
    let archivedDoc = null;
    let archivedData = null;
    let source = 'archive_deleted_users';
    if (!snap.empty) {
      archivedDoc = snap.docs[0];
      archivedData = archivedDoc.data() || {};
    } else {
      // Fallback: legacy deleted_students collection
      const q2 = query(collection(db, 'deleted_students'), where('originalId', '==', studentId));
      const snap2 = await getDocs(q2);
      if (snap2.empty) throw new Error('Archived record not found');
      archivedDoc = snap2.docs[0];
      archivedData = archivedDoc.data() || {};
      source = 'deleted_students';
    }

    // Restore student document
    const studentRef = doc(studentsCollection(), studentId);
    await setDoc(studentRef, {
      ...(archivedData.data || {}),
      restoredAt: serverTimestamp(),
      restoredBy: restoredBy || 'system'
    });

    // Restore quizResults if any
    const quizResults = Array.isArray(archivedData.quizResults) ? archivedData.quizResults : [];
    if (quizResults.length > 0) {
      const quizResultsRef = collection(db, 'users', 'students', 'students', studentId, 'quizResults');
      await Promise.all(
        quizResults.map((qr) => setDoc(doc(quizResultsRef, qr.id), qr.data || {}))
      );
    }

    // Optionally remove archive record
    // Remove archive record from the source collection
    await deleteDoc(archivedDoc.ref);
    return true;
  } catch (err) {
    console.error('Error restoring student:', err);
    throw err;
  }
};

// ========================================
// SECTION MANAGEMENT FUNCTIONS
// ========================================

// Get all sections
export const getAllSections = async () => {
  try {
    const snapshot = await getDocs(sectionsCollection());
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting sections:', error);
    throw error;
  }
};

// Add new section
export const addSection = async (sectionData) => {
  try {
    // Generate clean ID
    const cleanId = await generateCleanId('section', sectionData);
    
    // Use setDoc with the clean ID instead of addDoc
    const sectionRef = doc(sectionsCollection(), cleanId);
    await setDoc(sectionRef, {
      ...sectionData,
      currentStudents: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return cleanId;
  } catch (error) {
    console.error('Error adding section:', error);
    throw error;
  }
};

// Update section
export const updateSection = async (sectionId, updateData) => {
  try {
    const sectionRef = doc(sectionsCollection(), sectionId);
    await updateDoc(sectionRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating section:', error);
    throw error;
  }
};

// Delete section permanently
export const deleteSection = async (sectionId) => {
  try {
    if (!sectionId) {
      throw new Error('Section ID is required');
    }
    
    // Try direct path approach
    const sectionRef = doc(db, 'academic', 'sections', 'sections', sectionId);
    console.log('Deleting section with ID:', sectionId);
    console.log('Section reference path:', sectionRef.path);
    
    // Check if document exists first
    const { getDoc } = await import('firebase/firestore');
    const sectionDoc = await getDoc(sectionRef);
    console.log('Section document exists:', sectionDoc.exists());
    
    if (!sectionDoc.exists()) {
      throw new Error('Section document does not exist');
    }
    
    await deleteDoc(sectionRef);
    console.log('Section deleted successfully');
  } catch (error) {
    console.error('Error deleting section:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      sectionId: sectionId
    });
    throw error;
  }
};

// ========================================
// QUIZ MANAGEMENT FUNCTIONS
// ========================================

// Get all quizzes
export const getAllQuizzes = async () => {
  try {
    const snapshot = await getDocs(quizzesCollection());
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting quizzes:', error);
    throw error;
  }
};

// Add new quiz
export const addQuiz = async (quizData) => {
  try {
    // Generate clean ID
    const cleanId = generateCleanId('quiz', quizData);
    
    // Use setDoc with the clean ID instead of addDoc
    const quizRef = doc(quizzesCollection(), cleanId);
    await setDoc(quizRef, {
      ...quizData,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return cleanId;
  } catch (error) {
    console.error('Error adding quiz:', error);
    throw error;
  }
};

// Update quiz
export const updateQuiz = async (quizId, updateData) => {
  try {
    const quizRef = doc(quizzesCollection(), quizId);
    await updateDoc(quizRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating quiz:', error);
    throw error;
  }
};

// ========================================
// ADMIN MANAGEMENT FUNCTIONS
// ========================================

// Get all admins
export const getAllAdmins = async () => {
  try {
    const snapshot = await getDocs(adminsCollection());
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting admins:', error);
    throw error;
  }
};

// Get admin by email
export const getAdminByEmail = async (email) => {
  try {
    const q = query(adminsCollection(), where('email', '==', email));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting admin by email:', error);
    throw error;
  }
};

// ========================================
// TEACHER MANAGEMENT FUNCTIONS
// ========================================

// Get all teachers
export const getAllTeachers = async () => {
  try {
    const snapshot = await getDocs(teachersCollection());
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting teachers:', error);
    throw error;
  }
};

// Get teacher by email
export const getTeacherByEmail = async (email) => {
  try {
    const q = query(teachersCollection(), where('email', '==', email));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting teacher by email:', error);
    throw error;
  }
};

// ========================================
// NOTIFICATION FUNCTIONS
// ========================================

// Get notifications for user
export const getNotificationsForUser = async (userId) => {
  try {
    const q = query(
      notificationsCollection(),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting notifications:', error);
    throw error;
  }
};

// Add notification
export const addNotification = async (notificationData) => {
  try {
    const docRef = await addDoc(notificationsCollection(), {
      ...notificationData,
      isRead: false,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding notification:', error);
    throw error;
  }
};

// ========================================
// LEADERBOARD HELPERS
// ========================================

// Upsert leaderboard entries for a section (top 10 performers)
export const setLeaderboardForSection = async (sectionId, entries) => {
  try {
    const docId = sectionId || 'all';
    const lbRef = doc(leaderboardCollection(), docId);
    await setDoc(lbRef, {
      sectionId: docId,
      entries: Array.isArray(entries) ? entries : [],
      updatedAt: serverTimestamp()
    }, { merge: true });
    return true;
  } catch (error) {
    console.error('Error setting leaderboard:', error);
    throw error;
  }
};

// ========================================
// REAL-TIME LISTENERS
// ========================================

// Listen to students in real-time
export const listenToStudents = (callback) => {
  return onSnapshot(studentsCollection(), (snapshot) => {
    const students = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(students);
  });
};

// Listen to sections in real-time
export const listenToSections = (callback) => {
  return onSnapshot(sectionsCollection(), (snapshot) => {
    const sections = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(sections);
  });
};

// Listen to quizzes in real-time
export const listenToQuizzes = (callback) => {
  return onSnapshot(quizzesCollection(), (snapshot) => {
    const quizzes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(quizzes);
  });
};

// Listen to admins in real-time
export const listenToAdmins = (callback) => {
  return onSnapshot(adminsCollection(), (snapshot) => {
    const admins = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(admins);
  });
};

// Listen to notifications in real-time
export const listenToNotifications = (userId, callback) => {
  const q = query(
    notificationsCollection(),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(notifications);
  });
};

// ========================================
// LEGACY SUPPORT (for gradual migration)
// ========================================

// Legacy collection references (for backward compatibility during migration)
export const legacyStudentsCollection = () => collection(db, 'students');
export const legacySectionsCollection = () => collection(db, 'sections');
export const legacyQuizzesCollection = () => collection(db, 'quizzes');
export const legacyAdminsCollection = () => collection(db, 'admins');
export const legacyNotificationsCollection = () => collection(db, 'notifications');

// ========================================
// UTILITY FUNCTIONS
// ========================================

// Generate clean ID
export const generateCleanId = async (prefix, data = {}) => {
  if (prefix === 'student') {
    // Use the studentId from form data if available
    if (data.studentId && data.studentId.trim()) {
      return data.studentId.trim();
    }
    
    // PRIORITY 1: Use userName if available (e.g., "Student001")
    if (data.userName && data.userName.trim()) {
      return data.userName.trim();
    }
    
    // Allow callers (like bulk import) to force sequential IDs even if LRN exists
    if (data.preferSequential === true) {
      const studentsSnapshot = await getDocs(studentsCollection());
      const existingIds = studentsSnapshot.docs.map(doc => doc.id);
      let nextNumber = 1;
      while (existingIds.includes(`student${String(nextNumber).padStart(3, '0')}`)) {
        nextNumber++;
      }
      return `student${String(nextNumber).padStart(3, '0')}`;
    }
    
    // PRIORITY 2: Use LRN as fallback if no userName
    if (data.lrn && data.lrn.trim()) {
      return `student_${data.lrn.trim()}`;
    }
    
    // Get the next sequential student ID with better conflict handling
    const studentsSnapshot = await getDocs(studentsCollection());
    const existingIds = studentsSnapshot.docs.map(doc => doc.id);
    
    let nextNumber = 1;
    while (existingIds.includes(`student${String(nextNumber).padStart(3, '0')}`)) {
      nextNumber++;
    }
    
    return `student${String(nextNumber).padStart(3, '0')}`;
  } else if (prefix === 'section') {
    // Get the next available section ID (A, B, C, etc.)
    const sectionsSnapshot = await getDocs(sectionsCollection());
    const existingSections = sectionsSnapshot.docs.map(doc => doc.id);
    
    // Find the next available letter
    let nextLetter = 'A';
    for (let i = 0; i < 26; i++) { // Support up to 26 sections (A-Z)
      const letter = String.fromCharCode(65 + i);
      const sectionId = `section_${letter}`;
      if (!existingSections.includes(sectionId)) {
        nextLetter = letter;
        break;
      }
    }
    return `section_${nextLetter}`;
  } else {
    // For other types, use the original random format
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${prefix}_${timestamp}_${random}`;
  }
};

// ========================================
// MODULE PERMISSIONS FUNCTIONS
// ========================================

// Get module permissions for a quarter
export const getModulePermissions = async (quarter = 'quarter_1') => {
  try {
    const permissionsRef = collection(db, 'modules', quarter, 'permissions');
    const snapshot = await getDocs(permissionsRef);
    const permissions = {};
    snapshot.docs.forEach(doc => {
      permissions[doc.id] = doc.data();
    });
    return permissions;
  } catch (error) {
    console.error('Error getting module permissions:', error);
    throw error;
  }
};

// Set module lock status
export const setModuleLockStatus = async (moduleName, isLocked, quarter = 'quarter_1') => {
  try {
    const moduleRef = doc(db, 'modules', quarter, 'permissions', moduleName);
    await setDoc(moduleRef, {
      locked: isLocked,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error('Error setting module lock status:', error);
    throw error;
  }
};

// Get specific module lock status
export const getModuleLockStatus = async (moduleName, quarter = 'quarter_1') => {
  try {
    const moduleRef = doc(db, 'modules', quarter, 'permissions', moduleName);
    const moduleDoc = await getDoc(moduleRef);
    if (moduleDoc.exists()) {
      return moduleDoc.data().locked || false;
    }
    return false; // Default to locked if no data exists
  } catch (error) {
    console.error('Error getting module lock status:', error);
    throw error;
  }
};

// Initialize module permissions for a quarter
export const initializeModulePermissions = async (quarter = 'quarter_1') => {
  try {
    const modules = ['mixtures', 'gravity', 'circulatory', 'volcano'];
    const batch = [];
    
    for (const moduleName of modules) {
      const moduleRef = doc(db, 'modules', quarter, 'permissions', moduleName);
      batch.push(setDoc(moduleRef, {
        locked: true, // Default to locked
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true }));
    }
    
    await Promise.all(batch);
    console.log(`Initialized module permissions for ${quarter}`);
  } catch (error) {
    console.error('Error initializing module permissions:', error);
    throw error;
  }
};

// Listen to module permissions in real-time
export const listenToModulePermissions = (quarter = 'quarter_1', callback) => {
  const permissionsRef = collection(db, 'modules', quarter, 'permissions');
  return onSnapshot(permissionsRef, (snapshot) => {
    const permissions = {};
    snapshot.docs.forEach(doc => {
      permissions[doc.id] = doc.data();
    });
    callback(permissions);
  });
};

// ========================================
// EXPORTS
// ========================================

export { db, auth, collection, collectionGroup, getDocs, getDoc, query, where, signInWithEmailAndPassword, doc, setDoc, updateDoc, onSnapshot, addDoc, deleteDoc, orderBy, limit, serverTimestamp, arrayUnion };

