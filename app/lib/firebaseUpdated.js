// Updated Firebase Configuration - Uses Clean Structure by Default
// This file replaces the old firebase.js and provides clean structure access

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, getDoc, query, where, doc, setDoc, updateDoc, onSnapshot, addDoc, deleteDoc, orderBy, limit, serverTimestamp } from 'firebase/firestore';
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

// Add new student
export const addStudent = async (studentData) => {
  try {
    const docRef = await addDoc(studentsCollection(), {
      ...studentData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding student:', error);
    throw error;
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
      
      // Add to archive
      await addDoc(collection(db, 'archive', 'deleted_users', 'students'), {
        originalId: studentId,
        deletedAt: serverTimestamp(),
        deletedBy: deletedBy,
        data: studentData
      });
      
      // Delete from main collection
      await deleteDoc(studentRef);
    }
  } catch (error) {
    console.error('Error deleting student:', error);
    throw error;
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
    const docRef = await addDoc(sectionsCollection(), {
      ...sectionData,
      currentStudents: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
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
    const docRef = await addDoc(quizzesCollection(), {
      ...quizData,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
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
// EXPORTS
// ========================================

export { db, auth, collection, getDocs, getDoc, query, where, signInWithEmailAndPassword, doc, setDoc, updateDoc, onSnapshot, addDoc, deleteDoc, orderBy, limit, serverTimestamp };
