import { db, collection, addDoc, deleteDoc, doc, getDocs, query, where, notificationsCollection } from './firebase';

// Function to add a notification to Firebase
export const addNotification = async (teacherEmail, type, message, details = {}) => {
  try {
    // Filter out undefined values from details
    const cleanDetails = Object.fromEntries(
      Object.entries(details).filter(([key, value]) => value !== undefined)
    );
    
    await addDoc(notificationsCollection(), {
      teacherEmail,
      type,
      message,
      details: cleanDetails,
      timestamp: new Date().toISOString(),
      isRead: false
    });
  } catch (error) {
    console.error('Error adding notification:', error);
  }
};

// Notification types and their default messages
export const NOTIFICATION_TYPES = {
  STUDENT_ADDED: 'student_added',
  STUDENT_UPDATED: 'student_updated',
  STUDENT_DELETED: 'student_deleted',
  SECTION_CREATED: 'section_created',
  SECTION_DELETED: 'section_deleted',
  QUIZ_CREATED: 'quiz_created',
  QUIZ_UPDATED: 'quiz_updated',
  QUIZ_DELETED: 'quiz_deleted',
  QUIZ_COMPLETED: 'quiz_completed',
  PERFORMANCE_UPDATE: 'performance_update',
  SYSTEM_UPDATE: 'system',
  STUDENT_RESTORED: 'student_restored',
  QUIZ_RESTORED: 'quiz_restored',
  STUDENT_PERMANENTLY_DELETED: 'student_permanently_deleted',
  QUIZ_PERMANENTLY_DELETED: 'quiz_permanently_deleted',
  QUIZ_LOCKED: 'quiz_locked',
  QUIZ_UNLOCKED: 'quiz_unlocked',
  MODULE_LOCKED: 'module_locked',
  MODULE_UNLOCKED: 'module_unlocked',
  ADMIN_CREATED: 'admin_created',
  ADMIN_UPDATED: 'admin_updated',
  ADMIN_DELETED: 'admin_deleted',
  ADMIN_STATUS_CHANGED: 'admin_status_changed',
  PERMISSIONS_UPDATED: 'permissions_updated'
};

// Helper functions for common notifications
export const notifyStudentAdded = async (teacherEmail, studentName, gender) => {
  await addNotification(
    teacherEmail,
    NOTIFICATION_TYPES.STUDENT_ADDED,
    `New student "${studentName}" was added to the system`,
    { studentName, gender }
  );
};

export const notifyStudentUpdated = async (teacherEmail, studentName) => {
  await addNotification(
    teacherEmail,
    NOTIFICATION_TYPES.STUDENT_UPDATED,
    `Student "${studentName}" information was updated`,
    { studentName }
  );
};

export const notifyStudentDeleted = async (teacherEmail, studentName) => {
  await addNotification(
    teacherEmail,
    NOTIFICATION_TYPES.STUDENT_DELETED,
    `Student "${studentName}" was removed from the system`,
    { studentName }
  );
};

export const notifySectionCreated = async (teacherEmail, sectionName) => {
  await addNotification(
    teacherEmail,
    NOTIFICATION_TYPES.SECTION_CREATED,
    `Section "${sectionName}" was created successfully`,
    { sectionName }
  );
};

export const notifySectionDeleted = async (teacherEmail, sectionName) => {
  await addNotification(
    teacherEmail,
    NOTIFICATION_TYPES.SECTION_DELETED,
    `Section "${sectionName}" was deleted`,
    { sectionName }
  );
};

export const notifyQuizCreated = async (teacherEmail, quizTitle) => {
  await addNotification(
    teacherEmail,
    NOTIFICATION_TYPES.QUIZ_CREATED,
    `New quiz "${quizTitle}" was created successfully`,
    { quizTitle }
  );
};

export const notifyQuizDeleted = async (teacherEmail, quizTitle) => {
  await addNotification(
    teacherEmail,
    NOTIFICATION_TYPES.QUIZ_DELETED,
    `Quiz "${quizTitle}" was deleted`,
    { quizTitle }
  );
};

export const notifyQuizLocked = async (teacherEmail, quizTitle) => {
  await addNotification(
    teacherEmail,
    NOTIFICATION_TYPES.QUIZ_LOCKED,
    `Quiz "${quizTitle}" has been locked - students cannot take this quiz`,
    { quizTitle, action: 'locked' }
  );
};

export const notifyQuizUnlocked = async (teacherEmail, quizTitle) => {
  await addNotification(
    teacherEmail,
    NOTIFICATION_TYPES.QUIZ_UNLOCKED,
    `Quiz "${quizTitle}" has been unlocked - students can now take this quiz`,
    { quizTitle, action: 'unlocked' }
  );
};

