'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { db, collection, onSnapshot, setDoc, deleteDoc, doc, addStudent, addSection, getDocs, updateDoc, serverTimestamp, studentsCollection, assignmentsCollection, restoreStudent as restoreStudentApi } from '../../lib/firebase';
import { notifyStudentRestored, notifyQuizRestored, notifyStudentPermanentlyDeleted, notifyQuizPermanentlyDeleted } from '../../lib/notificationUtils';
import { checkUserPermissions } from '../../lib/adminUtils';
import { useLoading, LOADING_TYPES } from '../../lib/LoadingContext';
import { LoadingCard, LoadingButton, useLoadingState } from '../../components/LoadingComponents';
import { useNotifications } from '../../components/NotificationToast';
import '../style.css';
import './archive.css';

// Add CSS animation for spinner
const spinnerStyle = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }
`;

// Inject the CSS
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = spinnerStyle;
  document.head.appendChild(style);
}

export default function ArchivePage() {
  const router = useRouter();
  const [deletedStudents, setDeletedStudents] = useState([]);
  const [deletedQuizzes, setDeletedQuizzes] = useState([]);
  const [deletedAdmins, setDeletedAdmins] = useState([]);
  const [deletedSections, setDeletedSections] = useState([]);
  // Set default tab based on user role - sub-teachers and teachers only see quizzes
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const role = localStorage.getItem('teacherRole') || '';
      return (role === 'sub_teacher' || role === 'teacher') ? 'quizzes' : 'quizzes';
    }
    return 'quizzes'; // Default fallback for server-side rendering
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTeacherEmail, setCurrentTeacherEmail] = useState(null);
  
  // Loading states
  const { startLoading, stopLoading, setLoadingError, isLoading } = useLoading();
  const pageLoading = useLoadingState('archive-page', LOADING_TYPES.PAGE);
  const dataLoading = useLoadingState('archive-data', LOADING_TYPES.DATA);
  const bulkRestoreLoading = useLoadingState('bulk-restore', LOADING_TYPES.ACTION);
  const bulkDeleteLoading = useLoadingState('bulk-delete', LOADING_TYPES.ACTION);
  
  // Individual operation loading states
  const [restoreLoading, setRestoreLoading] = useState({});
  const [deleteLoading, setDeleteLoading] = useState({});
  const [sectionRestoreLoading, setSectionRestoreLoading] = useState(false);
  const [sectionDeleteLoading, setSectionDeleteLoading] = useState({});
  
  // Section operation progress states
  const [sectionOperationProgress, setSectionOperationProgress] = useState({
    isActive: false,
    operation: '', // 'restore' or 'delete'
    current: 0,
    total: 0,
    currentStudent: '',
    sectionName: ''
  });

  // Generic operation progress for admins and quizzes
  const [entityOperationProgress, setEntityOperationProgress] = useState({
    isActive: false,
    entity: '', // 'admin' | 'quiz'
    operation: '', // 'restore' | 'delete'
    current: 0,
    total: 0,
    currentName: ''
  });
  
  // Notifications
  const { showSuccess, showError, showWarning, showInfo } = useNotifications();
  
  // Get role and permissions from localStorage
  const [teacherRole, setTeacherRole] = useState('');
  const [teacherPermissions, setTeacherPermissions] = useState({});
  
  
  // Modal states
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showDeleteForeverModal, setShowDeleteForeverModal] = useState(false);
  const [itemToRestore, setItemToRestore] = useState(null);
  const [itemToDeleteForever, setItemToDeleteForever] = useState(null);
  const [modalType, setModalType] = useState(''); // 'student', 'quiz', or 'admin'
  
  // Section confirmation modals
  const [showSectionRestoreModal, setShowSectionRestoreModal] = useState(false);
  const [showSectionDeleteModal, setShowSectionDeleteModal] = useState(false);
  const [sectionToRestore, setSectionToRestore] = useState(null);
  const [sectionToDelete, setSectionToDelete] = useState(null);

  // Multiple selection states
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectedQuizzes, setSelectedQuizzes] = useState([]);
  const [selectedAdmins, setSelectedAdmins] = useState([]);
  const [selectedSections, setSelectedSections] = useState([]);

  // Bulk action modal states
  const [showBulkRestoreModal, setShowBulkRestoreModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkActionType, setBulkActionType] = useState(''); // 'students', 'quizzes', or 'admins'

  // Set teacher email on client side only
  useEffect(() => {
    const email = localStorage.getItem('teacherEmail');
    setCurrentTeacherEmail(email);
    
    // Start page loading
    if (email) {
      pageLoading.start('Loading archive...');
    }
    
    if (!email) {
      router.push('/homepage/login');
    }
  }, [router]);


  // Load role and permissions from localStorage
  useEffect(() => {
    const role = localStorage.getItem('teacherRole') || '';
    const permissions = JSON.parse(localStorage.getItem('teacherPermissions') || '{}');
    setTeacherRole(role);
    setTeacherPermissions(permissions);
  }, []);

  // Add permission checking - these will be computed values using useMemo
  const canAccessArchive = useMemo(() => 
    checkUserPermissions(teacherRole, teacherPermissions, 'access_archive'), 
    [teacherRole, teacherPermissions]
  );
  const canRestoreItems = useMemo(() => 
    checkUserPermissions(teacherRole, teacherPermissions, 'restore_item'), 
    [teacherRole, teacherPermissions]
  );
  const canPermanentlyDelete = useMemo(() => 
    checkUserPermissions(teacherRole, teacherPermissions, 'permanently_delete'), 
    [teacherRole, teacherPermissions]
  );
  const canViewAdminArchive = useMemo(() => (
    checkUserPermissions(teacherRole, teacherPermissions, 'manage_users') ||
    checkUserPermissions(teacherRole, teacherPermissions, 'change_roles')
  ), [teacherRole, teacherPermissions]);
  const canManageAdmins = useMemo(() => (
    checkUserPermissions(teacherRole, teacherPermissions, 'manage_users') ||
    checkUserPermissions(teacherRole, teacherPermissions, 'change_roles')
  ), [teacherRole, teacherPermissions]);
  // Allow privileged users to view all sections regardless of deletedBy
  const canViewAllSections = useMemo(() => (
    checkUserPermissions(teacherRole, teacherPermissions, 'manage_sections') ||
    checkUserPermissions(teacherRole, teacherPermissions, 'access_archive')
  ), [teacherRole, teacherPermissions]);

  // Determine which tabs should be visible based on user role
  const canViewStudentsTab = useMemo(() => 
    teacherRole === 'teacher' || teacherRole === 'admin' || teacherRole === 'super_admin',
    [teacherRole]
  );
  const canViewAdminsTab = useMemo(() => 
    teacherRole === 'admin' || teacherRole === 'super_admin',
    [teacherRole]
  );
  const canViewSectionsTab = useMemo(() => 
    teacherRole === 'teacher' || teacherRole === 'admin' || teacherRole === 'super_admin',
    [teacherRole]
  );
  const canViewQuizzesTab = useMemo(() => 
    teacherRole === 'teacher' || teacherRole === 'admin' || teacherRole === 'super_admin',
    [teacherRole]
  );


  useEffect(() => {
    if (!currentTeacherEmail) {
      return;
    }

    setLoading(true);
    setError(null);
    
    // Start data loading
    dataLoading.start('Loading archive data...');

    let studentsLoaded = false;
    let quizzesLoaded = false;
    let adminsLoaded = !canViewAdminArchive; // if cannot view, treat as loaded
    let sectionsLoaded = false;

    const checkLoadingComplete = () => {
      if (studentsLoaded && quizzesLoaded && adminsLoaded && sectionsLoaded) {
        setLoading(false);
        dataLoading.stop(true);
        pageLoading.stop(true);
      }
    };

    // Timeout fallback to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
      dataLoading.stop(false);
      pageLoading.stop(false);
    }, 3000); // Reduced to 3 seconds timeout

    // Fetch deleted students (from current deleted_students collection)
    const studentsUnsubscribe = onSnapshot(collection(db, 'deleted_students'), (snapshot) => {
      const students = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Only include students that have the required structure and belong to current teacher
        // Exclude students that were deleted as part of a section deletion; these are now embedded under deleted_sections
        const isFromSectionDeletion = data.deletionReason === 'Section Deletion' || !!data.archivedFromSection || !!data.originalData?.archivedFromSection;
        if (data.deletedBy === currentTeacherEmail && data.originalData && !isFromSectionDeletion) {
          students.push({ id: doc.id, ...data });
        } else {
          console.warn('Skipping invalid student data:', { id: doc.id, data });
        }
      });
      setDeletedStudents(students);
      studentsLoaded = true;
      checkLoadingComplete();
    });

    // Fetch deleted quizzes (from current deleted_quizzes collection)
    const quizzesUnsubscribe = onSnapshot(collection(db, 'deleted_quizzes'), (snapshot) => {
      const quizzes = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Only include quizzes that have the required structure and belong to current teacher
        if (data.deletedBy === currentTeacherEmail && data.originalData) {
          quizzes.push({ id: doc.id, ...data });
        } else {
          console.warn('Skipping invalid quiz data:', { id: doc.id, data });
        }
      });
      setDeletedQuizzes(quizzes);
      quizzesLoaded = true;
      checkLoadingComplete();
    });

    let adminsUnsubscribe = () => {};

    // Fetch deleted admins (optional, only if user can view admin archive)
    if (canViewAdminArchive) {
      adminsUnsubscribe = onSnapshot(collection(db, 'deleted_admins'), (snapshot) => {
        const admins = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          admins.push({ id: doc.id, ...data });
        });
        setDeletedAdmins(admins);
        adminsLoaded = true;
        checkLoadingComplete();
      });
    }

    // Fetch deleted sections
    const sectionsUnsubscribe = onSnapshot(collection(db, 'deleted_sections'), (snapshot) => {
      const sections = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Include sections that belong to current teacher, or if user has permission to view all,
        // or legacy records that don't have deletedBy set
        const belongsToUser = data.deletedBy === currentTeacherEmail;
        const missingOwner = !data.deletedBy;
        if (belongsToUser || missingOwner || canViewAllSections) {
          // Ensure studentCount reflects embedded archivedStudents length if provided
          const studentCount = Array.isArray(data.archivedStudents) ? data.archivedStudents.length : data.studentCount;
          sections.push({ id: doc.id, ...data, studentCount });
        } else {
        }
      });
      setDeletedSections(sections);
      sectionsLoaded = true;
      checkLoadingComplete();
    });

    return () => {
      clearTimeout(loadingTimeout);
      studentsUnsubscribe();
      quizzesUnsubscribe();
      adminsUnsubscribe();
      sectionsUnsubscribe();
    };
  }, [currentTeacherEmail, canViewAdminArchive]);


  const handleRestore = (item, type) => {
    if (!canRestoreItems) {
      showError('You do not have permission to restore items from archive.');
      return;
    }
    if (!item || !item.originalData) {
      console.error('Invalid item data for restoration:', item);
      showError('Invalid item data. Cannot restore.');
      return;
    }
    setItemToRestore(item);
    setModalType(type);
    setShowRestoreModal(true);
  };

  const handleDeleteForever = (item, type) => {
    if (!canPermanentlyDelete) {
      showError('You do not have permission to permanently delete items.');
      return;
    }
    if (!item || !item.originalData) {
      console.error('Invalid item data for permanent deletion:', item);
      showError('Invalid item data. Cannot delete.');
      return;
    }
    setItemToDeleteForever(item);
    setModalType(type);
    setShowDeleteForeverModal(true);
  };

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    
    // Force re-fetch of data
    if (currentTeacherEmail) {
      // The useEffect will automatically re-run when we reset the state
      setDeletedStudents([]);
      setDeletedQuizzes([]);
    }
  };


  const restoreStudent = async (student) => {
    const deriveOriginalId = (s) => {
      if (!s) return '';
      if (typeof s === 'string') return s;
      return s.originalId || s.originalData?.id || (s.id || '').replace(/^deleted_/,'');
    };
    const originalId = deriveOriginalId(student);
    if (!originalId) {
      console.error('Invalid student data for restoration:', student);
      showError('Invalid student data. Cannot restore.');
      return;
    }
    setRestoreLoading(prev => ({ ...prev, [student.id || originalId]: true }));
    try {
      await restoreStudentApi(originalId, currentTeacherEmail);
      // Fallback cleanup: ensure the deleted_students doc is removed so the row disappears immediately
      try {
        const delId = student.id || `deleted_${originalId}`;
        await deleteDoc(doc(db, 'deleted_students', delId));
      } catch (_) {}
      setShowRestoreModal(false);
      setItemToRestore(null);
      setModalType('');
      showSuccess('Student restored successfully!');
    } catch (error) {
      console.error('Error restoring student:', error);
      showError('Error restoring student. Please try again.');
    } finally {
      setRestoreLoading(prev => ({ ...prev, [student.id || originalId]: false }));
    }
  };

  const restoreQuiz = async (quiz) => {
    if (!quiz || !quiz.originalData) {
      console.error('Invalid quiz data for restoration:', quiz);
      showError('Invalid quiz data. Cannot restore.');
      return;
    }
    setEntityOperationProgress({
      isActive: true,
      entity: 'quiz',
      operation: 'restore',
      current: 0,
      total: 1,
      currentName: quiz.originalData?.title || 'Quiz'
    });

    setRestoreLoading(prev => ({ ...prev, [quiz.id]: true }));
    
    try {
      // Restore quiz to the correct quizzes collection path
      await setDoc(doc(db, 'assessments', 'quizzes', 'quizzestopic', quiz.id), quiz.originalData);
      
      // Remove from deleted_quizzes collection
      await deleteDoc(doc(db, 'deleted_quizzes', quiz.id));
      
      // Add notification
      await notifyQuizRestored(currentTeacherEmail, quiz.originalData?.title);
      
      setShowRestoreModal(false);
      setItemToRestore(null);
      setModalType('');
      showSuccess('Quiz restored successfully!');
    } catch (error) {
      console.error('Error restoring quiz:', error);
      showError('Error restoring quiz. Please try again.');
    } finally {
      setRestoreLoading(prev => ({ ...prev, [quiz.id]: false }));
      setEntityOperationProgress({ isActive: false, entity: '', operation: '', current: 0, total: 0, currentName: '' });
    }
  };

  const restoreAdmin = async (admin) => {
    if (!admin || !admin.originalData) {
      showError('Invalid admin data. Cannot restore.');
      return;
    }
    setEntityOperationProgress({
      isActive: true,
      entity: 'admin',
      operation: 'restore',
      current: 0,
      total: 1,
      currentName: `${admin.originalData?.firstName || ''} ${admin.originalData?.lastName || ''}`.trim() || 'Admin'
    });

    setRestoreLoading(prev => ({ ...prev, [admin.id]: true }));
    
    try {
      const originalId = admin.originalId;
      if (originalId) {
        await setDoc(doc(db, 'users', 'admins', 'admins', originalId), admin.originalData);
      } else {
        await setDoc(doc(db, 'users', 'admins', 'admins', doc(collection(db, 'users', 'admins', 'admins')).id), admin.originalData);
      }
      await deleteDoc(doc(db, 'deleted_admins', admin.id));
      showSuccess('Admin restored successfully!');
      setShowRestoreModal(false);
      setItemToRestore(null);
      setModalType('');
    } catch (error) {
      console.error('Error restoring admin:', error);
      showError('Error restoring admin. Please try again.');
    } finally {
      setRestoreLoading(prev => ({ ...prev, [admin.id]: false }));
      setEntityOperationProgress({ isActive: false, entity: '', operation: '', current: 0, total: 0, currentName: '' });
    }
  };

  const permanentlyDeleteStudent = async (studentId) => {
    if (!studentId) {
      console.error('No student ID provided for permanent deletion');
      return;
    }
    
    setDeleteLoading(prev => ({ ...prev, [studentId]: true }));
    
    try {
      // Get student data before deletion for notification
      const studentToDelete = deletedStudents.find(s => s.id === studentId);
      if (!studentToDelete || !studentToDelete.originalData) {
        console.error('Invalid student data for permanent deletion:', studentToDelete);
        showError('Invalid student data. Cannot delete.');
        return;
      }
      
      const studentName = studentToDelete ? `${studentToDelete.originalData?.firstName} ${studentToDelete.originalData?.lastName}` : 'Unknown Student';
      
      await deleteDoc(doc(db, 'deleted_students', studentId));
      
      // Add notification
      await notifyStudentPermanentlyDeleted(currentTeacherEmail, studentName);
      
      setShowDeleteForeverModal(false);
      setItemToDeleteForever(null);
      setModalType('');
      showSuccess('Student permanently deleted!');
    } catch (error) {
      console.error('Error permanently deleting student:', error);
      showError('Error permanently deleting student. Please try again.');
    } finally {
      setDeleteLoading(prev => ({ ...prev, [studentId]: false }));
    }
  };

  // Permanently delete quiz and all related data from Firebase
  const permanentlyDeleteQuizFromFirebase = async (quizId, quizTitle) => {
    try {
      console.log(`🗑️ Permanently deleting quiz from Firebase: ${quizId} (${quizTitle})`);
      
      // 1. Delete all quiz assignments from assessments/assignments/assignments/
      console.log('🔍 Searching for assignments with quizId:', quizId);
      const assignmentsRef = assignmentsCollection();
      const assignmentsSnapshot = await getDocs(assignmentsRef);
      const assignmentDeletes = [];
      
      console.log(`📊 Found ${assignmentsSnapshot.docs.length} total assignments`);
      
      assignmentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`🔍 Checking assignment ${doc.id}: quizId = ${data.quizId}`);
        
        // Check for exact match or if the quizId matches the original ID (without deleted_ prefix)
        const originalQuizId = quizId.replace(/^deleted_/, '');
        const isMatch = data.quizId === quizId || data.quizId === originalQuizId;
        
        if (isMatch) {
          console.log(`🗑️ MATCH FOUND! Deleting assignment: ${doc.id} (matched: ${data.quizId})`);
          assignmentDeletes.push(deleteDoc(doc.ref));
        }
      });
      
      console.log(`🗑️ Will delete ${assignmentDeletes.length} assignments`);
      
      // 2. Delete all student assignments from assessments/assignments/student_assignments/
      const studentAssignmentsRef = collection(db, 'assessments', 'assignments', 'student_assignments');
      const studentAssignmentsSnapshot = await getDocs(studentAssignmentsRef);
      const studentAssignmentDeletes = [];
      
      studentAssignmentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const originalQuizId = quizId.replace(/^deleted_/, '');
        const isMatch = data.quizId === quizId || data.quizId === originalQuizId;
        
        if (isMatch) {
          console.log(`🗑️ Deleting student assignment: ${doc.id}`);
          studentAssignmentDeletes.push(deleteDoc(doc.ref));
        }
      });
      
      // 3. Delete all section assignments from assessments/assignments/section_assignments/
      const sectionAssignmentsRef = collection(db, 'assessments', 'assignments', 'section_assignments');
      const sectionAssignmentsSnapshot = await getDocs(sectionAssignmentsRef);
      const sectionAssignmentDeletes = [];
      
      sectionAssignmentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const originalQuizId = quizId.replace(/^deleted_/, '');
        const isMatch = data.quizId === quizId || data.quizId === originalQuizId;
        
        if (isMatch) {
          console.log(`🗑️ Deleting section assignment: ${doc.id}`);
          sectionAssignmentDeletes.push(deleteDoc(doc.ref));
        }
      });
      
      // 4. Remove quiz references from student records
      const studentsRef = studentsCollection();
      const studentsSnapshot = await getDocs(studentsRef);
      const studentUpdates = [];
      
      studentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.assignedQuizzes && Array.isArray(data.assignedQuizzes)) {
          const originalQuizId = quizId.replace(/^deleted_/, '');
          const updatedQuizzes = data.assignedQuizzes.filter(quiz => 
            quiz.quizId !== quizId && quiz.quizId !== originalQuizId
          );
          if (updatedQuizzes.length !== data.assignedQuizzes.length) {
            console.log(`🗑️ Removing quiz reference from student: ${doc.id}`);
            studentUpdates.push(updateDoc(doc.ref, {
              assignedQuizzes: updatedQuizzes,
              updatedAt: serverTimestamp()
            }));
          }
        }
      });
      
      // Execute all deletions in parallel
      console.log(`🚀 Executing ${assignmentDeletes.length + studentAssignmentDeletes.length + sectionAssignmentDeletes.length + studentUpdates.length} deletion operations...`);
      
      await Promise.all([
        ...assignmentDeletes,
        ...studentAssignmentDeletes,
        ...sectionAssignmentDeletes,
        ...studentUpdates
      ]);
      
      console.log(`✅ Quiz ${quizId} and all related data permanently deleted from Firebase`);
      console.log(`📊 Deleted: ${assignmentDeletes.length} assignments, ${studentAssignmentDeletes.length} student assignments, ${sectionAssignmentDeletes.length} section assignments, ${studentUpdates.length} student updates`);
      
    } catch (error) {
      console.error('Error permanently deleting quiz from Firebase:', error);
      throw error;
    }
  };

  const permanentlyDeleteQuiz = async (quizId) => {
    if (!quizId) {
      console.error('No quiz ID provided for permanent deletion');
      return;
    }
    setEntityOperationProgress(prev => ({
      isActive: true,
      entity: 'quiz',
      operation: 'delete',
      current: 0,
      total: 1,
      currentName: (deletedQuizzes.find(q => q.id === quizId)?.originalData?.title) || 'Quiz'
    }));

    setDeleteLoading(prev => ({ ...prev, [quizId]: true }));
    
    try {
      // Get quiz data before deletion for notification
      const quizToDelete = deletedQuizzes.find(q => q.id === quizId);
      if (!quizToDelete || !quizToDelete.originalData) {
        console.error('Invalid quiz data for permanent deletion:', quizToDelete);
        showError('Invalid quiz data. Cannot delete.');
        return;
      }
      
      const quizTitle = quizToDelete ? quizToDelete.originalData?.title : 'Unknown Quiz';
      
      // Permanently delete all related assignment data from Firebase
      await permanentlyDeleteQuizFromFirebase(quizId, quizTitle);
      
      // Delete from deleted_quizzes collection
      await deleteDoc(doc(db, 'deleted_quizzes', quizId));
      
      // Add notification
      await notifyQuizPermanentlyDeleted(currentTeacherEmail, quizTitle);
      
      setShowDeleteForeverModal(false);
      setItemToDeleteForever(null);
      setModalType('');
      showSuccess('Quiz and all related data permanently deleted!');
    } catch (error) {
      console.error('Error permanently deleting quiz:', error);
      showError('Error permanently deleting quiz. Please try again.');
    } finally {
      setDeleteLoading(prev => ({ ...prev, [quizId]: false }));
      setEntityOperationProgress({ isActive: false, entity: '', operation: '', current: 0, total: 0, currentName: '' });
    }
  };

  const permanentlyDeleteAdmin = async (adminId) => {
    if (!adminId) return;
    setEntityOperationProgress(prev => ({
      isActive: true,
      entity: 'admin',
      operation: 'delete',
      current: 0,
      total: 1,
      currentName: (deletedAdmins.find(a => a.id === adminId)?.originalData?.firstName || '') + ' ' + (deletedAdmins.find(a => a.id === adminId)?.originalData?.lastName || '')
    }));

    setDeleteLoading(prev => ({ ...prev, [adminId]: true }));
    
    try {
      await deleteDoc(doc(db, 'deleted_admins', adminId));
      showSuccess('Admin permanently deleted!');
      setShowDeleteForeverModal(false);
      setItemToDeleteForever(null);
      setModalType('');
    } catch (error) {
      console.error('Error permanently deleting admin:', error);
      showError('Error permanently deleting admin. Please try again.');
    } finally {
      setDeleteLoading(prev => ({ ...prev, [adminId]: false }));
      setEntityOperationProgress({ isActive: false, entity: '', operation: '', current: 0, total: 0, currentName: '' });
    }
  };

  const restoreSection = async (section) => {
    if (!section || !section.originalData) {
      console.error('Invalid section data for restoration:', section);
      showError('Invalid section data. Cannot restore.');
      return;
    }
    
    setSectionRestoreLoading(true);
    
    try {
      // First, restore the section
      const sectionData = {
        name: section.originalData.name,
        description: section.originalData.description,
        currentStudents: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const restoredSectionId = await addSection(sectionData);
      
      // Prefer embedded archivedStudents under the section (new behavior). Fall back to deleted_students if absent (legacy).
      const embedded = Array.isArray(section.archivedStudents) ? section.archivedStudents : [];
      const studentsToRestore = embedded.length > 0
        ? embedded
        : deletedStudents.filter(student => {
            const studentArchivedFromSection = student.archivedFromSection || student.originalData?.archivedFromSection;
            const studentArchivedFromSectionId = student.archivedFromSectionId || student.originalData?.archivedFromSectionId;
            const studentDeletionReason = student.deletionReason;
            return (
              studentArchivedFromSection === section.originalData.name &&
              studentArchivedFromSectionId === section.originalData.id
            ) || (
              studentDeletionReason === 'Section Deletion' &&
              studentArchivedFromSection === section.originalData.name
            );
          });

      // Set up progress tracking
      setSectionOperationProgress({
        isActive: true,
        operation: 'restore',
        current: 0,
        total: studentsToRestore.length,
        currentStudent: '',
        sectionName: section.originalData.name
      });

      let restoredStudentsCount = 0;
      
      for (let i = 0; i < studentsToRestore.length; i++) {
        const student = studentsToRestore[i];
        
        // Update progress
        setSectionOperationProgress(prev => ({
          ...prev,
          current: i + 1,
          currentStudent: `${(student.originalData?.firstName || student.firstName) || ''} ${(student.originalData?.lastName || student.lastName) || ''}`.trim()
        }));
        
        try {
          const originalId = student.originalId || student.originalData?.id || (student.id || '').replace(/^deleted_/,'');
          // Use the same API as single-student restore so quizResults are restored
          await restoreStudentApi(originalId, currentTeacherEmail);
          // Move student to the restored section
          await updateDoc(doc(studentsCollection(), originalId), { sectionId: restoredSectionId, updatedAt: new Date().toISOString() });
          // Clean legacy record
          if (student.id) {
            await deleteDoc(doc(db, 'deleted_students', student.id));
            setDeletedStudents(prev => prev.filter(s => s.id !== student.id));
          }
          restoredStudentsCount++;
        } catch (studentError) {
          console.error(`Error restoring student ${student.originalData?.firstName}:`, studentError);
        }
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Remove the section from deleted sections
      await deleteDoc(doc(db, 'deleted_sections', section.id));
      setDeletedSections(prev => prev.filter(s => s.id !== section.id));
      
      // Clear progress
      setSectionOperationProgress({
        isActive: false,
        operation: '',
        current: 0,
        total: 0,
        currentStudent: '',
        sectionName: ''
      });
      
      // Show success message with student count
      if (restoredStudentsCount > 0) {
        showSuccess(`Section "${section.originalData.name}" and ${restoredStudentsCount} students restored successfully!`);
      } else {
        showSuccess(`Section "${section.originalData.name}" restored successfully! (No students found to restore)`);
      }
    } catch (error) {
      console.error('Error restoring section:', error);
      showError('Error restoring section. Please try again.');
    } finally {
      setSectionRestoreLoading(false);
      setSectionOperationProgress({
        isActive: false,
        operation: '',
        current: 0,
        total: 0,
        currentStudent: '',
        sectionName: ''
      });
    }
  };

  const permanentlyDeleteSection = async (sectionId) => {
    if (!sectionId) {
      console.error('No section ID provided for permanent deletion');
      return;
    }
    
    setSectionDeleteLoading(prev => ({ ...prev, [sectionId]: true }));
    
    try {
      // Get section data before deletion for notification
      const sectionToDelete = deletedSections.find(s => s.id === sectionId);
      if (!sectionToDelete || !sectionToDelete.originalData) {
        console.error('Invalid section data for permanent deletion:', sectionToDelete);
        showError('Invalid section data. Cannot delete.');
        return;
      }

      const sectionName = sectionToDelete.originalData.name;
      
      // Prefer embedded archivedStudents under the section (new behavior). Fall back to deleted_students if absent (legacy).
      const embedded = Array.isArray(sectionToDelete.archivedStudents) ? sectionToDelete.archivedStudents : [];

      // Find and permanently delete all students that were archived with this SPECIFIC section (legacy only)
      const studentsToDeleteLegacy = deletedStudents.filter(student => {
        // Only delete students that were specifically archived from this section
        const wasArchivedFromThisSection = (
          student.archivedFromSection === sectionToDelete.originalData.name &&
          student.archivedFromSectionId === sectionToDelete.originalData.id
        ) || (
          student.deletionReason === 'Section Deletion' &&
          student.archivedFromSection === sectionToDelete.originalData.name
        );
        
        
        return wasArchivedFromThisSection;
      });

      // Choose source for progress: embedded preferred, else legacy collection
      const progressSource = embedded.length > 0 ? embedded : studentsToDeleteLegacy;

      // Set up progress tracking
      setSectionOperationProgress({
        isActive: true,
        operation: 'delete',
        current: 0,
        total: progressSource.length,
        currentStudent: '',
        sectionName: sectionName
      });

      let deletedStudentsCount = 0;
      
      for (let i = 0; i < progressSource.length; i++) {
        const student = progressSource[i];
        
        // Update progress
        setSectionOperationProgress(prev => ({
          ...prev,
          current: i + 1,
          currentStudent: `${(student.originalData?.firstName || student.firstName) || ''} ${(student.originalData?.lastName || student.lastName) || ''}`.trim()
        }));
        
        try {
          if (embedded.length > 0) {
            // Embedded mode: there are no separate student docs to delete; just simulate progress count
            deletedStudentsCount++;
          } else {
            // Legacy mode: Permanently delete student docs from deleted_students
            await deleteDoc(doc(db, 'deleted_students', student.id));
            setDeletedStudents(prev => prev.filter(s => s.id !== student.id));
            deletedStudentsCount++;
          }
        } catch (studentError) {
          console.error(`Error permanently deleting student ${student.originalData?.firstName}:`, studentError);
        }
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Permanently delete the section
      await deleteDoc(doc(db, 'deleted_sections', sectionId));
      setDeletedSections(prev => prev.filter(s => s.id !== sectionId));
      
      // Clear progress
      setSectionOperationProgress({
        isActive: false,
        operation: '',
        current: 0,
        total: 0,
        currentStudent: '',
        sectionName: ''
      });
      
      // Show success message with student count
      if (deletedStudentsCount > 0) {
        showSuccess(`Section "${sectionName}" and ${deletedStudentsCount} students permanently deleted!`);
      } else {
        showSuccess(`Section "${sectionName}" permanently deleted!`);
      }
    } catch (error) {
      console.error('Error permanently deleting section:', error);
      showError('Error permanently deleting section. Please try again.');
    } finally {
      setSectionDeleteLoading(prev => ({ ...prev, [sectionId]: false }));
      setSectionOperationProgress({
        isActive: false,
        operation: '',
        current: 0,
        total: 0,
        currentStudent: '',
        sectionName: ''
      });
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Multiple selection functions
  const toggleStudentSelection = (studentId) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const toggleQuizSelection = (quizId) => {
    setSelectedQuizzes(prev => 
      prev.includes(quizId) 
        ? prev.filter(id => id !== quizId)
        : [...prev, quizId]
    );
  };

  const toggleAllStudents = () => {
    if (selectedStudents.length === deletedStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(deletedStudents.map(student => student.id));
    }
  };

  const toggleAllQuizzes = () => {
    if (selectedQuizzes.length === deletedQuizzes.length) {
      setSelectedQuizzes([]);
    } else {
      setSelectedQuizzes(deletedQuizzes.map(quiz => quiz.id));
    }
  };

  const toggleAllAdmins = () => {
    if (selectedAdmins.length === deletedAdmins.length) {
      setSelectedAdmins([]);
    } else {
      setSelectedAdmins(deletedAdmins.map(admin => admin.id));
    }
  };

  const toggleAllSections = () => {
    if (selectedSections.length === deletedSections.length) {
      setSelectedSections([]);
    } else {
      setSelectedSections(deletedSections.map(section => section.id));
    }
  };

  const handleBulkRestoreClick = (type) => {
    if (!canRestoreItems) {
      showError('You do not have permission to restore items from archive.');
      return;
    }
    setBulkActionType(type);
    setShowBulkRestoreModal(true);
  };

  const handleBulkDeleteClick = (type) => {
    if (!canPermanentlyDelete) {
      showError('You do not have permission to permanently delete items.');
      return;
    }
    setBulkActionType(type);
    setShowBulkDeleteModal(true);
  };

  const handleBulkRestore = async () => {
    try {
      bulkRestoreLoading.start(`Restoring ${bulkActionType}...`);
      
      if (bulkActionType === 'students') {
        let restoredCount = 0;
        for (const studentId of selectedStudents) {
          try {
            const student = deletedStudents.find(s => s.id === studentId);
            if (student && student.originalData) {
              // Restore student to students collection
              await addStudent(student.originalData);
              
              // Remove from deleted students
              await deleteDoc(doc(db, 'deleted_students', studentId));
              setDeletedStudents(prev => prev.filter(s => s.id !== studentId));
              restoredCount++;
            }
          } catch (error) {
            console.error(`Error restoring student ${studentId}:`, error);
          }
        }
        setSelectedStudents([]);
        showSuccess(`${restoredCount} students restored successfully!`);
      } else if (bulkActionType === 'quizzes') {
        let restoredCount = 0;
        setEntityOperationProgress({ isActive: true, entity: 'quiz', operation: 'restore', current: 0, total: selectedQuizzes.length, currentName: '' });
        for (let i = 0; i < selectedQuizzes.length; i++) {
          const quizId = selectedQuizzes[i];
          try {
            const quiz = deletedQuizzes.find(q => q.id === quizId);
            if (quiz && quiz.originalData) {
              setEntityOperationProgress(prev => ({ ...prev, current: i + 1, currentName: quiz.originalData?.title || 'Quiz' }));
              // Restore quiz to the correct quizzes collection path
              await setDoc(doc(db, 'assessments', 'quizzes', 'quizzestopic', quizId), quiz.originalData);
              
              // Remove from deleted quizzes
              await deleteDoc(doc(db, 'deleted_quizzes', quizId));
              setDeletedQuizzes(prev => prev.filter(q => q.id !== quizId));
              restoredCount++;
            }
          } catch (error) {
            console.error(`Error restoring quiz ${quizId}:`, error);
          }
        }
        setEntityOperationProgress({ isActive: false, entity: '', operation: '', current: 0, total: 0, currentName: '' });
        setSelectedQuizzes([]);
        showSuccess(`${restoredCount} quizzes restored successfully!`);
      } else if (bulkActionType === 'admins') {
        let restoredCount = 0;
        setEntityOperationProgress({ isActive: true, entity: 'admin', operation: 'restore', current: 0, total: selectedAdmins.length, currentName: '' });
        for (let i = 0; i < selectedAdmins.length; i++) {
          const adminId = selectedAdmins[i];
          try {
            const admin = deletedAdmins.find(a => a.id === adminId);
            if (admin && admin.originalData) {
              setEntityOperationProgress(prev => ({ ...prev, current: i + 1, currentName: `${admin.originalData?.firstName || ''} ${admin.originalData?.lastName || ''}`.trim() || 'Admin' }));
              const originalId = admin.originalId;
              if (originalId) {
                await setDoc(doc(db, 'users', 'admins', 'admins', originalId), admin.originalData);
              } else {
                await setDoc(doc(db, 'users', 'admins', 'admins', doc(collection(db, 'users', 'admins', 'admins')).id), admin.originalData);
              }
              
              // Remove from deleted admins
              await deleteDoc(doc(db, 'deleted_admins', adminId));
              setDeletedAdmins(prev => prev.filter(a => a.id !== adminId));
              restoredCount++;
            }
          } catch (error) {
            console.error(`Error restoring admin ${adminId}:`, error);
          }
        }
        setEntityOperationProgress({ isActive: false, entity: '', operation: '', current: 0, total: 0, currentName: '' });
        setSelectedAdmins([]);
        showSuccess(`${restoredCount} admins restored successfully!`);
      } else if (bulkActionType === 'sections') {
        let restoredCount = 0;
        setEntityOperationProgress({ isActive: true, entity: 'section', operation: 'restore', current: 0, total: selectedSections.length, currentName: '' });
        for (let i = 0; i < selectedSections.length; i++) {
          const sectionId = selectedSections[i];
          try {
            const section = deletedSections.find(s => s.id === sectionId);
            if (section && section.originalData) {
              setEntityOperationProgress(prev => ({ ...prev, current: i + 1, currentName: section.originalData?.name || 'Section' }));
              // Restore section
              await restoreSection(section);
              restoredCount++;
            }
          } catch (error) {
            console.error(`Error restoring section ${sectionId}:`, error);
          }
        }
        setEntityOperationProgress({ isActive: false, entity: '', operation: '', current: 0, total: 0, currentName: '' });
        setSelectedSections([]);
        showSuccess(`${restoredCount} sections restored successfully!`);
      }
    setShowBulkRestoreModal(false);
    setBulkActionType('');
    bulkRestoreLoading.stop(true);
  } catch (error) {
    console.error('Error in bulk restore:', error);
    showError('Error during bulk restoration. Some items may not have been restored.');
    bulkRestoreLoading.stop(false);
  }
};

  const handleBulkDelete = async () => {
    try {
      bulkDeleteLoading.start(`Deleting ${bulkActionType}...`);
      
      if (bulkActionType === 'students') {
        let deletedCount = 0;
        for (const studentId of selectedStudents) {
          try {
            // Get student data before deletion for notification
            const studentToDelete = deletedStudents.find(s => s.id === studentId);
            if (studentToDelete && studentToDelete.originalData) {
              // Permanently delete from deleted_students collection
              await deleteDoc(doc(db, 'deleted_students', studentId));
              setDeletedStudents(prev => prev.filter(s => s.id !== studentId));
              deletedCount++;
            }
          } catch (error) {
            console.error(`Error deleting student ${studentId}:`, error);
          }
        }
        setSelectedStudents([]);
        showSuccess(`${deletedCount} students permanently deleted!`);
      } else if (bulkActionType === 'quizzes') {
        let deletedCount = 0;
        setEntityOperationProgress({ isActive: true, entity: 'quiz', operation: 'delete', current: 0, total: selectedQuizzes.length, currentName: '' });
        for (let i = 0; i < selectedQuizzes.length; i++) {
          const quizId = selectedQuizzes[i];
          try {
            // Get quiz data before deletion for notification
            const quizToDelete = deletedQuizzes.find(q => q.id === quizId);
            if (quizToDelete && quizToDelete.originalData) {
              setEntityOperationProgress(prev => ({ ...prev, current: i + 1, currentName: quizToDelete.originalData?.title || 'Quiz' }));
              
              // Permanently delete all related assignment data from Firebase
              await permanentlyDeleteQuizFromFirebase(quizId, quizToDelete.originalData?.title || 'Quiz');
              
              // Permanently delete from deleted_quizzes collection
              await deleteDoc(doc(db, 'deleted_quizzes', quizId));
              setDeletedQuizzes(prev => prev.filter(q => q.id !== quizId));
              deletedCount++;
            }
          } catch (error) {
            console.error(`Error deleting quiz ${quizId}:`, error);
          }
        }
        setEntityOperationProgress({ isActive: false, entity: '', operation: '', current: 0, total: 0, currentName: '' });
        setSelectedQuizzes([]);
        showSuccess(`${deletedCount} quizzes and all related data permanently deleted!`);
      } else if (bulkActionType === 'admins') {
        let deletedCount = 0;
        setEntityOperationProgress({ isActive: true, entity: 'admin', operation: 'delete', current: 0, total: selectedAdmins.length, currentName: '' });
        for (let i = 0; i < selectedAdmins.length; i++) {
          const adminId = selectedAdmins[i];
          try {
            const admin = deletedAdmins.find(a => a.id === adminId);
            if (admin) {
              setEntityOperationProgress(prev => ({ ...prev, current: i + 1, currentName: `${admin.originalData?.firstName || ''} ${admin.originalData?.lastName || ''}`.trim() || 'Admin' }));
            }
            await deleteDoc(doc(db, 'deleted_admins', adminId));
            setDeletedAdmins(prev => prev.filter(a => a.id !== adminId));
            deletedCount++;
          } catch (error) {
            console.error(`Error deleting admin ${adminId}:`, error);
          }
        }
        setEntityOperationProgress({ isActive: false, entity: '', operation: '', current: 0, total: 0, currentName: '' });
        setSelectedAdmins([]);
        showSuccess(`${deletedCount} admins permanently deleted!`);
      } else if (bulkActionType === 'sections') {
        let deletedCount = 0;
        setEntityOperationProgress({ isActive: true, entity: 'section', operation: 'delete', current: 0, total: selectedSections.length, currentName: '' });
        for (let i = 0; i < selectedSections.length; i++) {
          const sectionId = selectedSections[i];
          try {
            const section = deletedSections.find(s => s.id === sectionId);
            if (section && section.originalData) {
              setEntityOperationProgress(prev => ({ ...prev, current: i + 1, currentName: section.originalData?.name || 'Section' }));
              // Permanently delete section
              await permanentlyDeleteSection(sectionId);
              deletedCount++;
            }
          } catch (error) {
            console.error(`Error deleting section ${sectionId}:`, error);
          }
        }
        setEntityOperationProgress({ isActive: false, entity: '', operation: '', current: 0, total: 0, currentName: '' });
        setSelectedSections([]);
        showSuccess(`${deletedCount} sections permanently deleted!`);
      }
    setShowBulkDeleteModal(false);
    setBulkActionType('');
    bulkDeleteLoading.stop(true);
  } catch (error) {
    console.error('Error in bulk delete:', error);
    showError('Error during bulk deletion. Some items may not have been deleted.');
    bulkDeleteLoading.stop(false);
  }
};

  // Don't render until we have teacher email
  if (!currentTeacherEmail) {
    return (
      <LoadingCard 
        title="Loading..."
        message="Please wait while we initialize the application."
      />
    );
  }

  // Check if user has access to archive (only after permissions are loaded)
  if (teacherRole && teacherPermissions && Object.keys(teacherPermissions).length > 0 && !canAccessArchive) {
    return (
      <div className="access-denied">
        <i className="ri-lock-line"></i>
        <h2>Access Denied</h2>
        <p>You do not have permission to access the archive.</p>
        <p>Please contact your administrator if you need access.</p>
      </div>
    );
  }

  // Show loading state while data is being fetched
  if (loading || pageLoading.isLoading || dataLoading.isLoading) {
    return (
      <LoadingCard 
        title={pageLoading.message || dataLoading.message || "Loading archive..."}
        message="Please wait while we load your archived data."
      />
    );
  }

  return (
    <div className="archive-container">
      {/* Professional Header Section */}
          <div style={{ 
            marginBottom: 32, 
            borderBottom: '2px solid #e9ecef', 
            padding: '20px 24px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
            borderRadius: 16,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <div>
              <h1 style={{ 
                fontSize: 32, 
                fontWeight: 700, 
                color: '#2c3e50', 
                margin: '0 0 4px 0',
                letterSpacing: '-0.025em'
              }}>
                Archive
              </h1>
              <div style={{ color: '#6b7280', fontSize: 16, marginTop: 4 }}>
                Review, restore, or permanently remove archived students, sections, admins, and quizzes.
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, padding: '0 24px' }}>
            {canViewStudentsTab && checkUserPermissions(teacherRole, teacherPermissions, 'access_archive') && (
              <button
                onClick={() => setActiveTab('students')}
                style={{
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 24px',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: activeTab === 'students' ? '#f9efc3' : '#f8f9fa',
                  color: activeTab === 'students' ? '#2c3e50' : '#6c757d'
                }}
                onMouseOver={(e) => {
                  if (activeTab !== 'students') {
                    e.target.style.background = '#e9ecef';
                  }
                }}
                onMouseOut={(e) => {
                  if (activeTab !== 'students') {
                    e.target.style.background = '#f8f9fa';
                  }
                }}
              >
                Students ({deletedStudents.length})
              </button>
            )}
          
          {/* Sections Tab - Role-based visibility */}
          {canViewSectionsTab && (
            <button
              onClick={() => setActiveTab('sections')}
              style={{
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: activeTab === 'sections' ? '#e6d1b3' : '#f8f9fa',
                color: activeTab === 'sections' ? '#2c3e50' : '#6c757d'
              }}
              onMouseOver={(e) => {
                if (activeTab !== 'sections') {
                  e.target.style.background = '#e9ecef';
                }
              }}
              onMouseOut={(e) => {
                if (activeTab !== 'sections') {
                  e.target.style.background = '#f8f9fa';
                }
              }}
            >
              Sections ({deletedSections.length})
            </button>
          )}

          {canViewAdminsTab && canViewAdminArchive && (
            <button
              onClick={() => setActiveTab('admins')}
              style={{
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: activeTab === 'admins' ? '#e6b3b3' : '#f8f9fa',
                color: activeTab === 'admins' ? '#2c3e50' : '#6c757d'
              }}
              onMouseOver={(e) => {
                if (activeTab !== 'admins') {
                  e.target.style.background = '#e9ecef';
                }
              }}
              onMouseOut={(e) => {
                if (activeTab !== 'admins') {
                  e.target.style.background = '#f8f9fa';
                }
              }}
            >
              Admins ({deletedAdmins.length})
            </button>
          )}
          {canViewQuizzesTab && (
            <button
              onClick={() => setActiveTab('quizzes')}
              style={{
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: activeTab === 'quizzes' ? '#b3e6c7' : '#f8f9fa',
                color: activeTab === 'quizzes' ? '#2c3e50' : '#6c757d'
              }}
              onMouseOver={(e) => {
                if (activeTab !== 'quizzes') {
                  e.target.style.background = '#e9ecef';
                }
              }}
              onMouseOut={(e) => {
                if (activeTab !== 'quizzes') {
                  e.target.style.background = '#f8f9fa';
                }
              }}
            >
              Quizzes ({deletedQuizzes.length})
            </button>
          )}
          </div>

          {/* Content Area */}
          <div style={{ padding: '0 24px' }}>
            {error && (
              <div style={{ 
                background: '#fff5f5', 
                border: '1px solid #fed7d7', 
                borderRadius: 12, 
                padding: 20, 
                marginBottom: 24,
                color: '#c53030'
              }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Error loading archive:</div>
                <div>{error}</div>
                <button 
                  onClick={() => window.location.reload()} 
                  style={{
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 16px',
                    marginTop: 12,
                    cursor: 'pointer'
                  }}
                >
                  Retry
                </button>
              </div>
            )}
            
            {loading ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 40px',
                background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                borderRadius: 24,
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(20px)',
                minWidth: 280,
                margin: '40px auto',
                maxWidth: 400
              }}>
                {/* Professional Spinner */}
                <div style={{
                  position: 'relative',
                  width: 56,
                  height: 56,
                  marginBottom: 24
                }}>
                  <div style={{
                    width: '100%',
                    height: '100%',
                    border: '4px solid rgba(79, 163, 126, 0.1)',
                    borderTop: '4px solid #4fa37e',
                    borderRadius: '50%',
                    animation: 'spin 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                    position: 'absolute',
                    top: 0,
                    left: 0
                  }}></div>
                  <div style={{
                    width: '100%',
                    height: '100%',
                    border: '4px solid transparent',
                    borderTop: '4px solid rgba(79, 163, 126, 0.3)',
                    borderRadius: '50%',
                    animation: 'spin 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite reverse',
                    position: 'absolute',
                    top: 0,
                    left: 0
                  }}></div>
                </div>
                
                {/* Professional Text */}
                <h3 style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: '#2c3e50',
                  margin: '0 0 8px 0',
                  textAlign: 'center',
                  letterSpacing: '-0.2px'
                }}>
                  Loading Archive
                </h3>
                
                <p style={{
                  fontSize: 14,
                  color: '#6c757d',
                  margin: 0,
                  textAlign: 'center',
                  lineHeight: 1.5,
                  maxWidth: 200
                }}>
                  Fetching deleted items and archive data...
                </p>
                
                {/* Progress Indicator */}
                <div style={{
                  display: 'flex',
                  gap: 6,
                  marginTop: 20
                }}>
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#4fa37e',
                    animation: 'pulse 1.4s ease-in-out infinite'
                  }}></div>
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#4fa37e',
                    animation: 'pulse 1.4s ease-in-out infinite 0.2s'
                  }}></div>
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#4fa37e',
                    animation: 'pulse 1.4s ease-in-out infinite 0.4s'
                  }}></div>
                </div>
                
                <style jsx>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                  @keyframes pulse {
                    0%, 100% { 
                      opacity: 0.3; 
                      transform: scale(1); 
                    }
                    50% { 
                      opacity: 1; 
                      transform: scale(1.3); 
                    }
                  }
                `}</style>
              </div>
            ) : (
              <div>
            {/* Students Tab */}
            {activeTab === 'students' && checkUserPermissions(teacherRole, teacherPermissions, 'access_archive') && (
                  <div style={{ background: '#f8f9fa', borderRadius: 16, padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                      <h2 style={{ margin: 0, fontSize: 24, color: '#2c3e50' }}>
                      Deleted Students
                    </h2>
                      {deletedStudents.length > 0 && (
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          {selectedStudents.length > 0 && (
                            <>
                              {canRestoreItems && (
                                <button
                                  onClick={() => handleBulkRestoreClick('students')}
                                  style={{
                                    background: 'rgba(79, 163, 126, 0.1)',
                                    color: '#4fa37e',
                                    border: '1px solid rgba(79, 163, 126, 0.2)',
                                    borderRadius: 12,
                                    padding: '8px 16px',
                                    fontSize: 14,
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.background = 'rgba(79, 163, 126, 0.2)';
                                    e.target.style.borderColor = 'rgba(79, 163, 126, 0.4)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.background = 'rgba(79, 163, 126, 0.1)';
                                    e.target.style.borderColor = 'rgba(79, 163, 126, 0.2)';
                                  }}
                                >
                                  <i className="ri-refresh-line" style={{ fontSize: 14 }}></i>
                                  {selectedStudents.length === deletedStudents.length ? 'Restore All' : `Restore Selected (${selectedStudents.length})`}
                                </button>
                              )}
                              {canPermanentlyDelete && (
                                <button
                                  onClick={() => handleBulkDeleteClick('students')}
                                  style={{
                                    background: 'rgba(220, 53, 69, 0.1)',
                                    color: '#dc3545',
                                    border: '1px solid rgba(220, 53, 69, 0.2)',
                                    borderRadius: 12,
                                    padding: '8px 16px',
                                    fontSize: 14,
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.background = 'rgba(220, 53, 69, 0.2)';
                                    e.target.style.borderColor = 'rgba(220, 53, 69, 0.4)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.background = 'rgba(220, 53, 69, 0.1)';
                                    e.target.style.borderColor = 'rgba(220, 53, 69, 0.2)';
                                  }}
                                >
                                  <i className="ri-delete-bin-6-line" style={{ fontSize: 14 }}></i>
                                  {selectedStudents.length === deletedStudents.length ? 'Delete All' : `Delete Selected (${selectedStudents.length})`}
                                </button>
                              )}
                            </>
                          )}
                          <button
                            onClick={toggleAllStudents}
                            style={{
                              background: selectedStudents.length === deletedStudents.length 
                                ? 'rgba(220, 53, 69, 0.1)'
                                : 'rgba(79, 163, 126, 0.1)',
                              color: selectedStudents.length === deletedStudents.length 
                                ? '#dc3545'
                                : '#4fa37e',
                              border: selectedStudents.length === deletedStudents.length 
                                ? '1px solid rgba(220, 53, 69, 0.2)'
                                : '1px solid rgba(79, 163, 126, 0.2)',
                              borderRadius: 12, 
                              padding: '12px 20px',
                              fontSize: 14, 
                              fontWeight: 600, 
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 8,
                              width: '150px',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                            onMouseEnter={(e) => {
                              if (selectedStudents.length === deletedStudents.length) {
                                e.target.style.background = 'rgba(220, 53, 69, 0.2)';
                                e.target.style.borderColor = 'rgba(220, 53, 69, 0.4)';
                              } else {
                                e.target.style.background = 'rgba(79, 163, 126, 0.2)';
                                e.target.style.borderColor = 'rgba(79, 163, 126, 0.4)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedStudents.length === deletedStudents.length) {
                                e.target.style.background = 'rgba(220, 53, 69, 0.1)';
                                e.target.style.borderColor = 'rgba(220, 53, 69, 0.2)';
                              } else {
                                e.target.style.background = 'rgba(79, 163, 126, 0.1)';
                                e.target.style.borderColor = 'rgba(79, 163, 126, 0.2)';
                              }
                            }}
                          >
                            <i className={selectedStudents.length === deletedStudents.length ? 'ri-checkbox-line' : 'ri-checkbox-blank-line'} style={{ fontSize: 16 }}></i>
                            {selectedStudents.length === deletedStudents.length ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                      )}
                    </div>
                    {deletedStudents.length === 0 ? (
                      <div style={{ 
                        textAlign: 'center', 
                        padding: 40, 
                        color: '#6c757d',
                        fontSize: 16
                      }}>
                        No deleted students found
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {deletedStudents.map((student) => {
                          // Skip rendering if student doesn't have required data
                          if (!student.originalData) {
                            console.warn('Skipping student without originalData:', student);
                            return null;
                          }
                          
                          return (
                            <div
                              key={student.id}
                              style={{
                                background: selectedStudents.includes(student.id) 
                                  ? 'rgba(79, 163, 126, 0.08)'
                                  : 'white',
                                color: '#2c3e50',
                                borderRadius: 12,
                                padding: 20,
                                border: selectedStudents.includes(student.id) 
                                  ? '2px solid rgba(79, 163, 126, 0.3)'
                                  : '1px solid #e9ecef',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 16,
                                transition: 'all 0.3s ease',
                                boxShadow: selectedStudents.includes(student.id) 
                                  ? '0 4px 12px rgba(79, 163, 126, 0.15)'
                                  : '0 2px 4px rgba(0,0,0,0.05)'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedStudents.includes(student.id)}
                                onChange={() => toggleStudentSelection(student.id)}
                                style={{
                                  width: 20,
                                  height: 20,
                                  cursor: 'pointer',
                                  accentColor: '#4fa37e'
                                }}
                              />
                              <img 
                                src={student.originalData?.avatar || '/avatar3.png'} 
                                alt="avatar" 
                                style={{ 
                                  width: 48, 
                                  height: 48, 
                                  borderRadius: '50%',
                                  border: '2px solid #e9ecef'
                                }} 
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ 
                                  fontSize: 18, 
                                  fontWeight: 600, 
                                  marginBottom: 4
                                }}>
                                  {student.originalData?.firstName} {student.originalData?.middleName} {student.originalData?.lastName}
                                </div>
                                <div style={{ 
                                  fontSize: 14, 
                                  opacity: 0.8,
                                  marginBottom: 4
                                }}>
                                  Section: {student.originalData?.sectionName || 'Unassigned'}
                                </div>
                                <div style={{ 
                                  fontSize: 12, 
                                  opacity: 0.7
                                }}>
                                  Deleted on: {formatDate(student.deletedAt)} by {student.deletedBy}
                                </div>
                              </div>
                              {selectedStudents.length < deletedStudents.length && (
                              <div style={{ display: 'flex', gap: 8 }}>
                                {canRestoreItems && (
                                  <button
                                    onClick={() => handleRestore(student, 'student')}
                                    disabled={restoreLoading[student.id]}
                                    style={{
                                        background: selectedStudents.includes(student.id) 
                                          ? 'rgba(255,255,255,0.2)'
                                          : 'rgba(79, 163, 126, 0.1)',
                                      color: selectedStudents.includes(student.id) 
                                        ? 'white'
                                        : '#4fa37e',
                                        border: selectedStudents.includes(student.id) 
                                          ? '1px solid rgba(255,255,255,0.3)'
                                          : '1px solid rgba(79, 163, 126, 0.2)',
                                      borderRadius: 12,
                                      padding: '8px 16px',
                                      fontSize: 14,
                                      cursor: restoreLoading[student.id] ? 'not-allowed' : 'pointer',
                                      fontWeight: 600,
                                      opacity: restoreLoading[student.id] ? 0.6 : 1,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      if (!restoreLoading[student.id] && !selectedStudents.includes(student.id)) {
                                        e.target.style.background = 'rgba(79, 163, 126, 0.2)';
                                        e.target.style.borderColor = 'rgba(79, 163, 126, 0.4)';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (!restoreLoading[student.id] && !selectedStudents.includes(student.id)) {
                                        e.target.style.background = 'rgba(79, 163, 126, 0.1)';
                                        e.target.style.borderColor = 'rgba(79, 163, 126, 0.2)';
                                      }
                                    }}
                                  >
                                    {restoreLoading[student.id] ? (
                                      <>
                                        <i className="ri-loader-4-line" style={{ 
                                          animation: 'spin 1s linear infinite',
                                          marginRight: 4 
                                        }}></i>
                                        Restoring...
                                      </>
                                    ) : (
                                      <>
                                        <i className="ri-refresh-line" style={{ fontSize: 14 }}></i>
                                        Restore
                                      </>
                                    )}
                                  </button>
                                )}
                                {canPermanentlyDelete && (
                                  <button
                                    onClick={() => handleDeleteForever(student, 'student')}
                                    disabled={deleteLoading[student.id]}
                                    style={{
                                        background: selectedStudents.includes(student.id) 
                                          ? 'rgba(255,255,255,0.2)'
                                          : 'rgba(220, 53, 69, 0.1)',
                                      color: selectedStudents.includes(student.id) 
                                        ? 'white'
                                        : '#dc3545',
                                        border: selectedStudents.includes(student.id) 
                                          ? '1px solid rgba(255,255,255,0.3)'
                                          : '1px solid rgba(220, 53, 69, 0.2)',
                                      borderRadius: 12,
                                      padding: '8px 16px',
                                      fontSize: 14,
                                      cursor: deleteLoading[student.id] ? 'not-allowed' : 'pointer',
                                      fontWeight: 600,
                                      opacity: deleteLoading[student.id] ? 0.6 : 1,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      if (!deleteLoading[student.id] && !selectedStudents.includes(student.id)) {
                                        e.target.style.background = 'rgba(220, 53, 69, 0.2)';
                                        e.target.style.borderColor = 'rgba(220, 53, 69, 0.4)';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (!deleteLoading[student.id] && !selectedStudents.includes(student.id)) {
                                        e.target.style.background = 'rgba(220, 53, 69, 0.1)';
                                        e.target.style.borderColor = 'rgba(220, 53, 69, 0.2)';
                                      }
                                    }}
                                  >
                                    {deleteLoading[student.id] ? (
                                      <>
                                        <i className="ri-loader-4-line" style={{ 
                                          animation: 'spin 1s linear infinite',
                                          marginRight: 4 
                                        }}></i>
                                        Deleting...
                                      </>
                                    ) : (
                                      <>
                                        <i className="ri-delete-bin-6-line" style={{ fontSize: 14 }}></i>
                                        Delete
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Admins Tab */}
                {activeTab === 'admins' && (
                  <div style={{ background: '#f8f9fa', borderRadius: 16, padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                      <h2 style={{ margin: 0, fontSize: 24, color: '#2c3e50' }}>
                        Deleted Admins
                      </h2>
                      {deletedAdmins.length > 0 && (
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          {selectedAdmins.length > 0 && (
                            <>
                              {canRestoreItems && (
                                <button
                                  onClick={() => handleBulkRestoreClick('admins')}
                                  style={{
                                    background: 'rgba(79, 163, 126, 0.1)',
                                    color: '#4fa37e',
                                    border: '1px solid rgba(79, 163, 126, 0.2)',
                                    borderRadius: 12,
                                    padding: '8px 16px',
                                    fontSize: 14,
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.background = 'rgba(79, 163, 126, 0.2)';
                                    e.target.style.borderColor = 'rgba(79, 163, 126, 0.4)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.background = 'rgba(79, 163, 126, 0.1)';
                                    e.target.style.borderColor = 'rgba(79, 163, 126, 0.2)';
                                  }}
                                >
                                  <i className="ri-refresh-line" style={{ fontSize: 14 }}></i>
                                  {selectedAdmins.length === deletedAdmins.length ? 'Restore All' : `Restore Selected (${selectedAdmins.length})`}
                                </button>
                              )}
                              {canPermanentlyDelete && (
                                <button
                                  onClick={() => handleBulkDeleteClick('admins')}
                                  style={{
                                    background: 'rgba(220, 53, 69, 0.1)',
                                    color: '#dc3545',
                                    border: '1px solid rgba(220, 53, 69, 0.2)',
                                    borderRadius: 12,
                                    padding: '8px 16px',
                                    fontSize: 14,
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.background = 'rgba(220, 53, 69, 0.2)';
                                    e.target.style.borderColor = 'rgba(220, 53, 69, 0.4)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.background = 'rgba(220, 53, 69, 0.1)';
                                    e.target.style.borderColor = 'rgba(220, 53, 69, 0.2)';
                                  }}
                                >
                                  <i className="ri-delete-bin-6-line" style={{ fontSize: 14 }}></i>
                                  {selectedAdmins.length === deletedAdmins.length ? 'Delete All' : `Delete Selected (${selectedAdmins.length})`}
                                </button>
                              )}
                            </>
                          )}
                          <button
                            onClick={toggleAllAdmins}
                            style={{
                              background: selectedAdmins.length === deletedAdmins.length 
                                ? 'rgba(220, 53, 69, 0.1)'
                                : 'rgba(79, 163, 126, 0.1)',
                              color: selectedAdmins.length === deletedAdmins.length 
                                ? '#dc3545'
                                : '#4fa37e',
                              border: selectedAdmins.length === deletedAdmins.length 
                                ? '1px solid rgba(220, 53, 69, 0.2)'
                                : '1px solid rgba(79, 163, 126, 0.2)',
                              borderRadius: 12, 
                              padding: '12px 20px',
                              fontSize: 14, 
                              fontWeight: 600, 
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 8,
                              width: '150px',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                            onMouseEnter={(e) => {
                              if (selectedAdmins.length === deletedAdmins.length) {
                                e.target.style.background = 'rgba(220, 53, 69, 0.2)';
                                e.target.style.borderColor = 'rgba(220, 53, 69, 0.4)';
                              } else {
                                e.target.style.background = 'rgba(79, 163, 126, 0.2)';
                                e.target.style.borderColor = 'rgba(79, 163, 126, 0.4)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedAdmins.length === deletedAdmins.length) {
                                e.target.style.background = 'rgba(220, 53, 69, 0.1)';
                                e.target.style.borderColor = 'rgba(220, 53, 69, 0.2)';
                              } else {
                                e.target.style.background = 'rgba(79, 163, 126, 0.1)';
                                e.target.style.borderColor = 'rgba(79, 163, 126, 0.2)';
                              }
                            }}
                          >
                            <i className={selectedAdmins.length === deletedAdmins.length ? 'ri-checkbox-line' : 'ri-checkbox-blank-line'} style={{ fontSize: 16 }}></i>
                            {selectedAdmins.length === deletedAdmins.length ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                      )}
                    </div>
                    {deletedAdmins.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 40, color: '#6c757d', fontSize: 16 }}>
                        No deleted admins found
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {deletedAdmins.map((admin) => (
                          <div key={admin.id} style={{
                            background: 'white',
                            borderRadius: 12,
                            padding: 20,
                            border: '1px solid #e9ecef',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16
                          }}>
                            <button
                              onClick={() => {
                                if (selectedAdmins.includes(admin.id)) {
                                  setSelectedAdmins(prev => prev.filter(id => id !== admin.id));
                                } else {
                                  setSelectedAdmins(prev => [...prev, admin.id]);
                                }
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 4,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                            >
                              <i className={selectedAdmins.includes(admin.id) ? 'ri-checkbox-line' : 'ri-checkbox-blank-line'} style={{ fontSize: 20, color: selectedAdmins.includes(admin.id) ? '#28a745' : '#6c757d' }}></i>
                            </button>
                            <img 
                              src={admin.originalData?.avatar || '/TeacherProfile.png'} 
                              alt="avatar" 
                              style={{ width: 48, height: 48, borderRadius: '50%', border: '2px solid #e9ecef' }} 
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 18, fontWeight: 600 }}>
                                {admin.originalData?.firstName} {admin.originalData?.lastName}
                              </div>
                              <div style={{ fontSize: 14, opacity: 0.8 }}>
                                {admin.originalData?.email} • {admin.originalData?.role}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              {canManageAdmins && (
                                <button
                                  onClick={() => { setItemToRestore(admin); setModalType('admin'); setShowRestoreModal(true); }}
                                  style={{ 
                                    background: 'rgba(79, 163, 126, 0.1)', 
                                    color: '#4fa37e', 
                                    border: '1px solid rgba(79, 163, 126, 0.2)', 
                                    borderRadius: 12, 
                                    padding: '8px 16px', 
                                    fontSize: 14, 
                                    cursor: 'pointer', 
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.background = 'rgba(79, 163, 126, 0.2)';
                                    e.target.style.borderColor = 'rgba(79, 163, 126, 0.4)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.background = 'rgba(79, 163, 126, 0.1)';
                                    e.target.style.borderColor = 'rgba(79, 163, 126, 0.2)';
                                  }}
                                >
                                  <i className="ri-refresh-line" style={{ fontSize: 14 }}></i>
                                  Restore
                                </button>
                              )}
                              {canManageAdmins && (
                                <button
                                  onClick={() => { setItemToDeleteForever(admin); setModalType('admin'); setShowDeleteForeverModal(true); }}
                                  style={{ 
                                    background: 'rgba(220, 53, 69, 0.1)', 
                                    color: '#dc3545', 
                                    border: '1px solid rgba(220, 53, 69, 0.2)', 
                                    borderRadius: 12, 
                                    padding: '8px 16px', 
                                    fontSize: 14, 
                                    cursor: 'pointer', 
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.background = 'rgba(220, 53, 69, 0.2)';
                                    e.target.style.borderColor = 'rgba(220, 53, 69, 0.4)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.background = 'rgba(220, 53, 69, 0.1)';
                                    e.target.style.borderColor = 'rgba(220, 53, 69, 0.2)';
                                  }}
                                >
                                  <i className="ri-delete-bin-6-line" style={{ fontSize: 14 }}></i>
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Quizzes Tab */}
                {activeTab === 'quizzes' && (
                  <div style={{ background: '#f8f9fa', borderRadius: 16, padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                      <h2 style={{ margin: 0, fontSize: 24, color: '#2c3e50' }}>
                      Deleted Quizzes
                    </h2>
                      {deletedQuizzes.length > 0 && (
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          {selectedQuizzes.length > 0 && (
                            <>
                              {canRestoreItems && (
                                <button
                                  onClick={() => handleBulkRestoreClick('quizzes')}
                                  style={{
                                    background: 'rgba(79, 163, 126, 0.1)',
                                    color: '#4fa37e',
                                    border: '1px solid rgba(79, 163, 126, 0.2)',
                                    borderRadius: 12,
                                    padding: '8px 16px',
                                    fontSize: 14,
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.background = 'rgba(79, 163, 126, 0.2)';
                                    e.target.style.borderColor = 'rgba(79, 163, 126, 0.4)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.background = 'rgba(79, 163, 126, 0.1)';
                                    e.target.style.borderColor = 'rgba(79, 163, 126, 0.2)';
                                  }}
                                >
                                  <i className="ri-refresh-line" style={{ fontSize: 14 }}></i>
                                  {selectedQuizzes.length === deletedQuizzes.length ? 'Restore All' : `Restore Selected (${selectedQuizzes.length})`}
                                </button>
                          )}
                              {canPermanentlyDelete && (
                                <button
                                  onClick={() => handleBulkDeleteClick('quizzes')}
                                  style={{
                                    background: 'rgba(220, 53, 69, 0.1)',
                                    color: '#dc3545',
                                    border: '1px solid rgba(220, 53, 69, 0.2)',
                                    borderRadius: 12,
                                    padding: '8px 16px',
                                    fontSize: 14,
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.background = 'rgba(220, 53, 69, 0.2)';
                                    e.target.style.borderColor = 'rgba(220, 53, 69, 0.4)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.background = 'rgba(220, 53, 69, 0.1)';
                                    e.target.style.borderColor = 'rgba(220, 53, 69, 0.2)';
                                  }}
                                >
                                  <i className="ri-delete-bin-6-line" style={{ fontSize: 14 }}></i>
                                  {selectedQuizzes.length === deletedQuizzes.length ? 'Delete All' : `Delete Selected (${selectedQuizzes.length})`}
                                </button>
                              )}
                            </>
                          )}
                          <button
                            onClick={toggleAllQuizzes}
                            style={{
                              background: selectedQuizzes.length === deletedQuizzes.length 
                                ? 'rgba(220, 53, 69, 0.1)'
                                : 'rgba(79, 163, 126, 0.1)',
                              color: selectedQuizzes.length === deletedQuizzes.length 
                                ? '#dc3545'
                                : '#4fa37e',
                              border: selectedQuizzes.length === deletedQuizzes.length 
                                ? '1px solid rgba(220, 53, 69, 0.2)'
                                : '1px solid rgba(79, 163, 126, 0.2)',
                              borderRadius: 12, 
                              padding: '12px 20px',
                              fontSize: 14, 
                              fontWeight: 600, 
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 8,
                              width: '150px',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                            onMouseEnter={(e) => {
                              if (selectedQuizzes.length === deletedQuizzes.length) {
                                e.target.style.background = 'rgba(220, 53, 69, 0.2)';
                                e.target.style.borderColor = 'rgba(220, 53, 69, 0.4)';
                              } else {
                                e.target.style.background = 'rgba(79, 163, 126, 0.2)';
                                e.target.style.borderColor = 'rgba(79, 163, 126, 0.4)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedQuizzes.length === deletedQuizzes.length) {
                                e.target.style.background = 'rgba(220, 53, 69, 0.1)';
                                e.target.style.borderColor = 'rgba(220, 53, 69, 0.2)';
                              } else {
                                e.target.style.background = 'rgba(79, 163, 126, 0.1)';
                                e.target.style.borderColor = 'rgba(79, 163, 126, 0.2)';
                              }
                            }}
                          >
                            <i className={selectedQuizzes.length === deletedQuizzes.length ? 'ri-checkbox-line' : 'ri-checkbox-blank-line'} style={{ fontSize: 16 }}></i>
                            {selectedQuizzes.length === deletedQuizzes.length ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                      )}
                    </div>
                    {deletedQuizzes.length === 0 ? (
                      <div style={{ 
                        textAlign: 'center', 
                        padding: 40, 
                        color: '#6c757d',
                        fontSize: 16
                      }}>
                        No deleted quizzes found
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {deletedQuizzes.map((quiz) => {
                          // Skip rendering if quiz doesn't have required data
                          if (!quiz.originalData) {
                            console.warn('Skipping quiz without originalData:', quiz);
                            return null;
                          }
                          
                          return (
                            <div
                              key={quiz.id}
                              style={{
                                background: selectedQuizzes.includes(quiz.id) 
                                  ? 'rgba(79, 163, 126, 0.08)'
                                  : 'white',
                                color: '#2c3e50',
                                borderRadius: 12,
                                padding: 20,
                                border: selectedQuizzes.includes(quiz.id) 
                                  ? '2px solid rgba(79, 163, 126, 0.3)'
                                  : '1px solid #e9ecef',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 16,
                                transition: 'all 0.3s ease',
                                boxShadow: selectedQuizzes.includes(quiz.id) 
                                  ? '0 4px 12px rgba(79, 163, 126, 0.15)'
                                  : '0 2px 4px rgba(0,0,0,0.05)'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedQuizzes.includes(quiz.id)}
                                onChange={() => toggleQuizSelection(quiz.id)}
                                style={{
                                  width: 20,
                                  height: 20,
                                  cursor: 'pointer',
                                  accentColor: '#4fa37e'
                                }}
                              />
                              <div style={{ 
                                width: 48, 
                                height: 48, 
                                borderRadius: 12,
                                background: 'linear-gradient(135deg, #4fa37e 0%, #3d8b6f 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: 24,
                                flexShrink: 0
                              }}>
                                📝
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ 
                                  fontSize: 18, 
                                  fontWeight: 600, 
                                  marginBottom: 4
                                }}>
                                  {quiz.originalData?.title}
                                </div>
                                
                                <div style={{ 
                                  fontSize: 12, 
                                  opacity: 0.7
                                }}>
                                  Deleted on: {formatDate(quiz.deletedAt)} by {quiz.deletedBy}
                                </div>
                              </div>
                              {selectedQuizzes.length < deletedQuizzes.length && (
                              <div style={{ display: 'flex', gap: 8 }}>
                                {canRestoreItems && (
                                  <button
                                    onClick={() => handleRestore(quiz, 'quiz')}
                                    disabled={restoreLoading[quiz.id]}
                                    style={{
                                        background: selectedQuizzes.includes(quiz.id) 
                                          ? 'rgba(255,255,255,0.2)'
                                          : 'rgba(79, 163, 126, 0.1)',
                                      color: selectedQuizzes.includes(quiz.id) 
                                        ? 'white'
                                        : '#4fa37e',
                                        border: selectedQuizzes.includes(quiz.id) 
                                          ? '1px solid rgba(255,255,255,0.3)'
                                          : '1px solid rgba(79, 163, 126, 0.2)',
                                      borderRadius: 12,
                                      padding: '8px 16px',
                                      fontSize: 14,
                                      cursor: restoreLoading[quiz.id] ? 'not-allowed' : 'pointer',
                                      fontWeight: 600,
                                      opacity: restoreLoading[quiz.id] ? 0.6 : 1,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      if (!restoreLoading[quiz.id] && !selectedQuizzes.includes(quiz.id)) {
                                        e.target.style.background = 'rgba(79, 163, 126, 0.2)';
                                        e.target.style.borderColor = 'rgba(79, 163, 126, 0.4)';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (!restoreLoading[quiz.id] && !selectedQuizzes.includes(quiz.id)) {
                                        e.target.style.background = 'rgba(79, 163, 126, 0.1)';
                                        e.target.style.borderColor = 'rgba(79, 163, 126, 0.2)';
                                      }
                                    }}
                                  >
                                    {restoreLoading[quiz.id] ? (
                                      <>
                                        <i className="ri-loader-4-line" style={{ 
                                          animation: 'spin 1s linear infinite',
                                          marginRight: 4 
                                        }}></i>
                                        Restoring...
                                      </>
                                    ) : (
                                      <>
                                        <i className="ri-refresh-line" style={{ fontSize: 14 }}></i>
                                        Restore
                                      </>
                                    )}
                                  </button>
                                )}
                                {canPermanentlyDelete && (
                                  <button
                                    onClick={() => handleDeleteForever(quiz, 'quiz')}
                                    disabled={deleteLoading[quiz.id]}
                                    style={{
                                        background: selectedQuizzes.includes(quiz.id) 
                                          ? 'rgba(255,255,255,0.2)'
                                          : 'rgba(220, 53, 69, 0.1)',
                                      color: selectedQuizzes.includes(quiz.id) 
                                        ? 'white'
                                        : '#dc3545',
                                        border: selectedQuizzes.includes(quiz.id) 
                                          ? '1px solid rgba(255,255,255,0.3)'
                                          : '1px solid rgba(220, 53, 69, 0.2)',
                                      borderRadius: 12,
                                      padding: '8px 16px',
                                      fontSize: 14,
                                      cursor: deleteLoading[quiz.id] ? 'not-allowed' : 'pointer',
                                      fontWeight: 600,
                                      opacity: deleteLoading[quiz.id] ? 0.6 : 1,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      if (!deleteLoading[quiz.id] && !selectedQuizzes.includes(quiz.id)) {
                                        e.target.style.background = 'rgba(220, 53, 69, 0.2)';
                                        e.target.style.borderColor = 'rgba(220, 53, 69, 0.4)';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (!deleteLoading[quiz.id] && !selectedQuizzes.includes(quiz.id)) {
                                        e.target.style.background = 'rgba(220, 53, 69, 0.1)';
                                        e.target.style.borderColor = 'rgba(220, 53, 69, 0.2)';
                                      }
                                    }}
                                  >
                                    {deleteLoading[quiz.id] ? (
                                      <>
                                        <i className="ri-loader-4-line" style={{ 
                                          animation: 'spin 1s linear infinite',
                                          marginRight: 4 
                                        }}></i>
                                        Deleting...
                                      </>
                                    ) : (
                                      <>
                                        <i className="ri-delete-bin-6-line" style={{ fontSize: 14 }}></i>
                                        Delete
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Sections Tab */}
                {activeTab === 'sections' && (
                  <div style={{ background: '#f8f9fa', borderRadius: 16, padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                      <h2 style={{ margin: 0, fontSize: 24, color: '#2c3e50' }}>
                        Deleted Sections
                      </h2>
                      {deletedSections.length > 0 && (
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          {selectedSections.length > 0 && (
                            <>
                              {canRestoreItems && (
                                <button
                                  onClick={() => handleBulkRestoreClick('sections')}
                                  style={{
                                    background: 'rgba(79, 163, 126, 0.1)',
                                    color: '#4fa37e',
                                    border: '1px solid rgba(79, 163, 126, 0.2)',
                                    borderRadius: 12,
                                    padding: '8px 16px',
                                    fontSize: 14,
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.background = 'rgba(79, 163, 126, 0.2)';
                                    e.target.style.borderColor = 'rgba(79, 163, 126, 0.4)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.background = 'rgba(79, 163, 126, 0.1)';
                                    e.target.style.borderColor = 'rgba(79, 163, 126, 0.2)';
                                  }}
                                >
                                  <i className="ri-refresh-line" style={{ fontSize: 14 }}></i>
                                  {selectedSections.length === deletedSections.length ? 'Restore All' : `Restore Selected (${selectedSections.length})`}
                                </button>
                              )}
                              {canPermanentlyDelete && (
                                <button
                                  onClick={() => handleBulkDeleteClick('sections')}
                                  style={{
                                    background: 'rgba(220, 53, 69, 0.1)',
                                    color: '#dc3545',
                                    border: '1px solid rgba(220, 53, 69, 0.2)',
                                    borderRadius: 12,
                                    padding: '8px 16px',
                                    fontSize: 14,
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.target.style.background = 'rgba(220, 53, 69, 0.2)';
                                    e.target.style.borderColor = 'rgba(220, 53, 69, 0.4)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.target.style.background = 'rgba(220, 53, 69, 0.1)';
                                    e.target.style.borderColor = 'rgba(220, 53, 69, 0.2)';
                                  }}
                                >
                                  <i className="ri-delete-bin-6-line" style={{ fontSize: 14 }}></i>
                                  {selectedSections.length === deletedSections.length ? 'Delete All' : `Delete Selected (${selectedSections.length})`}
                                </button>
                              )}
                            </>
                          )}
                          <button
                            onClick={toggleAllSections}
                            style={{
                              background: selectedSections.length === deletedSections.length 
                                ? 'rgba(220, 53, 69, 0.1)'
                                : 'rgba(79, 163, 126, 0.1)',
                              color: selectedSections.length === deletedSections.length 
                                ? '#dc3545'
                                : '#4fa37e',
                              border: selectedSections.length === deletedSections.length 
                                ? '1px solid rgba(220, 53, 69, 0.2)'
                                : '1px solid rgba(79, 163, 126, 0.2)',
                              borderRadius: 12, 
                              padding: '12px 20px',
                              fontSize: 14, 
                              fontWeight: 600, 
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 8,
                              width: '150px',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                            onMouseEnter={(e) => {
                              if (selectedSections.length === deletedSections.length) {
                                e.target.style.background = 'rgba(220, 53, 69, 0.2)';
                                e.target.style.borderColor = 'rgba(220, 53, 69, 0.4)';
                              } else {
                                e.target.style.background = 'rgba(79, 163, 126, 0.2)';
                                e.target.style.borderColor = 'rgba(79, 163, 126, 0.4)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedSections.length === deletedSections.length) {
                                e.target.style.background = 'rgba(220, 53, 69, 0.1)';
                                e.target.style.borderColor = 'rgba(220, 53, 69, 0.2)';
                              } else {
                                e.target.style.background = 'rgba(79, 163, 126, 0.1)';
                                e.target.style.borderColor = 'rgba(79, 163, 126, 0.2)';
                              }
                            }}
                          >
                            <i className={selectedSections.length === deletedSections.length ? 'ri-checkbox-line' : 'ri-checkbox-blank-line'} style={{ fontSize: 16 }}></i>
                            {selectedSections.length === deletedSections.length ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {deletedSections.length === 0 ? (
                      <div style={{
                        textAlign: 'center',
                        padding: '60px 20px',
                        color: '#6c757d',
                        fontSize: 18,
                        fontStyle: 'italic'
                      }}>
                        <i className="ri-group-line" style={{ fontSize: '64px', marginBottom: '20px', display: 'block', opacity: 0.5 }}></i>
                        No deleted sections found
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {deletedSections.map((section) => (
                          <div key={section.id} style={{
                            background: selectedSections.includes(section.id) 
                              ? 'rgba(79, 163, 126, 0.08)'
                              : 'white',
                            color: '#2c3e50',
                            borderRadius: 12,
                            padding: 20,
                            border: selectedSections.includes(section.id) 
                              ? '2px solid rgba(79, 163, 126, 0.3)'
                              : '1px solid #e9ecef',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            transition: 'all 0.2s ease',
                            boxShadow: selectedSections.includes(section.id) 
                              ? '0 4px 12px rgba(79, 163, 126, 0.15)'
                              : '0 2px 4px rgba(0,0,0,0.05)'
                          }}>
                            <input
                              type="checkbox"
                              checked={selectedSections.includes(section.id)}
                              onChange={() => {
                                if (selectedSections.includes(section.id)) {
                                  setSelectedSections(prev => prev.filter(id => id !== section.id));
                                } else {
                                  setSelectedSections(prev => [...prev, section.id]);
                                }
                              }}
                              style={{
                                width: 20,
                                height: 20,
                                cursor: 'pointer',
                                accentColor: '#4fa37e'
                              }}
                            />
                            <div style={{
                              width: 48,
                              height: 48,
                              borderRadius: 12,
                              background: 'linear-gradient(135deg, #6f42c1 0%, #5a32a3 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontSize: 24,
                              flexShrink: 0
                            }}>
                              <i className="ri-group-line"></i>
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ 
                                fontSize: 18, 
                                fontWeight: 600, 
                                marginBottom: 4,
                                color: '#2c3e50'
                              }}>
                                {section.originalData?.name}
                              </div>
                              
                              {section.originalData?.description && (
                                <div style={{ 
                                  fontSize: 14, 
                                  color: '#6c757d',
                                  marginBottom: 4
                                }}>
                                  {section.originalData.description}
                                </div>
                              )}
                              
                              <div style={{ 
                                fontSize: 12, 
                                color: '#6c757d',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 16
                              }}>
                                <span>Students: {section.studentCount}</span>
                                <span>•</span>
                                <span>Deleted on: {new Date(section.deletedAt).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })} by {section.deletedBy}</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                onClick={() => {
                                  setSectionToRestore(section);
                                  setShowSectionRestoreModal(true);
                                }}
                                disabled={sectionRestoreLoading}
                                style={{
                                  background: 'rgba(79, 163, 126, 0.1)',
                                  color: '#4fa37e',
                                  border: '1px solid rgba(79, 163, 126, 0.2)',
                                  borderRadius: 12,
                                  padding: '8px 16px',
                                  fontSize: 14,
                                  cursor: sectionRestoreLoading ? 'not-allowed' : 'pointer',
                                  fontWeight: 600,
                                  transition: 'all 0.2s ease',
                                  opacity: sectionRestoreLoading ? 0.6 : 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6
                                }}
                                onMouseEnter={(e) => {
                                  if (!sectionRestoreLoading) {
                                    e.target.style.background = 'rgba(79, 163, 126, 0.2)';
                                    e.target.style.borderColor = 'rgba(79, 163, 126, 0.4)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!sectionRestoreLoading) {
                                    e.target.style.background = 'rgba(79, 163, 126, 0.1)';
                                    e.target.style.borderColor = 'rgba(79, 163, 126, 0.2)';
                                  }
                                }}
                              >
                                {sectionRestoreLoading ? (
                                  <>
                                    <i className="ri-loader-4-line" style={{ 
                                      animation: 'spin 1s linear infinite',
                                      marginRight: 4 
                                    }}></i>
                                    Restoring...
                                  </>
                                ) : (
                                  <>
                                    <i className="ri-refresh-line" style={{ fontSize: 14 }}></i>
                                    Restore
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => {
                                  setSectionToDelete(section);
                                  setShowSectionDeleteModal(true);
                                }}
                                disabled={sectionDeleteLoading[section.id]}
                                style={{
                                  background: 'rgba(220, 53, 69, 0.1)',
                                  color: '#dc3545',
                                  border: '1px solid rgba(220, 53, 69, 0.2)',
                                  borderRadius: 12,
                                  padding: '8px 16px',
                                  fontSize: 14,
                                  cursor: sectionDeleteLoading[section.id] ? 'not-allowed' : 'pointer',
                                  fontWeight: 600,
                                  transition: 'all 0.2s ease',
                                  opacity: sectionDeleteLoading[section.id] ? 0.6 : 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6
                                }}
                                onMouseEnter={(e) => {
                                  if (!sectionDeleteLoading[section.id]) {
                                    e.target.style.background = 'rgba(220, 53, 69, 0.2)';
                                    e.target.style.borderColor = 'rgba(220, 53, 69, 0.4)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!sectionDeleteLoading[section.id]) {
                                    e.target.style.background = 'rgba(220, 53, 69, 0.1)';
                                    e.target.style.borderColor = 'rgba(220, 53, 69, 0.2)';
                                  }
                                }}
                              >
                                {sectionDeleteLoading[section.id] ? (
                                  <>
                                    <i className="ri-loader-4-line" style={{ 
                                      animation: 'spin 1s linear infinite',
                                      marginRight: 4 
                                    }}></i>
                                    Deleting...
                                  </>
                                ) : (
                                  <>
                                    <i className="ri-delete-bin-6-line" style={{ fontSize: 14 }}></i>
                                    Delete
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
      {/* Restore Confirmation Modal */}
      {showRestoreModal && itemToRestore && canRestoreItems && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: 16,
            padding: 32,
            maxWidth: 480,
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #e9ecef'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 24
            }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: '#28a37e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 24,
                overflow: 'hidden'
              }}>
                {modalType === 'student' 
                  ? (
                    <img 
                      src={itemToRestore?.originalData?.avatar || '/avatar3.png'} 
                      alt="Student Avatar" 
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover',
                        borderRadius: '50%'
                      }} 
                    />
                  )
                  : '📝'
                }
              </div>
              <div>
                <h3 style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: '#2c3e50',
                  margin: '0 0 4px 0'
                }}>
                  Restore {modalType === 'student' ? 'Student' : 'Quiz'}
                </h3>
                <p style={{
                  fontSize: 16,
                  color: '#6c757d',
                  margin: 0
                }}>
                  Are you sure you want to restore this {modalType}?
                </p>
              </div>
            </div>

            {/* Student details intentionally hidden for a cleaner confirmation */}

            <div style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setShowRestoreModal(false);
                  setItemToRestore(null);
                  setModalType('');
                }}
                style={{
                  background: '#f8f9fa',
                  color: '#6c757d',
                  border: '1px solid #e9ecef',
                  borderRadius: 8,
                  padding: '12px 24px',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = '#e9ecef'}
                onMouseOut={(e) => e.target.style.background = '#f8f9fa'}
              >
                Cancel
              </button>
      <button
                onClick={() => modalType === 'student' ? restoreStudent(itemToRestore) : modalType === 'quiz' ? restoreQuiz(itemToRestore) : restoreAdmin(itemToRestore)}
                style={{
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 24px',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = '#218838'}
                onMouseOut={(e) => e.target.style.background = '#28a745'}
              >
                Restore {modalType === 'student' ? 'Student' : 'Quiz'}
              </button>
            </div>
          </div>
        </div>
      )}

        {/* Delete Forever Confirmation Modal */}
        {showDeleteForeverModal && itemToDeleteForever && canPermanentlyDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: 16,
            padding: 32,
            maxWidth: 480,
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #e9ecef'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 24
            }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: '#dc3545',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 24,
                fontWeight: 'bold',
                border: '2px solid #c82333',
                flexShrink: 0
              }}>
                ⚠️
              </div>
              <div>
                <h3 style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: '#2c3e50',
                  margin: '0 0 4px 0'
                }}>
                  Delete
                </h3>
                <p style={{
                  fontSize: 16,
                  color: '#6c757d',
                  margin: 0
                }}>
                  Are you sure you want to permanently delete this {modalType}? This action cannot be undone.
                </p>
              </div>
            </div>

            {/* Student details intentionally hidden for a cleaner confirmation */}

            {/* For admin deletion, we intentionally do not render extra details */}

            <div style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setShowDeleteForeverModal(false);
                  setItemToDeleteForever(null);
                  setModalType('');
                }}
                style={{
                  background: '#f8f9fa',
                  color: '#6c757d',
                  border: '1px solid #e9ecef',
                  borderRadius: 8,
                  padding: '12px 24px',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = '#e9ecef'}
                onMouseOut={(e) => e.target.style.background = '#f8f9fa'}
              >
                Cancel
              </button>
      <button
                onClick={() => modalType === 'student' ? permanentlyDeleteStudent(itemToDeleteForever.id) : modalType === 'quiz' ? permanentlyDeleteQuiz(itemToDeleteForever.id) : permanentlyDeleteAdmin(itemToDeleteForever.id)}
                style={{
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 24px',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = '#c82333'}
                onMouseOut={(e) => e.target.style.background = '#dc3545'}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Restore Confirmation Modal */}
      {showBulkRestoreModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: 16,
            padding: 32,
            maxWidth: 480,
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #e9ecef'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 24
            }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: '#28a745',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 24,
                flexShrink: 0
              }}>
                <i className="ri-refresh-line"></i>
              </div>
              <div>
                <h3 style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: '#2c3e50',
                  margin: '0 0 4px 0'
                }}>
                  Restore {bulkActionType === 'students' ? 'Students' : bulkActionType === 'quizzes' ? 'Quizzes' : 'Admins'}
                </h3>
                <p style={{
                  fontSize: 16,
                  color: '#6c757d',
                  margin: 0
                }}>
                  Are you sure you want to restore {bulkActionType === 'students' ? selectedStudents.length : selectedQuizzes.length} {bulkActionType === 'students' ? 'students' : 'quizzes'}?
                </p>
              </div>
            </div>


            <div style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setShowBulkRestoreModal(false);
                  setBulkActionType('');
                }}
                style={{
                  background: '#f8f9fa',
                  color: '#6c757d',
                  border: '1px solid #e9ecef',
                  borderRadius: 8,
                  padding: '12px 24px',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = '#e9ecef'}
                onMouseOut={(e) => e.target.style.background = '#f8f9fa'}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkRestore}
                style={{
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 24px',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = '#218838'}
                onMouseOut={(e) => e.target.style.background = '#28a745'}
              >
                Restore {bulkActionType === 'students' ? 'Students' : 'Quizzes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: 16,
            padding: 32,
            maxWidth: 480,
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #e9ecef'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 24
            }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: '#dc3545',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 24,
                fontWeight: 'bold',
                border: '2px solid #c82333',
                flexShrink: 0
              }}>
                ⚠️
              </div>
              <div>
                <h3 style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: '#2c3e50',
                  margin: '0 0 4px 0'
                }}>
                  Delete {bulkActionType === 'students' ? 'Students' : bulkActionType === 'quizzes' ? 'Quizzes' : 'Admins'}
                </h3>
                <p style={{
                  fontSize: 16,
                  color: '#6c757d',
                  margin: 0
                }}>
                  Are you sure you want to permanently delete {bulkActionType === 'students' ? selectedStudents.length : bulkActionType === 'quizzes' ? selectedQuizzes.length : selectedAdmins.length} {bulkActionType === 'students' ? 'students' : bulkActionType === 'quizzes' ? 'quizzes' : 'admins'}? This action cannot be undone.
                </p>
              </div>
            </div>


            <div style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setShowBulkDeleteModal(false);
                  setBulkActionType('');
                }}
                style={{
                  background: '#f8f9fa',
                  color: '#6c757d',
                  border: '1px solid #e9ecef',
                  borderRadius: 8,
                  padding: '12px 24px',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = '#e9ecef'}
                onMouseOut={(e) => e.target.style.background = '#f8f9fa'}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                style={{
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 24px',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = '#c82333'}
                onMouseOut={(e) => e.target.style.background = '#dc3545'}
              >
                Delete {bulkActionType === 'students' ? 'Students' : bulkActionType === 'quizzes' ? 'Quizzes' : 'Admins'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section Operation Progress Modal */}
      {sectionOperationProgress.isActive && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: 'white',
            borderRadius: 16,
            padding: 40,
            maxWidth: 500,
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #e9ecef',
            textAlign: 'center'
          }}>
            <div style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: sectionOperationProgress.operation === 'restore' 
                ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
                : 'linear-gradient(135deg, #dc3545 0%, #fd7e14 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 32,
              margin: '0 auto 24px auto',
              animation: 'pulse 2s infinite'
            }}>
              {sectionOperationProgress.operation === 'restore' ? (
                <i className="ri-refresh-line"></i>
              ) : (
                <i className="ri-delete-bin-line"></i>
              )}
            </div>
            
            <h3 style={{
              fontSize: 24,
              fontWeight: 700,
              color: '#2c3e50',
              margin: '0 0 8px 0'
            }}>
              {sectionOperationProgress.operation === 'restore' ? 'Restoring Section' : 'Deleting Section'}
            </h3>
            
            <p style={{
              fontSize: 16,
              color: '#6c757d',
              margin: '0 0 24px 0'
            }}>
              {sectionOperationProgress.sectionName}
            </p>
            
            {/* Progress Bar */}
            <div style={{
              background: '#e9ecef',
              borderRadius: 10,
              height: 8,
              marginBottom: 16,
              overflow: 'hidden'
            }}>
              <div style={{
                background: sectionOperationProgress.operation === 'restore' 
                  ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
                  : 'linear-gradient(135deg, #dc3545 0%, #fd7e14 100%)',
                height: '100%',
                width: `${(sectionOperationProgress.current / sectionOperationProgress.total) * 100}%`,
                transition: 'width 0.3s ease',
                borderRadius: 10
              }}></div>
            </div>
            
            {/* Progress Text */}
            <div style={{
              fontSize: 14,
              color: '#6c757d',
              marginBottom: 8
            }}>
              {sectionOperationProgress.current} of {sectionOperationProgress.total} students
            </div>
            
            {sectionOperationProgress.currentStudent && (
              <div style={{
                fontSize: 16,
                fontWeight: 600,
                color: '#2c3e50',
                marginBottom: 8
              }}>
                {sectionOperationProgress.operation === 'restore' ? 'Restoring' : 'Deleting'}: {sectionOperationProgress.currentStudent}
              </div>
            )}
            
            <div style={{
              fontSize: 12,
              color: '#999',
              fontStyle: 'italic'
            }}>
              Please wait while we process the students...
            </div>
          </div>
        </div>
      )}

      {/* Entity (Admins/Quizzes) Operation Progress Modal */}
      {entityOperationProgress.isActive && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div style={{
            background: 'white',
            borderRadius: 16,
            padding: 40,
            maxWidth: 480,
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #e9ecef',
            textAlign: 'center'
          }}>
            <div style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: entityOperationProgress.operation === 'restore' 
                ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
                : 'linear-gradient(135deg, #dc3545 0%, #fd7e14 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 28,
              margin: '0 auto 20px auto',
              animation: 'pulse 2s infinite'
            }}>
              {entityOperationProgress.entity === 'quiz' ? '📝' : <i className="ri-user-line"></i>}
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 700, color: '#2c3e50', margin: '0 0 6px 0' }}>
              {entityOperationProgress.operation === 'restore' ? 'Restoring' : 'Deleting'} {entityOperationProgress.entity === 'quiz' ? 'Quizzes' : 'Admins'}
            </h3>
            <p style={{ fontSize: 15, color: '#6c757d', margin: '0 0 16px 0' }}>
              {entityOperationProgress.currentName}
            </p>

            <div style={{ background: '#e9ecef', borderRadius: 10, height: 8, marginBottom: 12, overflow: 'hidden' }}>
              <div style={{
                background: entityOperationProgress.operation === 'restore' 
                  ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
                  : 'linear-gradient(135deg, #dc3545 0%, #fd7e14 100%)',
                height: '100%',
                width: `${(Math.min(entityOperationProgress.current, entityOperationProgress.total) / Math.max(entityOperationProgress.total || 1, 1)) * 100}%`,
                transition: 'width 0.25s ease',
                borderRadius: 10
              }}></div>
            </div>
            <div style={{ fontSize: 13, color: '#6c757d' }}>
              {Math.min(entityOperationProgress.current, entityOperationProgress.total)} of {Math.max(entityOperationProgress.total, 1)} {entityOperationProgress.entity === 'quiz' ? 'quizzes' : 'admins'}
            </div>
          </div>
        </div>
      )}

      {/* Section Restore Confirmation Modal */}
      {showSectionRestoreModal && sectionToRestore && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: 16,
            padding: 32,
            maxWidth: 480,
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #e9ecef'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 20
            }}>
              <div style={{
                background: '#28a745',
                borderRadius: 50,
                width: 48,
                height: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16
              }}>
                <i className="ri-refresh-line" style={{ color: 'white', fontSize: 20 }}></i>
              </div>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#2c3e50', margin: '0 0 4px 0' }}>
                  Restore Section
                </h3>
                <p style={{ fontSize: 14, color: '#6c757d', margin: 0 }}>
                  This will restore the section and all its students
                </p>
              </div>
            </div>
            

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowSectionRestoreModal(false);
                  setSectionToRestore(null);
                }}
                style={{
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 24px',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = '#5a6268'}
                onMouseOut={(e) => e.target.style.background = '#6c757d'}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowSectionRestoreModal(false);
                  restoreSection(sectionToRestore);
                  setSectionToRestore(null);
                }}
                style={{
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 24px',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = '#218838'}
                onMouseOut={(e) => e.target.style.background = '#28a745'}
              >
                Restore Section
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section Delete Confirmation Modal */}
      {showSectionDeleteModal && sectionToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: 16,
            padding: 32,
            maxWidth: 480,
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #e9ecef'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 20
            }}>
              <div style={{
                background: '#dc3545',
                borderRadius: 50,
                width: 48,
                height: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16
              }}>
                <i className="ri-delete-bin-7-line" style={{ color: 'white', fontSize: 20 }}></i>
              </div>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#2c3e50', margin: '0 0 4px 0' }}>
                  Delete Section
                </h3>
                <p style={{ fontSize: 14, color: '#6c757d', margin: 0 }}>
                  This action cannot be undone. All data will be permanently lost.
                </p>
              </div>
            </div>
            

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowSectionDeleteModal(false);
                  setSectionToDelete(null);
                }}
                style={{
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 24px',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = '#5a6268'}
                onMouseOut={(e) => e.target.style.background = '#6c757d'}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowSectionDeleteModal(false);
                  permanentlyDeleteSection(sectionToDelete.id);
                  setSectionToDelete(null);
                }}
                style={{
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 24px',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = '#c82333'}
                onMouseOut={(e) => e.target.style.background = '#dc3545'}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
