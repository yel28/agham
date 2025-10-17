  'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTeacher } from '../../lib/Teacher-SPCC';
import './quizzes.css';
import { db, collection, doc, setDoc, onSnapshot, getDocs, getDoc, addDoc, deleteDoc, updateDoc, arrayUnion, serverTimestamp, quizzesCollection, studentsCollection, sectionsCollection, assignmentsCollection, setStudentQuizUnlock } from '../../lib/firebase';
import { notifyQuizCreated, notifyQuizDeleted, notifyQuizLocked, notifyQuizUnlocked } from '../../lib/notificationUtils';
import { checkUserPermissions } from '../../lib/adminUtils';
import QuizAssignmentLoading from '../../components/QuizAssignmentLoading';

const quizColors = ['#b3e6c7', '#e6d1b3', '#f9efc3', '#e6b3b3'];
const quizzes = [
  { title: 'Quiz 1: Mixtures', color: quizColors[0] },
  { title: 'Quiz 2: Circulatory System', color: quizColors[1] },
  { title: 'Quiz 3: Gravity and Friction', color: quizColors[2] },
  { title: 'Quiz 4: Earthquakes and Volcanic Eruption', color: quizColors[3] },
];

const initialQuestions = [
  {
    text: 'What Color is the molecules?',
    choices: ['Red', 'Blue', 'Green', 'White'],
    correct: 0,
  },
  {
    text: 'What Color is the molecules?',
    choices: ['Red', 'Blue', 'Green', 'White'],
    correct: 0,
  },
];

const blankQuestion = {
  text: '',
  choices: ['', '', '', ''],
  correct: null,
};

// Function to create a fresh blank question
const createBlankQuestion = () => ({
  text: '',
  choices: ['', '', '', ''],
  correct: null,
});