export const notifyQuizCompleted = async (teacherEmail, studentName, quizTitle, score) => {
  await addNotification(
    teacherEmail,
    NOTIFICATION_TYPES.QUIZ_COMPLETED,
    `Student "${studentName}" completed "${quizTitle}" with ${score}%`,
    { studentName, quizTitle, score }
  );
};

export const notifyPerformanceUpdate = async (teacherEmail, studentName, metric, value) => {
  await addNotification(
    teacherEmail,
    NOTIFICATION_TYPES.PERFORMANCE_UPDATE,
    `Performance update: "${studentName}" ${metric} is now ${value}`,
    { studentName, metric, value }
  );
};

export const notifySystemUpdate = async (teacherEmail, message) => {
  await addNotification(
    teacherEmail,
    NOTIFICATION_TYPES.SYSTEM_UPDATE,
    message
  );
};

// Function to notify when a student is restored
export const notifyStudentRestored = async (teacherEmail, studentName) => {
  await addNotification(
    teacherEmail,
    NOTIFICATION_TYPES.STUDENT_RESTORED,
    `Student "${studentName}" was restored from archive`,
    { studentName }
  );
};

// Function to notify when a quiz is restored
export const notifyQuizRestored = async (teacherEmail, quizTitle) => {
  await addNotification(
    teacherEmail,
    NOTIFICATION_TYPES.QUIZ_RESTORED,
    `Quiz "${quizTitle}" was restored from archive`,
    { quizTitle }
  );
};

export const notifyStudentPermanentlyDeleted = async (teacherEmail, studentName) => {
  await addNotification(
    teacherEmail,
    NOTIFICATION_TYPES.STUDENT_PERMANENTLY_DELETED,
    `Student "${studentName}" was permanently deleted from archive`,
    { studentName }
  );
};

export const notifyQuizPermanentlyDeleted = async (teacherEmail, quizTitle) => {
  await addNotification(
    teacherEmail,
    NOTIFICATION_TYPES.QUIZ_PERMANENTLY_DELETED,
    `Quiz "${quizTitle}" was permanently deleted from archive`,
    { quizTitle }
  );
};

export const notifyAdminCreated = async (teacherEmail, adminName, adminRole) => {
  await addNotification(
    teacherEmail,
    NOTIFICATION_TYPES.ADMIN_CREATED,
    `New ${adminRole} "${adminName}" was created successfully`,
    { adminName, adminRole }
  );
};

export const notifyAdminUpdated = async (teacherEmail, adminName, updateType) => {
  await addNotification(
    teacherEmail,
    NOTIFICATION_TYPES.ADMIN_UPDATED,
    `Admin "${adminName}" ${updateType} was updated`,
    { adminName, updateType }
  );
};

export const notifyAdminDeleted = async (teacherEmail, adminName) => {
  await addNotification(
    teacherEmail,
    NOTIFICATION_TYPES.ADMIN_DELETED,
    `Admin "${adminName}" was removed from the system`,
    { adminName }
  );
};

export const notifyAdminStatusChanged = async (teacherEmail, adminName, newStatus) => {
  await addNotification(
    teacherEmail,
    NOTIFICATION_TYPES.ADMIN_STATUS_CHANGED,
    `Admin "${adminName}" status changed to ${newStatus}`,
    { adminName, newStatus }
  );
};

export const notifyPermissionsUpdated = async (teacherEmail, adminName) => {
  await addNotification(
    teacherEmail,
    NOTIFICATION_TYPES.PERMISSIONS_UPDATED,
    `Permissions updated for admin "${adminName}"`,
    { adminName }
  );
};

// Function to delete a single notification
export const deleteNotification = async (notificationId) => {
  try {
    await deleteDoc(doc(notificationsCollection(), notificationId));
  } catch (error) {
    console.error('Error deleting notification:', error);
  }
};

// Function to delete all notifications for a teacher
export const deleteAllNotifications = async (teacherEmail) => {
  try {
    const q = query(notificationsCollection(), where('teacherEmail', '==', teacherEmail));
    const querySnapshot = await getDocs(q);
    const deletePromises = querySnapshot.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error deleting all notifications:', error);
  }
};

// Function to delete selected notifications
export const deleteSelectedNotifications = async (notificationIds) => {
  try {
    const deletePromises = notificationIds.map(id => deleteDoc(doc(notificationsCollection(), id)));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error deleting selected notifications:', error);
  }
};
