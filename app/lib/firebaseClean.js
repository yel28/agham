// Clean Firebase Database Structure - Utility Functions
// This file contains helper functions for the new organized Firebase structure

import { db } from './firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';

// ========================================
// STUDENT MANAGEMENT
// ========================================

export const studentCollection = () => collection(db, 'users', 'students', 'students');

// Get all students
export const getAllStudents = async () => {
  try {
    const snapshot = await getDocs(studentCollection());
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
      studentCollection(),
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
    const docRef = await addDoc(studentCollection(), {
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
    const studentRef = doc(studentCollection(), studentId);
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
    const studentRef = doc(studentCollection(), studentId);
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
// SECTION MANAGEMENT
// ========================================

export const sectionCollection = () => collection(db, 'academic', 'sections', 'sections');

// Get all sections
export const getAllSections = async () => {
  try {
    const snapshot = await getDocs(sectionCollection());
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
    const docRef = await addDoc(sectionCollection(), {
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
    const sectionRef = doc(sectionCollection(), sectionId);
    await updateDoc(sectionRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating section:', error);
    throw error;
  }
};

// Delete section
export const deleteSection = async (sectionId, deletedBy) => {
  try {
    // Get section data first
    const sectionRef = doc(sectionCollection(), sectionId);
    const sectionDoc = await getDoc(sectionRef);
    
    if (sectionDoc.exists()) {
      const sectionData = sectionDoc.data();
      
      // Add to archive
      await addDoc(collection(db, 'archive', 'deleted_sections', 'sections'), {
        originalId: sectionId,
        deletedAt: serverTimestamp(),
        deletedBy: deletedBy,
        data: sectionData
      });
      
      // Delete from main collection
      await deleteDoc(sectionRef);
    }
  } catch (error) {
    console.error('Error deleting section:', error);
    throw error;
  }
};

// ========================================
// QUIZ MANAGEMENT
// ========================================

export const quizCollection = () => collection(db, 'assessments', 'quizzes', 'quizzestopic');

// Get all quizzes
export const getAllQuizzes = async () => {
  try {
    const snapshot = await getDocs(quizCollection());
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
    const docRef = await addDoc(quizCollection(), {
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
    const quizRef = doc(quizCollection(), quizId);
    await updateDoc(quizRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating quiz:', error);
    throw error;
  }
};

// Delete quiz
export const deleteQuiz = async (quizId, deletedBy) => {
  try {
    // Get quiz data first
    const quizRef = doc(quizCollection(), quizId);
    const quizDoc = await getDoc(quizRef);
    
    if (quizDoc.exists()) {
      const quizData = quizDoc.data();
      
      // Add to archive
      await addDoc(collection(db, 'archive', 'deleted_quizzes', 'quizzes'), {
        originalId: quizId,
        deletedAt: serverTimestamp(),
        deletedBy: deletedBy,
        data: quizData
      });
      
      // Delete from main collection
      await deleteDoc(quizRef);
    }
  } catch (error) {
    console.error('Error deleting quiz:', error);
    throw error;
  }
};

// ========================================
// ACTIVITY LOGGING
// ========================================

export const activityLogCollection = () => collection(db, 'system', 'activity_logs', 'logs');

// Log activity
export const logActivity = async (activityData) => {
  try {
    await addDoc(activityLogCollection(), {
      ...activityData,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('Error logging activity:', error);
    throw error;
  }
};

// Get activity logs
export const getActivityLogs = async (limitCount = 50) => {
  try {
    const q = query(
      activityLogCollection(),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting activity logs:', error);
    throw error;
  }
};

// ========================================
// NOTIFICATIONS
// ========================================

export const notificationCollection = () => collection(db, 'system', 'notifications', 'notifications');

// Add notification
export const addNotification = async (notificationData) => {
  try {
    const docRef = await addDoc(notificationCollection(), {
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

// Get notifications for user
export const getNotificationsForUser = async (userId) => {
  try {
    const q = query(
      notificationCollection(),
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

// ========================================
// SYSTEM SETTINGS
// ========================================

export const settingsCollection = () => collection(db, 'system', 'settings', 'settings');

// Get system settings
export const getSystemSettings = async () => {
  try {
    const snapshot = await getDocs(settingsCollection());
    const settings = {};
    snapshot.docs.forEach(doc => {
      settings[doc.id] = doc.data();
    });
    return settings;
  } catch (error) {
    console.error('Error getting system settings:', error);
    throw error;
  }
};

// Update system settings
export const updateSystemSettings = async (settingId, updateData) => {
  try {
    const settingRef = doc(settingsCollection(), settingId);
    await updateDoc(settingRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating system settings:', error);
    throw error;
  }
};

// ========================================
// REAL-TIME LISTENERS
// ========================================

// Listen to students in real-time
export const listenToStudents = (callback) => {
  return onSnapshot(studentCollection(), (snapshot) => {
    const students = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(students);
  });
};

// Listen to sections in real-time
export const listenToSections = (callback) => {
  return onSnapshot(sectionCollection(), (snapshot) => {
    const sections = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(sections);
  });
};

// Listen to quizzes in real-time
export const listenToQuizzes = (callback) => {
  return onSnapshot(quizCollection(), (snapshot) => {
    const quizzes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(quizzes);
  });
};

// ========================================
// UTILITY FUNCTIONS
// ========================================

// Generate clean ID
export const generateCleanId = (prefix, data = {}) => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${prefix}_${timestamp}_${random}`;
};

// Validate required fields
export const validateRequiredFields = (data, requiredFields) => {
  const missing = requiredFields.filter(field => !data[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
  return true;
};

// Format date for display
export const formatDate = (timestamp) => {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