export default function QuizzesPage() {
  const { teacherEmail } = useTeacher();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [quizDocId, setQuizDocId] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [selectedQuizType, setSelectedQuizType] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [unsubscribeFunction, setUnsubscribeFunction] = useState(null);
  
  // Create quiz modal state
  const [showCreateQuizModal, setShowCreateQuizModal] = useState(false);
  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [newQuizCategory, setNewQuizCategory] = useState('');
  const [newQuizQuestions, setNewQuizQuestions] = useState([]);
  const [allQuizzes, setAllQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quizCreating, setQuizCreating] = useState(false);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [showErrorNotification, setShowErrorNotification] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  // Per-quiz permission lock state (by quiz id or title slug)
  const [lockedQuizzes, setLockedQuizzes] = useState({});
  
  // Lock confirmation modal state
  const [showLockConfirmModal, setShowLockConfirmModal] = useState(false);
  const [quizToLock, setQuizToLock] = useState(null);
  
  // Quiz categories for creating new quizzes
  const quizCategories = [
    { value: 'mixtures', label: 'Mixtures', color: '#b3e6c7' },
    { value: 'circulatory_system', label: 'Circulatory System', color: '#e6d1b3' },
    { value: 'gravity_force', label: 'Gravity and Friction', color: '#f9efc3' },
    { value: 'volcanic_eruption', label: 'Earthquakes and Volcanic Eruption', color: '#e6b3b3' }
  ];

  // Reset form when create quiz modal opens
  useEffect(() => {
    if (showCreateQuizModal) {
      setNewQuizTitle('');
      setNewQuizCategory('');
      setNewQuizQuestions([]);
    }
  }, [showCreateQuizModal]);

  // Fetch all custom quizzes from Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(quizzesCollection(), (snapshot) => {
      const quizData = [];
      console.log('📡 Fetching quizzes from Firestore...');
      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log('📄 Quiz data from Firestore:', {
          id: doc.id,
          title: data.title,
          category: data.category,
          isCustom: data.isCustom
        });
        
        if (data.isCustom) {
          const quizColor = getCategoryColor(data.category);
          console.log('🎨 Category color for', data.category, ':', quizColor);
          
          quizData.push({
            id: doc.id,
            title: data.title,
            color: quizColor,
            category: data.category,
            isCustom: true,
            createdBy: data.createdBy,
            createdAt: data.createdAt
          });
        }
      });
      console.log('📊 Final quiz data:', quizData);
      setAllQuizzes(quizData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);
  
  // Permissions: collection for quiz locks (original nested structure)
  const quizPermissionsCollection = () => collection(db, 'assessments', 'quizzes', 'permissions');
  const slugify = (text = '') =>
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

  // Listen for lock/unlock changes
  useEffect(() => {
    
    // Force an initial read first
    const initialRead = async () => {
      try {
        const snapshot = await getDocs(quizPermissionsCollection());
        
        const map = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          map[docSnap.id] = data?.locked === true;
        });
        setLockedQuizzes(map);
        console.log('🔒 Initial lock state map:', map);
      } catch (error) {
        console.error('❌ Initial read error:', error);
      }
    };
    
    initialRead();
    
    const unsub = onSnapshot(quizPermissionsCollection(), (snapshot) => {
      console.log('📡 Firestore listener received update:', {
        size: snapshot.size,
        docs: snapshot.docs.map(doc => ({
          id: doc.id,
          data: doc.data()
        }))
      });
      
      const map = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        map[docSnap.id] = data?.locked === true;
        console.log('📄 Document processed:', {
          id: docSnap.id,
          locked: data?.locked,
          title: data?.title
        });
      });
      setLockedQuizzes(map);
      console.log('🔒 Final lock state map:', map);
    }, (error) => {
      console.error('❌ Firestore listener error:', error);
    });
    return () => unsub();
  }, []);

  const getQuizKey = (quiz) => {
    const key = quiz?.id || slugify(quiz?.title);
    return key;
  };
  const isQuizLocked = (quiz) => {
    const key = getQuizKey(quiz);
    return !!lockedQuizzes[key];
  };
  const toggleQuizLock = (quiz) => {
    // Show confirmation dialog
    setQuizToLock(quiz);
    setShowLockConfirmModal(true);
  };

  const confirmLockToggle = async () => {
    if (!quizToLock) return;
    
    // Allow lock/unlock for any logged-in user
    if (!teacherEmail) {
      console.log('User not logged in, cannot toggle lock');
      setShowLockConfirmModal(false);
      return;
    }
    
    console.log('Toggling lock for quiz:', quizToLock.title);
    const key = getQuizKey(quizToLock);
    const nextLocked = !isQuizLocked(quizToLock);
    
    try {
      console.log('🔧 Writing to Firestore:', {
        collection: 'assessments/quizzes/permissions',
        documentId: key,
        locked: nextLocked,
        title: quizToLock?.title
      });
      
      await setDoc(doc(quizPermissionsCollection(), key), {
        locked: nextLocked,
        title: quizToLock?.title || '',
        updatedBy: teacherEmail || 'unknown',
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      console.log('✅ Successfully wrote to Firestore document:', key);
      
      // Send notification based on action
      if (nextLocked) {
        await notifyQuizLocked(teacherEmail, quizToLock.title);
      } else {
        await notifyQuizUnlocked(teacherEmail, quizToLock.title);
      }
      
      console.log(`Quiz ${quizToLock.title} ${nextLocked ? 'locked' : 'unlocked'} successfully`);
    } catch (error) {
      console.error('Error toggling quiz lock:', error);
      alert('Error updating quiz lock status. Please try again.');
    } finally {
      setShowLockConfirmModal(false);
      setQuizToLock(null);
    }
  };

  const cancelLockToggle = () => {
    setShowLockConfirmModal(false);
    setQuizToLock(null);
  };

  
  // Assignment modal state
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [quizToAssign, setQuizToAssign] = useState(null);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectedSections, setSelectedSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [sections, setSections] = useState([]);
  const [isAssigningQuiz, setIsAssigningQuiz] = useState(false);
  const [isAssignmentCompleted, setIsAssignmentCompleted] = useState(false);

  // Get role and permissions from localStorage
  const [teacherRole, setTeacherRole] = useState('');
  const [teacherPermissions, setTeacherPermissions] = useState({});

  // Add permission checking - these will be computed values
  const canManageQuizzes = useMemo(() => {
    // Allow only super admin or explicit permission
    if (teacherRole === 'super_admin') return true;
    return checkUserPermissions(teacherRole, teacherPermissions, 'create_quiz');
  }, [teacherRole, teacherPermissions]);
  
  const canAssignQuizzes = useMemo(() => {
    if (teacherRole === 'super_admin') return true;
    return checkUserPermissions(teacherRole, teacherPermissions, 'assign_quiz');
  }, [teacherRole, teacherPermissions]);
  
  const canLockUnlockQuizzes = useMemo(() => {
    if (teacherRole === 'super_admin') return true;
    return checkUserPermissions(teacherRole, teacherPermissions, 'lock_unlock_quiz');
  }, [teacherRole, teacherPermissions]);
  
  const canViewQuizzes = useMemo(() => checkUserPermissions(teacherRole, teacherPermissions, 'view_quizzes'), [teacherRole, teacherPermissions]);

  // Debug logging for permissions
  useEffect(() => {
    
    // If permissions are not loaded after 2 seconds, set default permissions
    const timeout = setTimeout(() => {
      if (!teacherRole && !teacherPermissions) {
        console.log('Setting default permissions due to timeout');
        setTeacherRole('super_admin');
        setTeacherPermissions({
          canManageStudents: true,
          canManageQuizzes: true,
          canViewAssessments: true,
          canAccessArchive: true,
          canManageOwnProfile: true,
          canViewReports: true,
          canManageOtherUsers: true,
          canAccessSystemSettings: true,
          canManageRoles: true
        });
      }
    }, 2000);
    
    return () => clearTimeout(timeout);
  }, [teacherRole, teacherPermissions, canManageQuizzes, canViewQuizzes]);



  // Load role and permissions from localStorage
  useEffect(() => {
    const role = localStorage.getItem('teacherRole') || '';
    const permissions = JSON.parse(localStorage.getItem('teacherPermissions') || '{}');
    setTeacherRole(role);
    setTeacherPermissions(permissions);
  }, []);


  // Get color for custom quiz categories
  const getCategoryColor = (category) => {
    console.log('🎨 Getting color for category:', category);
    const foundCategory = quizCategories.find(cat => cat.value === category);
    console.log('🔍 Found category:', foundCategory);
    const color = foundCategory ? foundCategory.color : '#b3e6c7';
    console.log('🎨 Returning color:', color);
    return color;
  };

  const openQuizTypeModal = (quiz) => {
    // Go directly to quiz editor instead of showing type selection
    setSelectedQuiz(quiz);
    setSelectedQuizType({ title: quiz.title, color: quiz.color });
    // Create a document ID for default quizzes using the quiz title
    const docId = quiz.title.replace(/\s+/g, '_').toLowerCase();
    setQuizDocId(docId);
    
    // Try to load existing questions from Firestore for default quizzes
    const unsub = onSnapshot(doc(quizzesCollection(), docId), (docSnap) => {
      if (docSnap.exists()) {
        setQuestions(docSnap.data().questions || []);
      } else {
        setQuestions([]);
      }
    });
    
    // Store the unsubscribe function
    setUnsubscribeFunction(() => unsub);
    setModalOpen(true);
  };

  const openCreateQuizModal = () => {
    if (!canManageQuizzes) {
      alert('You do not have permission to create quizzes.');
      return;
    }
    // Reset all form data before opening modal
    setNewQuizTitle('');
    setNewQuizCategory('');
    setNewQuizQuestions([]);
    setShowCreateQuizModal(true);
  };

  const closeCreateQuizModal = () => {
    setShowCreateQuizModal(false);
    setNewQuizTitle('');
    setNewQuizCategory('');
    setNewQuizQuestions([]);
  };

  const addNewQuizQuestion = () => {
    setNewQuizQuestions([
      ...newQuizQuestions,
      createBlankQuestion(),
    ]);
  };

  const deleteNewQuizQuestion = (idx) => {
    setNewQuizQuestions(newQuizQuestions.filter((_, i) => i !== idx));
  };

  const saveNewQuizToFirestore = async () => {
    console.log('🔍 Form validation - checking values:', {
      title: newQuizTitle,
      category: newQuizCategory,
      questionsCount: newQuizQuestions.length
    });
    
    if (!newQuizTitle.trim() || !newQuizCategory || newQuizQuestions.length === 0) {
      console.log('❌ Validation failed:', {
        titleValid: !!newQuizTitle.trim(),
        categoryValid: !!newQuizCategory,
        questionsValid: newQuizQuestions.length > 0
      });
      setErrorMessage('Please fill in all fields and add at least one question');
      setShowErrorNotification(true);
      setTimeout(() => setShowErrorNotification(false), 4000);
      return;
    }

    // Validate that all questions have proper content and correct answers
    for (let i = 0; i < newQuizQuestions.length; i++) {
      const question = newQuizQuestions[i];
      
      // Check if question text is filled
      if (!question.text || question.text.trim().length === 0) {
        setErrorMessage(`Please enter question text for Question ${i + 1}`);
        setShowErrorNotification(true);
        setTimeout(() => setShowErrorNotification(false), 4000);
        return;
      }
      
      // Check if all choices are filled
      if (!question.choices || question.choices.some(choice => !choice || choice.trim().length === 0)) {
        setErrorMessage(`Please fill in all choices for Question ${i + 1}`);
        setShowErrorNotification(true);
        setTimeout(() => setShowErrorNotification(false), 4000);
        return;
      }
      
      // Check if a correct answer is marked
      if (question.correct === null || question.correct === undefined) {
        setErrorMessage(`Please mark the correct answer for Question ${i + 1}`);
        setShowErrorNotification(true);
        setTimeout(() => setShowErrorNotification(false), 4000);
        return;
      }
    }

    setQuizCreating(true);
    
    try {
      const docId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log('🔍 Creating quiz with data:', {
        docId,
        title: newQuizTitle,
        category: newQuizCategory,
        questions: newQuizQuestions.length,
        createdBy: teacherEmail
      });
      
      await setDoc(doc(quizzesCollection(), docId), {
        title: newQuizTitle,
        category: newQuizCategory,
        questions: newQuizQuestions,
        createdBy: teacherEmail,
        createdAt: new Date().toISOString(),
        isCustom: true
      });
      
      console.log('✅ Quiz saved to Firestore successfully');

      // Add notification
      await notifyQuizCreated(teacherEmail, newQuizTitle);
      
      // Show success notification
      setSuccessMessage('Quiz created successfully!');
      setShowSuccessNotification(true);
      setTimeout(() => {
        setShowSuccessNotification(false);
        setSuccessMessage('');
      }, 5000);
      
      // Close modal and reset form
      closeCreateQuizModal();
      
    } catch (error) {
      setErrorMessage('Error creating quiz. Please try again.');
      setShowErrorNotification(true);
      setTimeout(() => setShowErrorNotification(false), 4000);
    } finally {
      setQuizCreating(false);
    }
  };

  const openCustomQuizModal = (quiz) => {
    if (!canManageQuizzes) {
      alert('You do not have permission to edit quizzes.');
      return;
    }
    setSelectedQuiz(quiz);
    setSelectedQuizType({ title: quiz.title, color: quiz.color });
    setQuizDocId(quiz.id);
    
    // Fetch the quiz questions from Firestore
    const unsub = onSnapshot(doc(quizzesCollection(), quiz.id), (docSnap) => {
      if (docSnap.exists()) {
        setQuestions(docSnap.data().questions || []);
      } else {
        setQuestions([]);
      }
    });
    
    setModalOpen(true);
    return () => unsub();
  };

  const deleteCustomQuiz = async (quizId) => {
    if (!canManageQuizzes) {
      alert('You do not have permission to delete quizzes.');
      return;
    }
    setQuizToDelete(quizId);
    setShowDeleteConfirmModal(true);
  };

  const confirmDelete = async () => {
    if (!quizToDelete) return;
    try {
      // Get quiz title before deleting for notification
      const quizToDeleteData = allQuizzes.find(q => q.id === quizToDelete);
      const quizTitle = quizToDeleteData ? quizToDeleteData.title : 'Unknown Quiz';
      
      // Step 1: Archive the quiz data for backup
      await setDoc(doc(db, 'deleted_quizzes', `deleted_${quizToDelete}`), {
        originalId: quizToDelete,
        originalData: quizToDeleteData,
        deletedAt: new Date().toISOString(),
        deletedBy: teacherEmail
      });
      
      // Step 2: Remove from assignments (if any exist)
      try {
        // Use the correct assignments collection path
        const assignmentsSnapshot = await getDocs(assignmentsCollection());
        const assignmentPromises = [];
        
        console.log(`🔍 Searching for assignments with quizId: ${quizToDelete}`);
        console.log(`📊 Found ${assignmentsSnapshot.docs.length} total assignments`);
        
        assignmentsSnapshot.forEach((assignmentDoc) => {
          const assignmentData = assignmentDoc.data();
          console.log(`🔍 Checking assignment ${assignmentDoc.id}: quizId = ${assignmentData.quizId}`);
          
          if (assignmentData.quizId === quizToDelete) {
            console.log(`🗑️ MATCH FOUND! Deleting assignment: ${assignmentDoc.id}`);
            assignmentPromises.push(deleteDoc(assignmentDoc.ref));
          }
        });
        
        await Promise.all(assignmentPromises);
        console.log(`🗑️ Removed ${assignmentPromises.length} assignments for deleted quiz`);
        
        // Also clean up student assignedQuizzes arrays
        if (assignmentPromises.length > 0) {
          console.log('🧹 Cleaning up student assignedQuizzes arrays...');
          const studentsSnapshot = await getDocs(studentsCollection());
          const studentUpdatePromises = [];
          
          studentsSnapshot.forEach((studentDoc) => {
            const studentData = studentDoc.data();
            if (studentData.assignedQuizzes && Array.isArray(studentData.assignedQuizzes)) {
              const updatedQuizzes = studentData.assignedQuizzes.filter(
                quiz => quiz.quizId !== quizToDelete
              );
              
              if (updatedQuizzes.length !== studentData.assignedQuizzes.length) {
                console.log(`🧹 Removing quiz from student ${studentDoc.id}`);
                studentUpdatePromises.push(
                  updateDoc(studentDoc.ref, {
                    assignedQuizzes: updatedQuizzes,
                    updatedAt: serverTimestamp()
                  })
                );
              }
            }
          });
          
          await Promise.all(studentUpdatePromises);
          console.log(`🧹 Updated ${studentUpdatePromises.length} student records`);
        }
      } catch (assignmentError) {
        console.warn('Warning: Could not clean up assignments:', assignmentError);
      }
      
      // Step 3: Remove from permissions/locks
      try {
        const permissionsSnapshot = await getDocs(collection(db, 'assessments', 'quizzes', 'permissions'));
        const permissionPromises = [];
        
        permissionsSnapshot.forEach((permissionDoc) => {
          const permissionData = permissionDoc.data();
          if (permissionData.quizId === quizToDelete || permissionData.quizTitle === quizTitle) {
            permissionPromises.push(deleteDoc(permissionDoc.ref));
          }
        });
        
        await Promise.all(permissionPromises);
        console.log(`🔓 Removed ${permissionPromises.length} permission entries for deleted quiz`);
      } catch (permissionError) {
        console.warn('Warning: Could not clean up permissions:', permissionError);
      }
      
      // Step 4: Permanently delete from quizzes collection (Unity will automatically sync)
      await deleteDoc(doc(quizzesCollection(), quizToDelete));
      console.log(`✅ Quiz "${quizTitle}" deleted from Firebase - Unity will sync automatically`);
      
      // Step 5: Add notification
      await notifyQuizDeleted(teacherEmail, quizTitle);
      
      // Step 6: Show success notification
      setSuccessMessage('Quiz deleted successfully!');
      setShowSuccessNotification(true);
      setTimeout(() => {
        setShowSuccessNotification(false);
        setSuccessMessage('');
      }, 5000);
      
      // Step 7: Remove from local state
      setAllQuizzes(allQuizzes.filter(q => q.id !== quizToDelete));
      setShowDeleteConfirmModal(false);
      setQuizToDelete(null);
      
    } catch (error) {
      console.error('Error deleting quiz:', error);
      alert('Error deleting quiz. Please try again.');
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirmModal(false);
    setQuizToDelete(null);
  };


  const closeModal = () => {
    // Clean up the Firestore listener
    if (unsubscribeFunction) {
      unsubscribeFunction();
      setUnsubscribeFunction(null);
    }
    
    setModalOpen(false);
    setSelectedQuiz(null);
    setSelectedQuizType(null);
    setQuestions([]);
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      createBlankQuestion(),
    ]);
  };

  const deleteQuestion = (idx) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const saveQuizToFirestore = async () => {
    try {
      if (!quizDocId) {
        setErrorMessage('No quiz document ID found');
        setTimeout(() => setErrorMessage(''), 3000);
        return;
      }
      
      const quizData = {
      mainQuiz: selectedQuiz?.title || '',
      quizType: selectedQuizType?.title || '',
      title: selectedQuizType?.title || selectedQuiz?.title || 'Untitled Quiz',
      questions,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await setDoc(doc(quizzesCollection(), quizDocId), quizData, { merge: true });
      setSaveMessage('Quiz saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
      console.log('Quiz saved to Firestore:', quizData);
    } catch (error) {
      console.error('Error saving quiz:', error);
      setErrorMessage('Failed to save quiz. Please try again.');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };


  // Assignment functions
  const openAssignmentModal = (quiz) => {
    setQuizToAssign(quiz);
    setShowAssignmentModal(true);
    
    // Load students and sections from Firebase
    loadStudents();
    loadSections();
  };


  const loadStudents = async () => {
    try {
      const studentsRef = studentsCollection();
      const snapshot = await getDocs(studentsRef);
      const studentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('Loaded students:', studentsData);
      setStudents(studentsData);
      
      // If no students found, show a message
      if (studentsData.length === 0) {
        console.log('No students found in database');
        // You might want to show a message to the user here
      }
    } catch (error) {
      console.error('Error loading students:', error);
      // Set empty array as fallback
      setStudents([]);
    }
  };

  const loadSections = async () => {
    try {
      const sectionsRef = sectionsCollection();
      const snapshot = await getDocs(sectionsRef);
      const sectionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('Loaded sections:', sectionsData);
      setSections(sectionsData);
    } catch (error) {
      console.error('Error loading sections:', error);
      setSections([]);
    }
  };

  const toggleSectionSelection = (sectionId) => {
    console.log('Toggling section selection:', sectionId);
    setSelectedSections(prev => {
      const newSelection = prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId];
      console.log('New section selection:', newSelection);
      return newSelection;
    });
  };

  const toggleAllSections = () => {
    if (selectedSections.length === sections.length) {
      // If all are selected, deselect all
      setSelectedSections([]);
    } else {
      // If not all are selected, select all
      setSelectedSections(sections.map(s => s.id));
    }
  };

  // Get students from selected sections
  const getStudentsFromSelectedSections = () => {
    if (selectedSections.length === 0) return [];
    return students.filter(student => selectedSections.includes(student.sectionId));
  };

  // Basic validation for editor
  const isQuizValid = () => {
    if (!questions || questions.length === 0) return false;
    for (const q of questions) {
      if (!q.text || q.text.trim().length === 0) return false;
      if (!q.choices || q.choices.some((c) => !c || c.trim().length === 0)) return false;
      if (q.correct === null || q.correct === undefined) return false;
    }
    return true;
  };

  const handleSaveQuiz = async () => {
    console.log('Attempting to save quiz...');
    console.log('Quiz Doc ID:', quizDocId);
    console.log('Questions:', questions);
    console.log('Selected Quiz:', selectedQuiz);
    console.log('Selected Quiz Type:', selectedQuizType);
    
    if (!isQuizValid()) {
      setErrorMessage('Please add question text, fill choices, and mark a correct answer for each question.');
      setTimeout(() => setErrorMessage(''), 4000);
      return;
    }
    
    console.log('Quiz validation passed, saving to Firestore...');
    await saveQuizToFirestore();
  };

  const assignQuiz = async () => {
    if (selectedSections.length === 0) {
      alert('Please select at least one section');
      return;
    }

    // Show loading screen
    setIsAssigningQuiz(true);

    try {
      // Get all students from selected sections
      const studentsFromSections = getStudentsFromSelectedSections();
      
      if (studentsFromSections.length === 0) {
        alert('No students found in the selected sections');
        setIsAssigningQuiz(false);
        return;
      }

      const assignmentData = {
        quizId: quizToAssign.id,
        quizTitle: quizToAssign.title,
        quizCategory: quizToAssign.category, // Add science topic to assignment
        teacherEmail: teacherEmail,
        assignedSections: selectedSections,
        assignedStudents: studentsFromSections.map(s => s.id),
        status: 'assigned',
        createdAt: new Date(),
        scores: {}, // Will store student scores
        maxAttempts: 1, // Default to 1 attempt
        attemptLabel: `Attempt 1` // Label for the attempt
      };

      // Save assignment to Firebase
      console.log('📝 Creating assignment with data:', assignmentData);
      await addDoc(assignmentsCollection(), assignmentData);
      console.log('✅ Assignment saved to Firebase successfully');
      
      // Update each student's assignedQuizzes array to track their progress
      await Promise.all(studentsFromSections.map(async (student) => {
        try {
          const studentRef = doc(studentsCollection(), student.id);
          await updateDoc(studentRef, {
            assignedQuizzes: arrayUnion({
              quizId: quizToAssign.id,
              quizTitle: quizToAssign.title,
              quizCategory: quizToAssign.category, // Add science topic to student record
              assignedAt: new Date(),
              status: 'assigned'
            }),
            updatedAt: serverTimestamp()
          });
        } catch (error) {
          console.error(`Error updating assigned quizzes for student ${student.id}:`, error);
        }
      }));
      
      // Show completion state
      setIsAssignmentCompleted(true);
      
    } catch (error) {
      // Hide loading screen on error
      setIsAssigningQuiz(false);
      alert('Error assigning quiz. Please try again.');
    }
  };

  const closeAssignmentModal = () => {
    setShowAssignmentModal(false);
    setQuizToAssign(null);
    setSelectedSections([]);
    setIsAssigningQuiz(false);
    setIsAssignmentCompleted(false);
  };

  const handleAssignmentComplete = () => {
    // Close modal and reset state
    setShowAssignmentModal(false);
    setQuizToAssign(null);
    setSelectedSections([]);
    setIsAssigningQuiz(false);
    setIsAssignmentCompleted(false);
  };

  // Map quiz title/category to a Firestore boolean field for Unity
  const getUnlockFieldForQuiz = (quiz) => {
    const title = (quiz?.title || '').toLowerCase();
    if (title.includes('mixtures')) return 'mixturesQuizUnlocked';
    if (title.includes('circulatory')) return 'circSystemQuizUnlocked';
    if (title.includes('gravity')) return 'gravForceQuizUnlocked';
    if (title.includes('volcanic')) return 'volcanicQuizUnlocked';
    return `${slugify(title)}_unlocked`;
  };

  const unlockForSelectedStudents = async () => {
    try {
      if (!quizToAssign) {
        alert('No quiz selected.');
        return;
      }
      if (selectedStudents.length === 0) {
        alert('Please select at least one student');
        return;
      }
      const fieldName = getUnlockFieldForQuiz(quizToAssign);
      await Promise.all(selectedStudents.map((sid) => setStudentQuizUnlock(sid, fieldName, true)));
      alert(`Unlocked "${quizToAssign.title}" for ${selectedStudents.length} student(s).`);
    } catch (e) {
      alert('Error unlocking quiz for students: ' + (e?.message || e));
    }
  };

  return (
    <>
      {/* Professional Loading Screen */}
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
            Loading Quizzes
          </h3>
          
          <p style={{
            fontSize: 14,
            color: '#6c757d',
            margin: 0,
            textAlign: 'center',
            lineHeight: 1.5,
            maxWidth: 200
          }}>
            Fetching quiz data and permissions...
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
        <>
          {/* Professional Header Section */}
          <div style={{ 
            marginBottom: 32, 
            borderBottom: '2px solid #f0f0f0',
            paddingBottom: 20,
            paddingTop: 20,
            paddingLeft: 24,
            paddingRight: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
            borderRadius: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}>
            <div>
              <h1 style={{ 
                fontSize: 32, 
                fontWeight: 700, 
                color: '#2c3e50',
                margin: '0 0 4px 0',
                letterSpacing: '-0.5px'
              }}>
                Quizzes
              </h1>
              <p style={{ 
                fontSize: 16, 
                color: '#6c757d', 
                margin: 0,
                fontWeight: 400,
                lineHeight: 1.4
              }}>
                Manage, create, and assign science quizzes to your students
              </p>
            </div>
            
            {canManageQuizzes && (
              <button
                onClick={openCreateQuizModal}
                style={{
                  background: 'linear-gradient(135deg, #4fa37e 0%, #3d8b6f 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 12,
                  padding: '14px 28px',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(79, 163, 126, 0.3)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 'fit-content'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 20px rgba(79, 163, 126, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 15px rgba(79, 163, 126, 0.3)';
                }}
              >
                <span style={{ fontSize: 20 }}>+</span>
                Create New Quiz
              </button>
            )}
          </div>
          
          <div style={{ margin: '0', padding: '0' }}>
            {/* Standard Quizzes */}
            <div style={{ width: '100%' }}>
              <div className="quiz-list-stacked" style={{ margin: '0', padding: '0' }}>
                {/* Standard Quizzes */}
                {quizzes.map((quiz, i) => (
                  <div
                    key={`default-${i}`}
                    className="quiz-box-stacked"
                    style={{ 
                      background: `linear-gradient(135deg, ${quiz.color} 0%, ${quiz.color}dd 100%)`,
                      border: '1px solid rgba(255,255,255,0.3)',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                      position: 'relative',
                      overflow: 'hidden',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
                      e.target.style.borderColor = 'rgba(255,255,255,0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)';
                      e.target.style.borderColor = 'rgba(255,255,255,0.3)';
                    }}
                  >
                    {/* Enhanced shine effect */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '60%',
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 100%)',
                      pointerEvents: 'none'
                    }}></div>
                    
                    {/* Subtle pattern overlay */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.1) 0%, transparent 50%)',
                      pointerEvents: 'none'
                    }}></div>
                    
                    <span style={{ 
                      fontSize: 17, 
                      fontWeight: 700, 
                      color: '#2c3e50',
                      textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      position: 'relative',
                      zIndex: 1,
                      letterSpacing: '0.3px'
                    }}>{quiz.title}</span>
                    {(canManageQuizzes || canLockUnlockQuizzes || canAssignQuizzes) && (
                      <div className="quiz-buttons-container">
                        {/* Edit - Only for users who can manage quizzes */}
                        {canManageQuizzes && (
                          <div
                            className="quiz-button quiz-edit-button"
                            onClick={() => openQuizTypeModal(quiz)}
                            title="Edit Quiz"
                          >
                            <img
                              src="/pencil.png"
                              alt="Edit Quiz"
                              style={{ width: '20px', height: '20px', objectFit: 'contain' }} 
                            />
                          </div>
                        )}
                        
                        {/* Lock/Unlock */}
                        {canLockUnlockQuizzes && (
                          <div
                            className={`quiz-button quiz-lock-button ${isQuizLocked(quiz) ? 'locked' : ''}`}
                            onClick={() => toggleQuizLock(quiz)}
                            title={isQuizLocked(quiz) ? 'Unlock Topic' : 'Lock Topic'}
                          >
                            <i className={isQuizLocked(quiz) ? 'ri-lock-line' : 'ri-lock-unlock-line'}></i>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                ))}
                
                {/* Custom Quizzes */}
                {allQuizzes.map((quiz, index) => (
                  <div
                    key={quiz.id}
                    className="quiz-box-stacked"
                    style={{ 
                      background: `linear-gradient(135deg, ${quiz.color} 0%, ${quiz.color}dd 100%)`,
                      border: '1px solid rgba(255,255,255,0.3)',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                      position: 'relative',
                      overflow: 'hidden',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
                      e.target.style.borderColor = 'rgba(255,255,255,0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)';
                      e.target.style.borderColor = 'rgba(255,255,255,0.3)';
                    }}
                  >
                    {/* Enhanced shine effect */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '60%',
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 100%)',
                      pointerEvents: 'none'
                    }}></div>
                    
                    {/* Subtle pattern overlay */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.1) 0%, transparent 50%)',
                      pointerEvents: 'none'
                    }}></div>
                    
                    <span style={{ 
                      fontSize: 17, 
                      fontWeight: 700, 
                      color: '#2c3e50',
                      textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      position: 'relative',
                      zIndex: 1,
                      letterSpacing: '0.3px'
                    }}>{quiz.title}</span>
                    {(canManageQuizzes || canLockUnlockQuizzes || canAssignQuizzes) && (
                      <div className="quiz-buttons-container">
                        {/* Delete - Only for users who can manage quizzes */}
                        {canManageQuizzes && (
                          <div
                            className="quiz-button quiz-delete-button"
                            onClick={() => deleteCustomQuiz(quiz.id)}
                            title="Delete Quiz"
                          >
                            <i className="ri-delete-bin-6-line"></i>
                          </div>
                        )}
                        
                        {/* Edit - Only for users who can manage quizzes */}
                        {canManageQuizzes && (
                          <div
                            className="quiz-button quiz-edit-button"
                            onClick={() => openCustomQuizModal(quiz)}
                            title="Edit Quiz"
                          >
                            <img
                              src="/pencil.png"
                              alt="Edit Quiz"
                              style={{ width: '20px', height: '20px', objectFit: 'contain' }} 
                            />
                          </div>
                        )}
                        
                        {/* Assign */}
                        {canAssignQuizzes && (
                          <div
                            className="quiz-button quiz-assign-button"
                            onClick={() => openAssignmentModal(quiz)}
                            title="Assign Quiz"
                          >
                            <i className="ri-send-plane-line"></i>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
      

      {/* Quiz Editing Modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.15)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ 
            background: '#fff', 
            borderRadius: 18, 
            padding: 32, 
            minWidth: 1000, 
            maxWidth: '90vw', 
            maxHeight: '90vh',
            position: 'relative', 
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <button
              style={{ 
                position: 'absolute', 
                top: 18, 
                right: 18, 
                background: 'none', 
                border: 'none', 
                fontSize: 28, 
                cursor: 'pointer',
                zIndex: 1001
              }}
              onClick={closeModal}
              aria-label="Close"
            >
              &times;
            </button>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              paddingBottom: 14, marginBottom: 16, borderBottom: '1px solid #e9ecef'
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'linear-gradient(135deg, #4fa37e 0%, #3d8b6f 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 3px 10px rgba(79,163,126,0.25)'
              }}>
                <i className="ri-edit-2-line" style={{ color: '#fff', fontSize: 20 }}></i>
              </div>
              <div style={{ fontWeight: 700, fontSize: 22, color: '#2c3e50' }}>
                {selectedQuizType?.title || selectedQuiz?.title}
              </div>
            </div>
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              paddingRight: '16px',
              marginBottom: '16px'
            }}>
              {questions.map((q, idx) => (
                <div key={idx} style={{ marginBottom: 24, background: '#ffffff', borderRadius: 12, padding: 18, border: '1px solid #e9ecef', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: '#2c3e50' }}>Question {idx + 1}</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      <button 
                        style={{ background: 'rgba(220,53,69,0.08)', border: '1px solid rgba(220,53,69,0.25)', color: '#c82333', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontWeight: 600 }} 
                        title="Delete" 
                        onClick={() => deleteQuestion(idx)}
                      >
                        <i className="ri-delete-bin-6-line" style={{ fontSize: 16 }}></i>
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Enter question text..."
                    value={q.text}
                    onChange={e => {
                      const updated = [...questions];
                      updated[idx].text = e.target.value;
                      setQuestions(updated);
                    }}
                    style={{ width: '100%', background: '#fff8e1', border: '2px solid #ffe3a3', borderRadius: 10, padding: 12, fontWeight: 500, marginBottom: 6, fontSize: 16 }}
                  />
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {q.choices.map((choice, cidx) => (
                      <div key={cidx} style={{ textAlign: 'center' }}>
                        <input
                          type="text"
                          placeholder={`Choice ${cidx + 1}`}
                          value={choice}
                          onChange={e => {
                            const updated = [...questions];
                            updated[idx].choices[cidx] = e.target.value;
                            setQuestions(updated);
                          }}
                          style={{
                            width: '100%',
                            background: q.correct === cidx ? '#4fa37e' : '#ffffff',
                            color: q.correct === cidx ? '#fff' : '#2c3e50',
                            border: q.correct === cidx ? '2px solid #4fa37e' : '2px solid #e9ecef',
                            borderRadius: 10,
                            padding: '12px 10px',
                            fontWeight: 600,
                            fontSize: 15,
                            marginBottom: 6,
                            textAlign: 'center',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...questions];
                            updated[idx].correct = cidx;
                            setQuestions(updated);
                          }}
                          style={{
                            marginTop: 2,
                            background: q.correct === cidx ? '#4fa37e' : '#fff',
                            color: q.correct === cidx ? '#fff' : '#3d8b6f',
                            border: `2px solid #4fa37e`,
                            borderRadius: 999,
                            padding: '6px 10px',
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: 'pointer',
                            width: '100%',
                          }}
                        >
                          {q.correct === cidx ? 'Correct' : 'Mark Correct'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ 
              borderTop: '1px solid #e9ecef', 
              paddingTop: '16px',
              flexShrink: 0
            }}>
              <button
                style={{ background: '#e9f6ef', color: '#3d8b6f', border: '2px solid #cfeadc', borderRadius: 10, padding: '12px 22px', fontWeight: 700, fontSize: 16, marginTop: 6, cursor: 'pointer', width: '100%' }}
                onClick={addQuestion}
              >
                + Add Question
              </button>
              <button
                style={{ background: 'linear-gradient(135deg, #4fa37e 0%, #3d8b6f 100%)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 22px', fontWeight: 700, fontSize: 16, marginTop: 8, cursor: 'pointer', width: '100%' }}
                onClick={handleSaveQuiz}
              >
                Save Quiz
              </button>
              {saveMessage && (
                <div style={{ color: '#4fa37e', fontWeight: 600, textAlign: 'center', marginTop: 8 }}>{saveMessage}</div>
              )}
              {errorMessage && (
                <div style={{ color: '#dc3545', fontWeight: 600, textAlign: 'center', marginTop: 8 }}>{errorMessage}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Quiz Modal */}
      {showCreateQuizModal && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
            background: 'rgba(0,0,0,0.15)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeCreateQuizModal();
            }
          }}
        >
          <div style={{ 
            background: '#fff', 
            borderRadius: 18, 
            padding: 32, 
            minWidth: 1000, 
            maxWidth: '90vw', 
            maxHeight: '90vh',
            position: 'relative', 
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <button
              style={{ 
                position: 'absolute', 
                top: 18, 
                right: 18, 
                background: 'none', 
                border: 'none', 
                fontSize: 28, 
                cursor: 'pointer',
                zIndex: 1001
              }}
              onClick={closeCreateQuizModal}
              aria-label="Close"
            >
              &times;
            </button>
            
            <div style={{ 
              fontWeight: 700, 
              fontSize: 24, 
              marginBottom: 24, 
              textAlign: 'center'
            }}>
              Create New Quiz
            </div>
            
            {/* Quiz Details Form */}
            <div style={{ 
              display: 'flex', 
              gap: 20, 
              marginBottom: 24,
              padding: '20px',
              background: '#f8f9fa',
              borderRadius: 12
            }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#333' }}>
                  Quiz Title *
                </label>
                <input
                  type="text"
                  placeholder="Enter quiz title..."
                  value={newQuizTitle}
                  onChange={(e) => setNewQuizTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e9ecef',
                    borderRadius: 8,
                    fontSize: 16,
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#4fa37e'}
                  onBlur={(e) => e.target.style.borderColor = '#e9ecef'}
                />
              </div>
              
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#333' }}>
                  Science Topic *
                </label>
                <select
                  value={newQuizCategory}
                  onChange={(e) => setNewQuizCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #e9ecef',
                    borderRadius: 8,
                    fontSize: 16,
                    background: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">Select a science topic</option>
                  {quizCategories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Questions Section */}
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              paddingRight: '16px',
              marginBottom: '16px'
            }}>
              {newQuizQuestions.map((q, idx) => (
                <div key={idx} style={{ marginBottom: 24, background: '#f8f8f8', borderRadius: 12, padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 18 }}>Question {idx + 1}</span>
                    <button 
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }} 
                      title="Delete" 
                      onClick={() => deleteNewQuizQuestion(idx)}
                    >
                      <i className="ri-delete-bin-6-line" style={{ fontSize: 20, color: '#e86786' }}></i>
                    </button>
                  </div>
                  
                  <input
                    type="text"
                    placeholder="Enter question text..."
                    value={q.text}
                    onChange={e => {
                      const updated = [...newQuizQuestions];
                      updated[idx].text = e.target.value;
                      setNewQuizQuestions(updated);
                    }}
                    style={{ width: '100%', background: '#ffe99e', border: 'none', borderRadius: 8, padding: 10, fontWeight: 500, marginBottom: 12, fontSize: 16 }}
                  />
                  <div style={{ display: 'flex', gap: 12 }}>
                    {q.choices.map((choice, cidx) => (
                      <div key={cidx} style={{ flex: 1, textAlign: 'center' }}>
                        <input
                          type="text"
                          placeholder={`Choice ${cidx + 1}`}
                          value={choice}
                          onChange={e => {
                            const updated = [...newQuizQuestions];
                            updated[idx].choices[cidx] = e.target.value;
                            setNewQuizQuestions(updated);
                          }}
                          style={{
                            width: '100%',
                            background: q.correct === cidx ? '#e86786' : '#f8d7da',
                            color: q.correct === cidx ? '#fff' : '#b71c1c',
                            border: 'none',
                            borderRadius: 10,
                            padding: '12px 8px',
                            fontWeight: 600,
                            fontSize: 16,
                            marginBottom: 4,
                            textAlign: 'center',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...newQuizQuestions];
                            updated[idx].correct = cidx;
                            setNewQuizQuestions(updated);
                          }}
                          style={{
                            marginTop: 4,
                            background: q.correct === cidx ? '#e86786' : '#fff',
                            color: q.correct === cidx ? '#fff' : '#e86786',
                            border: `1.5px solid #e86786`,
                            borderRadius: 6,
                            padding: '2px 8px',
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: 'pointer',
                            width: '100%',
                          }}
                        >
                          {q.correct === cidx ? 'Correct' : 'Mark Correct'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Action Buttons */}
            <div style={{ 
              borderTop: '1px solid #e9ecef', 
              paddingTop: '16px',
              flexShrink: 0
            }}>
              <button
                style={{ background: '#6c757d', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 28px', fontWeight: 600, fontSize: 18, marginTop: 8, cursor: 'pointer', width: '100%' }}
                onClick={addNewQuizQuestion}
              >
                + Add Question
              </button>
              <button
                style={{ 
                  background: quizCreating 
                    ? '#a0a0a0' 
                    : '#4fa37e', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: 8, 
                  padding: '10px 28px', 
                  fontWeight: 600, 
                  fontSize: 18, 
                  marginTop: 8, 
                  cursor: quizCreating ? 'not-allowed' : 'pointer', 
                  width: '100%',
                  opacity: quizCreating ? 0.7 : 1
                }}
                onClick={saveNewQuizToFirestore}
                disabled={quizCreating}
              >
                {quizCreating ? 'Creating...' : 'Create Quiz'}
              </button>
            </div>
            
            {/* Professional Loading Screen */}
            {quizCreating && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 18,
                zIndex: 10
              }}>
                {/* Professional Spinner */}
                <div style={{
                  position: 'relative',
                  width: 48,
                  height: 48,
                  marginBottom: 20
                }}>
                  <div style={{
                    width: '100%',
                    height: '100%',
                    border: '3px solid rgba(79, 163, 126, 0.1)',
                    borderTop: '3px solid #4fa37e',
                    borderRadius: '50%',
                    animation: 'spin 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                    position: 'absolute',
                    top: 0,
                    left: 0
                  }}></div>
                  <div style={{
                    width: '100%',
                    height: '100%',
                    border: '3px solid transparent',
                    borderTop: '3px solid rgba(79, 163, 126, 0.3)',
                    borderRadius: '50%',
                    animation: 'spin 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite reverse',
                    position: 'absolute',
                    top: 0,
                    left: 0
                  }}></div>
                </div>
                
                {/* Professional Text */}
                <h3 style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: '#2c3e50',
                  margin: '0 0 6px 0',
                  textAlign: 'center',
                  letterSpacing: '-0.2px'
                }}>
                  Creating Quiz
                </h3>
                
                <p style={{
                  fontSize: 13,
                  color: '#6c757d',
                  margin: 0,
                  textAlign: 'center',
                  lineHeight: 1.4,
                  maxWidth: 180
                }}>
                  Setting up your new quiz...
                </p>
                
                {/* Progress Indicator */}
                <div style={{
                  display: 'flex',
                  gap: 4,
                  marginTop: 16
                }}>
                  <div style={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: '#4fa37e',
                    animation: 'pulse 1.4s ease-in-out infinite'
                  }}></div>
                  <div style={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: '#4fa37e',
                    animation: 'pulse 1.4s ease-in-out infinite 0.2s'
                  }}></div>
                  <div style={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: '#4fa37e',
                    animation: 'pulse 1.4s ease-in-out infinite 0.4s'
                  }}></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success Notification */}
      {showSuccessNotification && (
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          background: 'linear-gradient(135deg, #4fa37e 0%, #3d8b6f 100%)',
          color: 'white',
          padding: '16px 24px',
          borderRadius: 12,
          boxShadow: '0 8px 25px rgba(79, 163, 126, 0.3)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          animation: 'slideInRight 0.3s ease-out',
          maxWidth: 400
        }}>
          <div style={{ 
            width: 24, 
            height: 24, 
            background: 'rgba(255,255,255,0.2)', 
            borderRadius: 12, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: 16
          }}>
            ✓
          </div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>
            {successMessage || 'Quiz created successfully!'}
          </div>
        </div>
      )}

      {/* Error Notification */}
      {showErrorNotification && (
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
          color: 'white',
          padding: '16px 24px',
          borderRadius: 12,
          boxShadow: '0 8px 25px rgba(220, 53, 69, 0.3)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          animation: 'slideInRight 0.3s ease-out',
          maxWidth: 400
        }}>
          <div style={{ 
            width: 24, 
            height: 24, 
            background: 'rgba(255,255,255,0.2)', 
            borderRadius: 12, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: 16
          }}>
            ✗
          </div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>
            {errorMessage}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ 
            background: '#fff', 
            borderRadius: 12, 
            padding: 30, 
            textAlign: 'center', 
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
          }}>
            <h2 style={{ marginBottom: 15, fontSize: 24, color: '#333' }}>Confirm Deletion</h2>
            <p style={{ marginBottom: 25, fontSize: 16, color: '#666' }}>
              Are you sure you want to delete this quiz? This will permanently remove it from:
              <br />• The web interface
              <br />• Unity app assignments
              <br />• All student records
              <br />
              <strong style={{ color: '#dc3545' }}>This action cannot be undone.</strong>
            </p>
            <div style={{ display: 'flex', gap: 15, justifyContent: 'center' }}>
              <button
                style={{ 
                  background: '#dc3545', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: 8, 
                  padding: '10px 25px', 
                  fontSize: 16, 
                  fontWeight: 600, 
                  cursor: 'pointer', 
                  boxShadow: '0 4px 12px rgba(220, 53, 69, 0.3)'
                }}
                onClick={confirmDelete}
              >
                Delete
              </button>
              <button
                style={{ 
                  background: '#6c757d', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: 8, 
                  padding: '10px 25px', 
                  fontSize: 16, 
                  fontWeight: 600, 
                  cursor: 'pointer', 
                  boxShadow: '0 4px 12px rgba(108, 117, 125, 0.3)'
                }}
                onClick={cancelDelete}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignmentModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
          background: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'white', borderRadius: 24, padding: 0, width: '90%', maxWidth: 800,
            maxHeight: '90vh', overflow: 'auto', 
            boxShadow: '0 25px 80px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.1)',
            border: '1px solid rgba(79,163,126,0.2)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #4fa37e 0%, #3d8b6f 100%)',
              color: 'white', padding: '28px 32px', borderRadius: '24px 24px 0 0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Subtle background pattern */}
              <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 100%)',
                borderRadius: '0 24px 0 100%',
                pointerEvents: 'none'
              }}></div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: 56, height: 56, background: 'rgba(255,255,255,0.2)',
                  borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                  border: '1px solid rgba(255,255,255,0.3)'
                }}>
                  <i className="ri-send-plane-line" style={{ fontSize: 26, fontWeight: 'bold' }}></i>
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px' }}>Assign Quiz</h2>
                  <p style={{ margin: '6px 0 0 0', fontSize: 16, opacity: 0.9, fontWeight: 500 }}>
                    {quizToAssign?.title}
                  </p>
                </div>
              </div>
              <button
                onClick={closeAssignmentModal}
                style={{
                  background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 14,
                  width: 44, height: 44, color: 'white', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, transition: 'all 0.3s ease', position: 'relative', zIndex: 1,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.25)';
                  e.target.style.transform = 'scale(1.05)';
                  e.target.style.borderColor = 'rgba(255,255,255,0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.15)';
                  e.target.style.transform = 'scale(1)';
                  e.target.style.borderColor = 'rgba(255,255,255,0.2)';
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ 
              padding: '24px', 
              background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
              flex: 1,
              overflow: 'auto'
            }}>

              {/* Section Selection */}
              <div style={{ 
                marginBottom: 24, 
                background: 'white', 
                borderRadius: 16, 
                padding: '20px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                border: '1px solid rgba(79,163,126,0.1)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Subtle background pattern */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '60px',
                  height: '60px',
                  background: 'linear-gradient(135deg, rgba(79, 163, 126, 0.08) 0%, transparent 100%)',
                  borderRadius: '0 16px 0 100%',
                  pointerEvents: 'none'
                }}></div>
                
                <div style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 20, position: 'relative', zIndex: 1
                }}>
                  <h3 style={{ 
                    margin: 0, fontSize: 18, fontWeight: 700, color: '#2c3e50',
                    display: 'flex', alignItems: 'center', gap: 12
                  }}>
                    <div style={{
                      width: 40, height: 40, background: 'linear-gradient(135deg, #4fa37e 0%, #3d8b6f 100%)',
                      borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 3px 12px rgba(79,163,126,0.25)'
                    }}>
                      <i className="ri-group-line" style={{ color: 'white', fontSize: 18 }}></i>
                    </div>
                    Select Sections ({selectedSections.length} selected)
                  </h3>
                  
                  <button
                    onClick={toggleAllSections}
                    style={{
                      background: selectedSections.length === sections.length 
                        ? 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)'
                        : 'linear-gradient(135deg, #4fa37e 0%, #3d8b6f 100%)',
                      color: 'white', border: 'none', borderRadius: 12, padding: '12px 20px',
                      fontSize: 14, fontWeight: 600, cursor: 'pointer',
                      transition: 'all 0.3s ease', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      display: 'flex', alignItems: 'center', gap: 8
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                    }}
                  >
                    <i className={selectedSections.length === sections.length ? 'ri-checkbox-line' : 'ri-checkbox-blank-line'} style={{ fontSize: 16 }}></i>
                    {selectedSections.length === sections.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                
                <div style={{ 
                  maxHeight: 300, overflowY: 'auto', border: '2px solid #e9ecef',
                  borderRadius: 16, background: '#f8f9fa',
                  boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.04)',
                  position: 'relative', zIndex: 1
                }}>
                  {sections.length === 0 ? (
                    <div style={{
                      padding: '50px 20px', textAlign: 'center', color: '#666'
                    }}>
                      <div style={{
                        width: 80, height: 80, background: 'linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%)',
                        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 20px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
                      }}>
                        <i className="ri-group-line" style={{ fontSize: 36, color: '#6c757d' }}></i>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#2c3e50' }}>
                        No Sections Found
                      </div>
                      <div style={{ fontSize: 14, opacity: 0.8, color: '#6c757d' }}>
                        Please add sections to your class first.
                      </div>
                    </div>
                  ) : (
                    sections.map((section) => {
                      const studentsInSection = students.filter(student => student.sectionId === section.id);
                      
                      return (
                        <div
                          key={section.id}
                          style={{
                            padding: '16px 20px', borderBottom: '1px solid #e9ecef',
                            transition: 'all 0.3s ease',
                            background: selectedSections.includes(section.id) 
                              ? 'linear-gradient(135deg, #4fa37e 0%, #3d8b6f 100%)'
                              : 'transparent',
                            color: selectedSections.includes(section.id) ? 'white' : '#2c3e50',
                            position: 'relative'
                          }}
                          onMouseEnter={(e) => {
                            if (!selectedSections.includes(section.id)) {
                              e.target.style.background = 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)';
                              e.target.style.transform = 'translateX(4px)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!selectedSections.includes(section.id)) {
                              e.target.style.background = 'transparent';
                              e.target.style.transform = 'translateX(0)';
                            }
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                            <input
                              type="checkbox"
                              checked={selectedSections.includes(section.id)}
                              onChange={() => toggleSectionSelection(section.id)}
                              style={{
                                width: 20,
                                height: 20,
                                cursor: 'pointer',
                                accentColor: '#4fa37e',
                                transform: 'scale(1.1)'
                              }}
                            />
                            <div style={{
                              width: 50, height: 50, borderRadius: '12px',
                              background: selectedSections.includes(section.id) 
                                ? 'rgba(255,255,255,0.2)' 
                                : 'linear-gradient(135deg, #4fa37e 0%, #3d8b6f 100%)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              boxShadow: '0 3px 12px rgba(0,0,0,0.15)',
                              border: '2px solid rgba(255,255,255,0.3)',
                              overflow: 'hidden'
                            }}>
                              <i className="ri-group-line" style={{ 
                                fontSize: 24, 
                                color: selectedSections.includes(section.id) ? 'white' : 'white'
                              }}></i>
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ 
                                fontWeight: 600, 
                                fontSize: 16, 
                                marginBottom: 4,
                                color: selectedSections.includes(section.id) ? 'white' : '#2c3e50'
                              }}>
                                {section.name || section.sectionName || 'Unnamed Section'}
                              </div>
                              <div style={{ 
                                fontSize: 14, opacity: 0.8,
                                color: selectedSections.includes(section.id) ? 'rgba(255,255,255,0.8)' : '#6c757d'
                              }}>
                                {studentsInSection.length} student(s) in this section
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ 
                display: 'flex', gap: 20, justifyContent: 'flex-end',
                paddingTop: 20, borderTop: '2px solid #e9ecef',
                background: 'white', borderRadius: '0 0 16px 16px',
                margin: '0 -24px -24px -24px', padding: '20px 24px 24px 24px',
                flexShrink: 0
              }}>
                <button
                  onClick={closeAssignmentModal}
                  style={{
                    background: 'linear-gradient(135deg, #6c757d 0%, #5a6268 100%)',
                    color: 'white', border: 'none', borderRadius: 14, padding: '14px 28px',
                    fontSize: 16, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.3s ease', boxShadow: '0 4px 16px rgba(108, 117, 125, 0.3)',
                    display: 'flex', alignItems: 'center', gap: 8
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-3px)';
                    e.target.style.boxShadow = '0 8px 25px rgba(108, 117, 125, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 16px rgba(108, 117, 125, 0.3)';
                  }}
                >
                  <i className="ri-close-line" style={{ fontSize: 18 }}></i>
                  Cancel
                </button>
                <button
                  onClick={assignQuiz}
                  style={{
                    background: 'linear-gradient(135deg, #4fa37e 0%, #3d8b6f 100%)',
                    color: 'white', border: 'none', borderRadius: 14, padding: '14px 28px',
                    fontSize: 16, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.3s ease', boxShadow: '0 4px 16px rgba(79, 163, 126, 0.3)',
                    display: 'flex', alignItems: 'center', gap: 8
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-3px)';
                    e.target.style.boxShadow = '0 8px 25px rgba(79, 163, 126, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 16px rgba(79, 163, 126, 0.3)';
                  }}
                >
                  <i className="ri-send-plane-line" style={{ fontSize: 18 }}></i>
                  Assign Quiz
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Lock/Unlock Confirmation Modal */}
      {showLockConfirmModal && quizToLock && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'white', borderRadius: 20, padding: 0, width: '90%', maxWidth: 450,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            border: '1px solid rgba(0,0,0,0.1)',
            animation: 'modalSlideIn 0.3s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{
              background: isQuizLocked(quizToLock) 
                ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
                : 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)',
              color: 'white', padding: '25px 30px', borderRadius: '20px 20px 0 0',
              display: 'flex', alignItems: 'center', gap: 15
            }}>
              <div style={{
                width: 50, height: 50, background: 'rgba(255,255,255,0.2)',
                borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <i className={isQuizLocked(quizToLock) ? 'ri-lock-unlock-line' : 'ri-lock-line'} style={{ fontSize: 24 }}></i>
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
                  {isQuizLocked(quizToLock) ? 'Unlock Quiz' : 'Lock Quiz'}
                </h2>
              </div>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '30px' }}>
              <p style={{ 
                margin: '0 0 30px 0', 
                fontSize: 16, 
                color: '#666', 
                textAlign: 'center',
                lineHeight: 1.5
              }}>
                Are you sure you want to <strong>{isQuizLocked(quizToLock) ? 'unlock' : 'lock'}</strong> the quiz 
                <br />
                <strong style={{ color: '#2c3e50' }}>"{quizToLock.title}"</strong>?
                <br />
                <br />
                {isQuizLocked(quizToLock) 
                  ? 'Students will be able to take this quiz after unlocking.'
                  : 'Students will not be able to take this quiz after locking.'
                }
              </p>

              {/* Action Buttons */}
              <div style={{ 
                display: 'flex', gap: 15, justifyContent: 'center'
              }}>
                <button
                  onClick={cancelLockToggle}
                  style={{
                    background: 'linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)',
                    color: 'white', border: 'none', borderRadius: 12, padding: '12px 25px',
                    fontSize: 16, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.2s ease', boxShadow: '0 4px 12px rgba(149, 165, 166, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(149, 165, 166, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(149, 165, 166, 0.3)';
                  }}
                >
                  <i className="ri-close-line" style={{ marginRight: 8 }}></i>
                  Cancel
                </button>
                <button
                  onClick={confirmLockToggle}
                  style={{
                    background: isQuizLocked(quizToLock)
                      ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
                      : 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)',
                    color: 'white', border: 'none', borderRadius: 12, padding: '12px 25px',
                    fontSize: 16, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.2s ease', boxShadow: isQuizLocked(quizToLock)
                      ? '0 4px 12px rgba(40, 167, 69, 0.3)'
                      : '0 4px 12px rgba(220, 53, 69, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = isQuizLocked(quizToLock)
                      ? '0 6px 20px rgba(40, 167, 69, 0.4)'
                      : '0 6px 20px rgba(220, 53, 69, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = isQuizLocked(quizToLock)
                      ? '0 4px 12px rgba(40, 167, 69, 0.3)'
                      : '0 4px 12px rgba(220, 53, 69, 0.3)';
                  }}
                >
                  <i className={isQuizLocked(quizToLock) ? 'ri-lock-unlock-line' : 'ri-lock-line'} style={{ marginRight: 8 }}></i>
                  {isQuizLocked(quizToLock) ? 'Unlock Quiz' : 'Lock Quiz'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Assignment Loading Screen */}
      <QuizAssignmentLoading 
        isVisible={isAssigningQuiz || isAssignmentCompleted} 
        quizTitle={quizToAssign?.title || ''} 
        isCompleted={isAssignmentCompleted}
        onClose={handleAssignmentComplete}
      />
        </>
      )}
    </>
  );
}
