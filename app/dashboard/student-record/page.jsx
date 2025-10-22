'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTeacher } from '../../lib/Teacher-SPCC';
import './studentRecord.css';
import { db, collection, getDocs, getAllStudents, getAllSections, addStudent, addSection, updateStudent, deleteStudent, deleteSection, setStudentQuizUnlock } from '../../lib/firebase';
import { addDoc, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { notifyStudentAdded, notifyStudentUpdated, notifyStudentDeleted, notifySectionCreated, notifySectionDeleted } from '../../lib/notificationUtils';
import { checkUserPermissions } from '../../lib/adminUtils';
import { useNotifications } from '../../components/NotificationToast';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import { useLoadingState, LoadingOverlay, Spinner } from '../../components/LoadingComponents';
import { LOADING_TYPES } from '../../lib/LoadingContext';

const rowColors = ['#f9efc3', '#e6d1b3', '#e6b3b3', '#b3e6c7'];

// Section color palette matching student cards exactly
const sectionColors = ['#f9efc3', '#e6d1b3', '#e6b3b3', '#b3e6c7'];

// Function to get section color based on index
const getSectionColor = (index) => {
  return sectionColors[index % sectionColors.length];
};

const defaultStudent = {
  firstName: '', middleName: '', lastName: '', userName: '', password: '', lrn: '', address: '', contact: '', 
  gender: '', gradeLevel: '', parentGuardianName: '', dateOfEnrollment: '', currentStatus: 'Regular Student', avatar: '/avatar3.png'
};

export default function StudentRecordPage() {
  const { teacherEmail } = useTeacher();
  const router = useRouter();
  const { showSuccess, showError, showWarning, showInfo } = useNotifications();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    firstName: '', middleName: '', lastName: '', userName: '', password: '', lrn: '', address: '', contact: '',
    gender: '', gradeLevel: 'Grade 6', parentGuardianName: '', dateOfEnrollment: '', currentStatus: 'Regular Student', sectionId: ''
  });
  const [editModal, setEditModal] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [showStudentInfo, setShowStudentInfo] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const fileInputRef = useRef(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successStudentName, setSuccessStudentName] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
  const [deletedStudentName, setDeletedStudentName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [showFormValidation, setShowFormValidation] = useState(false);
  const [showEditWarning, setShowEditWarning] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showSectionPassword, setShowSectionPassword] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Import progress state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [importedCount, setImportedCount] = useState(0);
  const [totalToImport, setTotalToImport] = useState(0);
  
  // Section management state
  const [sections, setSections] = useState([]);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [sectionForm, setSectionForm] = useState({ name: '', description: '' });
  const [sectionCreating, setSectionCreating] = useState(false);
  const [expandedSections, setExpandedSections] = useState(new Set());
  const [sectionErrors, setSectionErrors] = useState({});
  const [showDeleteSectionModal, setShowDeleteSectionModal] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState(null);
  const [showSectionStudentsModal, setShowSectionStudentsModal] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null);
  const [showSectionAddStudentModal, setShowSectionAddStudentModal] = useState(false);
  const [showSectionImportModal, setShowSectionImportModal] = useState(false);
  const [sectionStudentForm, setSectionStudentForm] = useState({
    firstName: '', middleName: '', lastName: '', studentId: '', password: '', lrn: '', address: '', contact: '',
    gender: '', gradeLevel: '', parentGuardianName: '', dateOfEnrollment: '', currentStatus: 'Regular Student', sectionId: ''
  });
  const [sectionStudentErrors, setSectionStudentErrors] = useState({});

  // Loading: show global indicator during section deletion
  const deleteSectionLoading = useLoadingState('delete-section', LOADING_TYPES.FIREBASE);

  // Deleting progress overlay state
  const [isDeletingSection, setIsDeletingSection] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteCurrentCount, setDeleteCurrentCount] = useState(0);
  const [deleteTotalCount, setDeleteTotalCount] = useState(0);
  const [deleteCurrentStudentName, setDeleteCurrentStudentName] = useState('');

  // Get role and permissions from localStorage
  const [teacherRole, setTeacherRole] = useState('');
  const [teacherPermissions, setTeacherPermissions] = useState({});

  // Add permission checking - these will be computed values using useMemo
  const canManageStudents = useMemo(() => 
    checkUserPermissions(teacherRole, teacherPermissions, 'add_student'), 
    [teacherRole, teacherPermissions]
  );
  const canManageSections = useMemo(() => 
    checkUserPermissions(teacherRole, teacherPermissions, 'manage_sections'), 
    [teacherRole, teacherPermissions]
  );
  const canImportStudents = useMemo(() => 
    checkUserPermissions(teacherRole, teacherPermissions, 'import_students'), 
    [teacherRole, teacherPermissions]
  );
  const canViewStudents = useMemo(() => 
    checkUserPermissions(teacherRole, teacherPermissions, 'view_students'), 
    [teacherRole, teacherPermissions]
  );


  // Function to format student name as "Last Name, First Name Initial"
  const formatStudentName = (student) => {
    const firstName = student.firstName || '';
    const middleName = student.middleName || '';
    const lastName = student.lastName || '';
    
    // Get first initial of first name
    const firstInitial = firstName.charAt(0).toUpperCase();
    
    // Get first initial of middle name if it exists
    const middleInitial = middleName ? middleName.charAt(0).toUpperCase() + '.' : '';
    
    // Format as "Last Name, First Name Initial"
    return `${lastName}, ${firstName} ${middleInitial}`.trim();
  };

  // Function to sort students numerically by student ID (student001 to student033)
  const sortStudentsByID = (students) => {
    return students.sort((a, b) => {
      // Extract numeric part from student ID (e.g., "student001" -> 1, "student033" -> 33)
      const getNumericID = (id) => {
        if (!id) return 999; // Put students without ID at the end
        const match = id.match(/student(\d+)/);
        return match ? parseInt(match[1], 10) : 999;
      };
      
      const idA = getNumericID(a.id);
      const idB = getNumericID(b.id);
      
      // Primary sort: by student ID number (001, 002, 003... 033)
      if (idA !== idB) {
        return idA - idB;
      }
      
      // Secondary sort: if same ID (shouldn't happen), maintain original order
      return 0;
    });
  };

  // Function to filter students based on search term (prioritizes Student ID)
  const filterStudents = (students, searchTerm) => {
    if (!searchTerm.trim()) return students;
    
    const term = searchTerm.toLowerCase();
    return students.filter(student => {
      const studentId = (student.id || '').toLowerCase();
      const lrn = (student.lrn || '').toLowerCase();
      
      // Primary search: Student ID (student001, student002, etc.)
      if (studentId.includes(term)) {
        return true;
      }
      
      // Secondary search: LRN number
      if (lrn.includes(term)) {
        return true;
      }
      
      // Fallback: search by names (for backward compatibility)
      const fullName = formatStudentName(student).toLowerCase();
      const firstName = (student.firstName || '').toLowerCase();
      const lastName = (student.lastName || '').toLowerCase();
      
      return fullName.includes(term) || 
             firstName.includes(term) || 
             lastName.includes(term);
    });
  };

  // Pagination calculation functions
  const getTotalPages = (totalItems) => {
    return Math.ceil(totalItems / itemsPerPage);
  };

  const getCurrentPageStudents = (students) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return students.slice(startIndex, endIndex);
  };

  const goToPage = (page) => {
    setCurrentPage(page);
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    const totalPages = getTotalPages(filteredStudents.length);
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Section students pagination helpers
  const getTotalPagesForSection = (sectionId) => {
    if (!sectionId) return 1;
    return getTotalPages(getStudentsInSection(sectionId).length);
  };

  const goToPreviousSectionPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextSectionPage = () => {
    if (!selectedSection) return;
    const totalPages = getTotalPagesForSection(selectedSection.id);
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  async function fetchStudents() {
    setLoading(true);
    try {
      // Use the new clean structure
      const data = await getAllStudents();
      const dataWithColors = data.map((student, i) => ({ ...student, color: rowColors[i % rowColors.length] }));
      
      // Sort students numerically by student ID
      const sortedData = sortStudentsByID(dataWithColors);
      setStudents(sortedData);
      setFilteredStudents(sortedData);
    } catch (error) {
      console.error('Error fetching students:', error);
      setError('Failed to fetch students. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStudents();
    fetchSections();
  }, []);

  // Load role and permissions from localStorage
  useEffect(() => {
    const role = localStorage.getItem('teacherRole') || '';
    const permissions = JSON.parse(localStorage.getItem('teacherPermissions') || '{}');
    setTeacherRole(role);
    setTeacherPermissions(permissions);
  }, []);


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Validation for name fields - no integers allowed
    if (name === 'firstName' || name === 'lastName' || name === 'middleName' || name === 'parentGuardianName') {
      // Check if the value contains any numbers
      if (/\d/.test(value)) {
        let fieldLabel = '';
        if (name === 'middleName') fieldLabel = 'Middle Name';
        else if (name === 'firstName') fieldLabel = 'First Name';
        else if (name === 'lastName') fieldLabel = 'Last Name';
        else if (name === 'parentGuardianName') fieldLabel = 'Parent/Guardian Name';
        
        setFieldErrors({ ...fieldErrors, [name]: `${fieldLabel} cannot contain numbers` });
        return; // Don't update the form if it contains numbers
      }
    }
    
    setForm({ ...form, [name]: value });
    
    // Clear field error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors({ ...fieldErrors, [name]: '' });
    }
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    
    // Filter students based on search term
    const filtered = filterStudents(students, term);
    setFilteredStudents(filtered);
    
    // Reset to first page when searching
    setCurrentPage(1);
  };

  // Check if all required form fields are filled and set field errors
  const validateForm = () => {
    const errors = {};
    const requiredFields = [
      { name: 'firstName', label: 'First Name' },
      { name: 'lastName', label: 'Last Name' },
      { name: 'userName', label: 'Username' },
      { name: 'password', label: 'Password' },
      { name: 'lrn', label: 'LRN' },
      { name: 'address', label: 'Address' },
      { name: 'contact', label: 'Contact' },
      { name: 'gender', label: 'Gender' },
      { name: 'gradeLevel', label: 'Grade Level' },
      { name: 'parentGuardianName', label: 'Parent/Guardian Name' },
      { name: 'dateOfEnrollment', label: 'Date of Enrollment' }
    ];

    requiredFields.forEach(field => {
      if (!form[field.name] || form[field.name].trim() === '') {
        errors[field.name] = `${field.label} is required`;
      }
    });

    // Additional validations
    if (form.userName && form.userName.length < 3) {
      errors.userName = 'Username must be at least 3 characters';
    }
    
    // Password validation - required field
    if (!form.password || form.password.trim() === '') {
      errors.password = 'Password is required';
    } else if (form.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    // First Name validation - pure string only (no numbers, no special characters)
    if (form.firstName && !/^[a-zA-Z\s]+$/.test(form.firstName)) {
      errors.firstName = 'First name must contain only letters and spaces';
    }

    // Last Name validation - pure string only (no numbers, no special characters)
    if (form.lastName && !/^[a-zA-Z\s]+$/.test(form.lastName)) {
      errors.lastName = 'Last name must contain only letters and spaces';
    }

    // LRN validation - pure numbers only (no special characters)
    if (form.lrn && !/^\d+$/.test(form.lrn)) {
      errors.lrn = 'LRN must contain only numbers';
    }

    // Contact number validation - must be exactly 11 digits
    if (form.contact && !/^\d{11}$/.test(form.contact)) {
      errors.contact = 'Contact number must be exactly 11 digits';
    }

    if (form.address && form.address.length < 5) {
      errors.address = 'Address must be at least 5 characters';
    }

    // Grade Level validation - automatic Grade 6 (like student ID)
    if (form.gradeLevel && form.gradeLevel !== 'Grade 6') {
      errors.gradeLevel = 'Grade level must be Grade 6';
    }

    // Parent/Guardian validation - pure string only (no numbers, no special characters)
    if (form.parentGuardianName && !/^[a-zA-Z\s]+$/.test(form.parentGuardianName)) {
      errors.parentGuardianName = 'Parent/Guardian name must contain only letters and spaces';
    }

    if (form.dateOfEnrollment) {
      const enrollmentDate = new Date(form.dateOfEnrollment);
      const today = new Date();
      if (enrollmentDate > today) {
        errors.dateOfEnrollment = 'Enrollment date cannot be in the future';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Check if all required edit form fields are filled
  const isEditFormValid = () => {
    if (!editStudent) return false;
    const requiredFields = ['firstName', 'lastName', 'password'];
    return requiredFields.every(field => editStudent[field] && editStudent[field].trim() !== '');
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    
    // Validation for name fields - no integers allowed
    if (name === 'firstName' || name === 'lastName' || name === 'middleName' || name === 'parentGuardianName') {
      // Check if the value contains any numbers
      if (/\d/.test(value)) {
        let fieldLabel = '';
        if (name === 'middleName') fieldLabel = 'Middle Name';
        else if (name === 'firstName') fieldLabel = 'First Name';
        else if (name === 'lastName') fieldLabel = 'Last Name';
        else if (name === 'parentGuardianName') fieldLabel = 'Parent/Guardian Name';
        
        setFieldErrors({ ...fieldErrors, [name]: `${fieldLabel} cannot contain numbers` });
        return; // Don't update the form if it contains numbers
      }
    }
    
    const updatedStudent = { ...editStudent, [name]: value };
    
    // Update avatar if gender is changed
    if (name === 'gender') {
      updatedStudent.avatar = value === 'Male' ? '/avatar4.png' : '/avatar3.png';
    }
    
    setEditStudent(updatedStudent);
    setHasUnsavedChanges(true);
    console.log('hasUnsavedChanges set to true'); // Debug log
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    
    // Check permissions first
    if (!canManageStudents) {
      showError('You do not have permission to add students.');
      return;
    }
    
      // Validate form and show field errors
    if (!validateForm()) {
      return;
    }
    
    // Set avatar based on gender
    const avatar = form.gender === 'Male' ? '/avatar4.png' : '/avatar3.png';
    const newStudent = { ...form, avatar };
    
    try {
      // Use LRN as the document ID
      await addStudent(newStudent);
      await fetchStudents();
      setForm(defaultStudent);
      setFieldErrors({});
      setShowModal(false);
      
      // Show professional success message
      setSuccessStudentName(`${form.firstName} ${form.lastName}`);
      setShowSuccessMessage(true);
      
             // Add notification
       await notifyStudentAdded(teacherEmail, `${form.firstName} ${form.lastName}`, form.gender);
      
      // Auto-hide after 3 seconds
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
    } catch (error) {
      console.error('Error adding student:', error);
      showError('Error adding student. Please try again.');
    }
  };

  const handleDelete = async (idx) => {
    // Check permissions first
    if (!canManageStudents) {
      showError('You do not have permission to archive students.');
      return;
    }
    
    const student = students[idx];
    setStudentToDelete({ ...student, index: idx });
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (studentToDelete && studentToDelete.id) {
      try {
        // Move student to archive instead of permanent deletion
        const studentData = studentToDelete;
        
        // Find the section name for this student
        const studentSection = sections.find(section => section.id === studentData.sectionId);
        const sectionName = studentSection ? studentSection.name : 'Unassigned';
        
        // Add sectionName to the student data before archiving
        const studentDataWithSection = {
          ...studentData,
          sectionName: sectionName
        };
        
        const deletedRef = doc(db, 'deleted_students', `deleted_${studentData.id}`);
        await setDoc(deletedRef, {
          originalId: studentData.id, // Store the original document ID
          originalData: studentDataWithSection,
          deletedAt: new Date().toISOString(),
          deletedBy: teacherEmail
        });

        // Embed quizResults answers into the archive record so restores can recover them
        try {
          const resultsCol = collection(db, 'users', 'students', 'students', studentData.id, 'quizResults');
          const resultsSnap = await getDocs(resultsCol);
          const backup = resultsSnap.docs.map(d => ({ id: d.id, data: d.data() }));
          if (backup.length > 0) {
            await updateDoc(deletedRef, { quizResults: backup });
          }
        } catch (_) {}

        // Now permanently delete from students collection
        await deleteStudent(studentToDelete.id, teacherEmail);
        await fetchStudents();
        
        // Add notification
        await notifyStudentDeleted(teacherEmail, `${studentToDelete.firstName} ${studentToDelete.lastName}`);
        
        // Show archive success message
        setDeletedStudentName(`${studentToDelete.firstName} ${studentToDelete.lastName}`);
        setShowDeleteSuccess(true);
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
          setShowDeleteSuccess(false);
        }, 3000);
      } catch (error) {
        console.error('Error archiving student:', error);
        alert('Error archiving student. Please try again.');
      }
    }
    setShowDeleteConfirm(false);
    setStudentToDelete(null);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setStudentToDelete(null);
  };

  const handleStudentClick = (student) => {
    console.log('🔍 Selected student data:', student);
    console.log('📋 Student name fields:', {
      firstName: student.firstName,
      middleName: student.middleName,
      lastName: student.lastName
    });
    setSelectedStudent(student);
    setShowStudentInfo(true);
  };

  const handleEdit = (student) => {
    // Check permissions first
    if (!canManageStudents) {
      alert('You do not have permission to edit students.');
      return;
    }
    
    setEditStudent({ ...defaultStudent, ...student });
    setEditModal(true);
    // Don't close student info modal if we're in section context
    if (!showSectionStudentsModal) {
      setShowStudentInfo(false);
    }
    setHasUnsavedChanges(false);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    
    // Check if all required fields are filled
    if (!isEditFormValid()) {
      setShowFormValidation(true);
      return;
    }
    
    if (editStudent && editStudent.id) {
      const { id, color, ...updateData } = editStudent;
      const allowedFields = [
        'firstName', 'middleName', 'lastName', 'password', 'lrn', 'address', 'contact', 
        'gender', 'gradeLevel', 'parentGuardianName', 'dateOfEnrollment', 'currentStatus', 'avatar'
      ];
      const filteredUpdate = Object.fromEntries(
        Object.entries(updateData).filter(([key]) => allowedFields.includes(key))
      );
      
      try {
        await updateStudent(id, filteredUpdate);
        await fetchStudents();
        
        // Update the selectedStudent state with the new data
        setSelectedStudent(prev => ({
          ...prev,
          ...filteredUpdate
        }));
        
        setEditModal(false);
        setEditStudent(null);
        setHasUnsavedChanges(false);
        
        // If we're in section context, return to student info modal
        if (showSectionStudentsModal) {
          setShowStudentInfo(true);
        }
        
        // Add notification
        await notifyStudentUpdated(teacherEmail, `${editStudent.firstName} ${editStudent.lastName}`);
      } catch (error) {
        console.error('Error updating student:', error);
        alert('Error updating student. Please try again.');
      }
    }
  };

  const handleImportStudents = async (e) => {
    // Check permissions first
    if (!canManageStudents) {
      alert('You do not have permission to import students.');
      return;
    }
    
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      // Start import process
      setIsImporting(true);
      setImportProgress(0);
      setImportStatus('Reading Excel file...');
      setImportedCount(0);
      
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      if (jsonData.length === 0) {
        alert('No data found in the Excel file.');
        e.target.value = '';
        setIsImporting(false);
        return;
      }
      
      const totalRows = jsonData.length;
      setTotalToImport(totalRows);
      setImportStatus(`Processing ${totalRows} students...`);
      
      let importedCount = 0;
      let skippedCount = 0;
      let duplicateCount = 0;
      const errors = [];
      const duplicateErrors = [];
      
      // Prepare sequential student ID generator (student001, student002, ...)
      const existingSequentialIds = students
        .map(s => s.id)
        .filter(id => typeof id === 'string' && /^student\d+$/i.test(id));
      const existingNumbers = existingSequentialIds
        .map(id => {
          const m = id.match(/student(\d+)/i);
          return m ? parseInt(m[1], 10) : 0;
        })
        .filter(n => Number.isFinite(n));
      let nextSequential = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
      const getNextStudentSequentialId = () => {
        const id = `student${String(nextSequential).padStart(3, '0')}`;
        nextSequential += 1;
        return id;
      };
      
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row) continue;
        
        // Update progress
        const progress = Math.round((i / totalRows) * 100);
        setImportProgress(progress);
        setImportStatus(`Importing student ${i + 1} of ${totalRows}...`);
        
        // Set avatar based on gender
        const gender = row['Gender'] || '';
        const avatar = gender === 'Male' ? '/avatar4.png' : '/avatar3.png';
        
        // Try to derive studentId from Username column when present (e.g., Student001)
        const usernameRaw = (row['Username'] || '').toString().trim();
        const usernameMatch = usernameRaw.match(/student\s*0*(\d{1,3})/i);
        const derivedStudentId = usernameMatch ? `student${usernameMatch[1].padStart(3, '0')}` : null;

        const student = {
          firstName: row['First name'] || '',
          middleName: row['Middle name'] || '',
          lastName: row['Last name'] || '',
          userName: row['Username'] || '',
          password: row['Password'] || '',
          lrn: row['LRN'] ? row['LRN'].toString() : '',
          address: row['Address'] || '',
          contact: row['Contact'] ? row['Contact'].toString() : '',
          gender: gender,
          gradeLevel: row['Grade Level'] || '6',
          parentGuardianName: row['Parent/Guardian Name'] || '',
          dateOfEnrollment: row['Date of Enrollment'] || new Date().toISOString().split('T')[0],
          currentStatus: row['Current Status'] || 'Regular Student',
          avatar: avatar,
          // Prefer Username-based ID if available, otherwise sequential
          studentId: derivedStudentId || getNextStudentSequentialId(),
        };
        
        // Only add if required fields are present and LRN is provided
        if (student.firstName && student.lastName && student.password && student.lrn) {
          console.log(`Importing student ${i + 1}:`, student);
          const result = await addStudent({ ...student, preferSequential: true });
          
          if (result.success) {
            console.log(`Successfully added student with ID: ${result.id}`);
            importedCount++;
            setImportedCount(importedCount);
          } else if (result.type === 'duplicate') {
            duplicateCount++;
            duplicateErrors.push(`Row ${i + 1}: ${result.error}`);
            console.log(`Skipped duplicate student ${i + 1}: ${result.error}`);
          } else {
            console.error(`Error importing student ${i + 1}:`, result.error);
            errors.push(`Row ${i + 1}: ${result.error}`);
            skippedCount++;
          }
        } else {
          console.log(`Skipping student ${i + 1} - missing required fields:`, {
            firstName: student.firstName,
            lastName: student.lastName,
            userName: student.userName,
            password: student.password,
            lrn: student.lrn
          });
          errors.push(`Row ${i + 1}: Missing required fields (First Name, Last Name, Username, Password, or LRN)`);
          skippedCount++;
        }
        
        // Add small delay for visual effect
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Final progress update
      setImportProgress(100);
      setImportStatus('Finalizing import...');
      
      await fetchStudents();
      
      // Show import results
      let message = `Import completed!\n\nImported: ${importedCount} students`;
      if (duplicateCount > 0) {
        message += `\nDuplicates skipped: ${duplicateCount} students`;
      }
      if (skippedCount > 0) {
        message += `\nSkipped: ${skippedCount} students`;
      }
      if (errors.length > 0) {
        message += `\n\nErrors:\n${errors.slice(0, 5).join('\n')}`;
        if (errors.length > 5) {
          message += `\n... and ${errors.length - 5} more errors`;
        }
      }
      if (duplicateErrors.length > 0) {
        message += `\n\nDuplicates:\n${duplicateErrors.slice(0, 3).join('\n')}`;
        if (duplicateErrors.length > 3) {
          message += `\n... and ${duplicateErrors.length - 3} more duplicates`;
        }
      }
      
      // Log detailed results to console for debugging
      console.log('Import Results:', {
        totalRows: totalRows,
        importedCount,
        skippedCount,
        errors: errors
      });
      
      // Show success message
      setSuccessStudentName(`Successfully imported ${importedCount} students!`);
      setShowSuccessMessage(true);
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 5000);
      
    } catch (error) {
      console.error('Error importing students:', error);
      alert('Error reading the Excel file. Please make sure it\'s a valid Excel file.');
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      setImportStatus('');
      setImportedCount(0);
      setTotalToImport(0);
    }
    
    e.target.value = '';
  };

  // Section Management Functions
  const fetchSections = async () => {
    try {
      // Use the new clean structure
      const sectionsData = await getAllSections();
      setSections(sectionsData);
    } catch (error) {
      console.error('Error fetching sections:', error);
    } finally {
      // Ensure loading is set to false even if sections fail to load
      setLoading(false);
    }
  };

  const handleSectionInputChange = (e) => {
    const { name, value } = e.target;
    setSectionForm(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (sectionErrors[name]) {
      setSectionErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateSectionForm = () => {
    const errors = {};
    
    if (!sectionForm.name.trim()) {
      errors.name = 'Section name is required';
    } else if (sectionForm.name.length < 2) {
      errors.name = 'Section name must be at least 2 characters';
    } else if (sections.some(section => section.name.toLowerCase() === sectionForm.name.toLowerCase())) {
      errors.name = 'Section name already exists';
    }
    
    if (sectionForm.description && sectionForm.description.length > 100) {
      errors.description = 'Description must be less than 100 characters';
    }
    
    setSectionErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddSection = async (e) => {
    e.preventDefault();
    
    if (!canManageStudents) {
      showError('You do not have permission to add sections.');
      return;
    }
    
    if (!validateSectionForm()) {
      return;
    }
    
    setSectionCreating(true);
    
    try {
      const sectionData = {
        name: sectionForm.name.trim(),
        description: sectionForm.description.trim(),
        createdAt: new Date().toISOString(),
        createdBy: teacherEmail,
        studentCount: 0
      };
      
      await addSection(sectionData);

      // Notify section created
      await notifySectionCreated(teacherEmail, sectionData.name);
      
      // Refresh sections list
      await fetchSections();
      
      // Reset form
      setSectionForm({ name: '', description: '' });
      setSectionErrors({});
      setShowSectionModal(false);
      
      // Show success message
      showSuccess(`Section "${sectionForm.name}" created successfully!`);
      
    } catch (error) {
      console.error('Error adding section:', error);
      showError('Error creating section. Please try again.');
    } finally {
      setSectionCreating(false);
    }
  };

  const toggleSectionExpansion = (sectionId) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const getStudentsInSection = (sectionId) => {
    return students.filter(student => student.sectionId === sectionId);
  };

  const handleDeleteSection = (section) => {
    setSectionToDelete(section);
    setShowDeleteSectionModal(true);
  };

  const confirmDeleteSection = async () => {
    if (!sectionToDelete) return;
    
    try {
      deleteSectionLoading.start('Archiving section...');
      // Close the confirmation modal and show progress overlay
      setShowDeleteSectionModal(false);
      setIsDeletingSection(true);
      console.log('Starting section deletion for:', sectionToDelete);
      console.log('User email:', teacherEmail);
      console.log('User authenticated:', !!teacherEmail);
      
      // Check Firebase auth status
      const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
      const auth = getAuth();
      console.log('Firebase auth current user:', auth.currentUser);
      console.log('Firebase auth current user email:', auth.currentUser?.email);
      console.log('Firebase auth current user UID:', auth.currentUser?.uid);
      
      // Skip Firebase Auth for now - use the ultra-permissive rules
      console.log('Using custom authentication, relying on Firestore rules');
      
      // 1) Archive the section information first
      console.log('=== STEP 1: Archiving section information ===');
      const sectionArchiveData = {
        originalId: sectionToDelete.id,
        originalData: sectionToDelete,
        deletedAt: new Date().toISOString(),
        deletedBy: teacherEmail,
        studentCount: getStudentsInSection(sectionToDelete.id).length,
        archivedStudents: []
      };

      // 2) Delete all students that belong to this section and embed them under the archived section (not in deleted_students)
      console.log('=== STEP 2: Deleting students in section ===');
      const studentsInSection = getStudentsInSection(sectionToDelete.id);
      console.log('Students in section:', studentsInSection.length);
      
      setDeleteTotalCount(studentsInSection.length);
      setDeleteCurrentCount(0);
      setDeleteProgress(0);

      if (studentsInSection.length > 0) {
        console.log('Deleting students sequentially for progress...');
        for (let i = 0; i < studentsInSection.length; i++) {
          const student = studentsInSection[i];
          console.log('Deleting student:', student.id);

          // Update progress UI
          const displayName = `${student.firstName || ''} ${student.lastName || ''}`.trim();
          setDeleteCurrentStudentName(displayName);
          setDeleteCurrentCount(i + 1);
          setDeleteProgress(((i) / studentsInSection.length) * 100);

          // Embed the student's full data under the section archive instead of creating a deleted_students entry
          sectionArchiveData.archivedStudents.push({
            originalId: student.id,
            originalData: { ...student },
            archivedFromSection: sectionToDelete.name,
            archivedFromSectionId: sectionToDelete.id,
            deletedAt: new Date().toISOString(),
            deletedBy: teacherEmail,
            deletionReason: 'Section Deletion'
          });

          // Delete from active students
          await deleteStudent(student.id, teacherEmail || 'system');

          // Update progress after deletion of current
          setDeleteProgress(((i + 1) / studentsInSection.length) * 100);
        }
        console.log('All students deleted from section');
      } else {
        console.log('No students to delete in section');
      }

      // 3) Archive the section information
      console.log('=== STEP 3: Archiving section ===');
      await setDoc(doc(db, 'deleted_sections', `deleted_${sectionToDelete.id}`), sectionArchiveData);

      // 4) Try direct deletion without using the deleteSection function
      console.log('=== STEP 4: Attempting direct section deletion ===');
      const { doc: firestoreDoc, getDoc, deleteDoc } = await import('firebase/firestore');
      const sectionRef = firestoreDoc(db, 'academic', 'sections', 'sections', sectionToDelete.id);
      console.log('Section reference created:', sectionRef.path);
      
      // Check if section document exists first
      console.log('=== STEP 5: Checking if section document exists ===');
      try {
        const sectionDoc = await getDoc(sectionRef);
        console.log('Section document exists:', sectionDoc.exists());
        console.log('Section document data:', sectionDoc.data());
        
        if (!sectionDoc.exists()) {
          throw new Error('Section document does not exist');
        }
        console.log('Section document exists, proceeding with deletion...');
      } catch (getError) {
        console.error('Error checking section document:', getError);
        throw getError;
      }

      // 6) Try server-side deletion via API route
      console.log('=== STEP 6: Trying server-side deletion ===');
      console.log('Section ID:', sectionToDelete.id);
      
      try {
        // Try server-side deletion first
        const response = await fetch('/api/delete-section', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sectionId: sectionToDelete.id })
        });
        
        if (response.ok) {
          console.log('✅ Section deleted successfully via server!');
        } else {
          throw new Error('Server-side deletion failed');
        }
      } catch (serverError) {
        console.log('Server-side deletion failed, trying client-side...');
        
        // Fallback to client-side deletion
        try {
          await deleteDoc(sectionRef);
          console.log('✅ Section deleted successfully via client!');
        } catch (clientError) {
          console.error('❌ Both server and client deletion failed');
          console.error('Client error:', clientError.message);
          throw clientError;
        }
      }
      
      // Refresh sections and students
      await fetchSections();
      await fetchStudents();
      
      // Close overlay and reset state
      setIsDeletingSection(false);
      setSectionToDelete(null);
      
      // Show success message
      showSuccess(`Section "${sectionToDelete.name}" and its students archived successfully!`);
      deleteSectionLoading.stop(true);

      // Notify section deleted
      await notifySectionDeleted(teacherEmail, sectionToDelete.name);
      
    } catch (error) {
      console.error('Error deleting section:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Full error:', error);
      showError('Error deleting section: ' + (error?.message || error));
      deleteSectionLoading.error(error);
      setIsDeletingSection(false);
    }
  };

  const cancelDeleteSection = () => {
    setShowDeleteSectionModal(false);
    setSectionToDelete(null);
  };

  const handleSectionClick = (section) => {
    setSelectedSection(section);
    // reset pagination when opening a section
    setCurrentPage(1);
    setShowSectionStudentsModal(true);
  };

  // Function to generate next Student ID
  const generateNextStudentId = () => {
    // Get all existing student IDs
    const existingIds = students.map(student => student.id).filter(id => id && id.startsWith('student'));
    
    if (existingIds.length === 0) {
      return 'Student001';
    }
    
    // Extract numeric parts and find the highest number
    const numericIds = existingIds.map(id => {
      const match = id.match(/student(\d+)/i);
      return match ? parseInt(match[1], 10) : 0;
    });
    
    const maxId = Math.max(...numericIds);
    const nextId = maxId + 1;
    
    // Format with leading zeros (001, 002, etc.)
    return `Student${nextId.toString().padStart(3, '0')}`;
  };

  const handleSectionAddStudent = (section) => {
    setSelectedSection(section);
    const nextStudentId = generateNextStudentId();
    setSectionStudentForm({
      firstName: '', middleName: '', lastName: '', studentId: nextStudentId, password: '', lrn: '', address: '', contact: '',
      gender: '', gradeLevel: 'Grade 6', parentGuardianName: '', dateOfEnrollment: '', currentStatus: 'Regular Student', sectionId: section.id
    });
    setSectionStudentErrors({});
    setShowSectionAddStudentModal(true);
  };

  const handleSectionImportStudents = (section) => {
    setSelectedSection(section);
    setShowSectionImportModal(true);
  };

  const handleSectionImportFile = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!canManageStudents) {
      alert('You do not have permission to import students.');
      return;
    }

    try {
      setShowSectionImportModal(false);
      setIsImporting(true);
      setImportProgress(0);
      setImportStatus('Reading Excel file...');
      setImportedCount(0);

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        alert('No data found in the Excel file.');
        setIsImporting(false);
        return;
      }

      setTotalToImport(jsonData.length);
      setImportStatus('Processing students...');

      let successCount = 0;
      let errorCount = 0;
      let duplicateCount = 0;
      const duplicateErrors = [];

      // Prepare sequential student ID generator (student001, student002, ...)
      const existingSequentialIdsSec = students
        .map(s => s.id)
        .filter(id => typeof id === 'string' && /^student\d+$/i.test(id));
      const existingNumbersSec = existingSequentialIdsSec
        .map(id => {
          const m = id.match(/student(\d+)/i);
          return m ? parseInt(m[1], 10) : 0;
        })
        .filter(n => Number.isFinite(n));
      let nextSequentialSec = existingNumbersSec.length > 0 ? Math.max(...existingNumbersSec) + 1 : 1;
      const getNextStudentSequentialIdSec = () => {
        const id = `student${String(nextSequentialSec).padStart(3, '0')}`;
        nextSequentialSec += 1;
        return id;
      };

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        
        try {
          // Debug: Log the raw row data
          console.log(`🔍 Processing row ${i + 1}:`, row);
          console.log(`📋 Available columns:`, Object.keys(row));
          
          // Try to derive studentId from Username column when present (e.g., Student001)
          const usernameRaw = (row['Username'] || '').toString().trim();
          const usernameMatch = usernameRaw.match(/student\s*0*(\d{1,3})/i);
          const derivedStudentId = usernameMatch ? `student${usernameMatch[1].padStart(3, '0')}` : null;

          const studentData = {
            firstName: row['First name'] || '',
            middleName: row['Middle name'] || '',
            lastName: row['Last name'] || '',
            userName: row['Username'] || '',
            password: row['Password'] || 'defaultPassword123',
            lrn: row['LRN'] ? row['LRN'].toString() : '',
            address: row['Address'] || '',
            contact: row['Contact'] ? row['Contact'].toString() : '',
            gender: row['Gender'] || '',
            gradeLevel: row['Grade Level'] || '',
            parentGuardianName: row['Parent/Guardian Name'] || '',
            dateOfEnrollment: row['Date of Enrollment'] || new Date().toISOString().split('T')[0],
            currentStatus: row['Current Status'] || 'Regular Student',
            sectionId: selectedSection.id,
            createdAt: new Date().toISOString(),
            createdBy: teacherEmail,
            avatar: '/avatar3.png',
            // Prefer Username-based ID if available, otherwise sequential
            studentId: derivedStudentId || getNextStudentSequentialIdSec(),
          };
          
          // Debug: Log the processed student data
          console.log(`✅ Processed student data for row ${i + 1}:`, {
            firstName: studentData.firstName,
            middleName: studentData.middleName,
            lastName: studentData.lastName,
            userName: studentData.userName,
            gender: studentData.gender
          });

          const result = await addStudent({ ...studentData, preferSequential: true });
          
          if (result.success) {
            successCount++;
            setImportedCount(successCount);
            setImportProgress(Math.round((successCount / jsonData.length) * 100));
            setImportStatus(`Imported ${successCount} of ${jsonData.length} students...`);
          } else if (result.type === 'duplicate') {
            duplicateCount++;
            duplicateErrors.push(`Row ${i + 1}: ${result.error}`);
            console.log(`Skipped duplicate student ${i + 1}: ${result.error}`);
          } else {
            errorCount++;
            console.error(`Error importing student ${i + 1}:`, result.error);
          }
          
          // Small delay for visual effect
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Unexpected error importing student ${i + 1}:`, error);
          errorCount++;
        }
      }

      // Show comprehensive import results
      let statusMessage = `Import completed! ${successCount} students imported successfully.`;
      if (duplicateCount > 0) {
        statusMessage += ` ${duplicateCount} duplicates skipped.`;
      }
      if (errorCount > 0) {
        statusMessage += ` ${errorCount} errors occurred.`;
      }
      setImportStatus(statusMessage);
      
      // Refresh students list
      await fetchStudents();
        
      // Show success notification
      await notifyStudentAdded(teacherEmail, `${successCount} students imported to ${selectedSection.name}`, 'Mixed');
      
    } catch (error) {
      console.error('Error importing students:', error);
      setImportStatus('Error importing students. Please try again.');
    } finally {
      setTimeout(() => {
        setIsImporting(false);
        setImportProgress(0);
        setImportStatus('');
        setImportedCount(0);
        setTotalToImport(0);
      }, 2000);
    }
  };

  const handleSectionStudentInputChange = (e) => {
    const { name, value } = e.target;
    
    // Validation for name fields - no integers allowed
    if (name === 'firstName' || name === 'lastName' || name === 'middleName' || name === 'parentGuardianName') {
      // Check if the value contains any numbers
      if (/\d/.test(value)) {
        let fieldLabel = '';
        if (name === 'middleName') fieldLabel = 'Middle Name';
        else if (name === 'firstName') fieldLabel = 'First Name';
        else if (name === 'lastName') fieldLabel = 'Last Name';
        else if (name === 'parentGuardianName') fieldLabel = 'Parent/Guardian Name';
        
        setSectionStudentErrors(prev => ({
          ...prev,
          [name]: `${fieldLabel} cannot contain numbers`
        }));
        return; // Don't update the form if it contains numbers
      }
    }
    
    setSectionStudentForm(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (sectionStudentErrors[name]) {
      setSectionStudentErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateSectionStudentForm = () => {
    const errors = {};
    const requiredFields = [
      { name: 'firstName', label: 'First Name' },
      { name: 'lastName', label: 'Last Name' },
      { name: 'password', label: 'Password' },
      { name: 'lrn', label: 'LRN' },
      { name: 'address', label: 'Address' },
      { name: 'contact', label: 'Contact' },
      { name: 'gender', label: 'Gender' },
      { name: 'gradeLevel', label: 'Grade Level' },
      { name: 'parentGuardianName', label: 'Parent/Guardian Name' },
      { name: 'dateOfEnrollment', label: 'Date of Enrollment' }
    ];

    requiredFields.forEach(field => {
      if (!sectionStudentForm[field.name] || sectionStudentForm[field.name].trim() === '') {
        errors[field.name] = `${field.label} is required`;
      }
    });

    // Additional validations
    
    // Password validation - required field
    if (!sectionStudentForm.password || sectionStudentForm.password.trim() === '') {
      errors.password = 'Password is required';
    } else if (sectionStudentForm.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    // First Name validation - pure string only (no numbers, no special characters)
    if (sectionStudentForm.firstName && !/^[a-zA-Z\s]+$/.test(sectionStudentForm.firstName)) {
      errors.firstName = 'First name must contain only letters and spaces';
    }

    // Last Name validation - pure string only (no numbers, no special characters)
    if (sectionStudentForm.lastName && !/^[a-zA-Z\s]+$/.test(sectionStudentForm.lastName)) {
      errors.lastName = 'Last name must contain only letters and spaces';
    }

    // LRN validation - pure numbers only (no special characters)
    if (sectionStudentForm.lrn && !/^\d+$/.test(sectionStudentForm.lrn)) {
      errors.lrn = 'LRN must contain only numbers';
    }

    // Contact number validation - must be exactly 11 digits
    if (sectionStudentForm.contact && !/^\d{11}$/.test(sectionStudentForm.contact)) {
      errors.contact = 'Contact number must be exactly 11 digits';
    }

    // Parent/Guardian validation - pure string only (no numbers, no special characters)
    if (sectionStudentForm.parentGuardianName && !/^[a-zA-Z\s]+$/.test(sectionStudentForm.parentGuardianName)) {
      errors.parentGuardianName = 'Parent/Guardian name must contain only letters and spaces';
    }

    setSectionStudentErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSectionAddStudentSubmit = async (e) => {
    e.preventDefault();
    
    if (!canManageStudents) {
      alert('You do not have permission to add students.');
      return;
    }
    
    if (!validateSectionStudentForm()) {
      return;
    }
    
    try {
      const studentData = {
        ...sectionStudentForm,
        createdAt: new Date().toISOString(),
        createdBy: teacherEmail,
        avatar: '/avatar3.png'
      };
      
      await addStudent(studentData);
      
      // Refresh students list
      await fetchStudents();
      
      // Reset form and close modal
      setSectionStudentForm({
        firstName: '', middleName: '', lastName: '', studentId: '', password: '', lrn: '', address: '', contact: '',
        gender: '', gradeLevel: '', parentGuardianName: '', dateOfEnrollment: '', currentStatus: 'Regular Student', sectionId: ''
      });
      setSectionStudentErrors({});
      setShowSectionAddStudentModal(false);
      
      // Show success message
      await notifyStudentAdded(teacherEmail, sectionStudentForm.firstName + ' ' + sectionStudentForm.lastName, sectionStudentForm.gender);
      
    } catch (error) {
      console.error('Error adding student:', error);
      alert('Error adding student. Please try again.');
    }
  };

  const handleSectionExportStudents = async (section) => {
    if (!canManageStudents) {
      alert('You do not have permission to export students.');
      return;
    }

    try {
      const studentsInSection = getStudentsInSection(section.id);
      
      if (studentsInSection.length === 0) {
        alert('No students found in this section to export.');
        return;
      }

      const exportData = studentsInSection.map(student => ({
        'First Name': student.firstName,
        'Middle Name': student.middleName,
        'Last Name': student.lastName,
        'Username': student.userName,
        'LRN': student.lrn,
        'Address': student.address,
        'Contact': student.contact,
        'Gender': student.gender,
        'Grade Level': student.gradeLevel,
        'Parent/Guardian Name': student.parentGuardianName,
        'Date of Enrollment': student.dateOfEnrollment,
        'Status': student.currentStatus,
        'Section': section.name
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${section.name} Students`);
      
      const fileName = `${section.name}_Students_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
    } catch (error) {
      console.error('Error exporting students:', error);
      alert('Error exporting students. Please try again.');
    }
  };

  const handleExportStudents = async () => {
    // Check permissions first
    if (!canManageStudents) {
      alert('You do not have permission to export students.');
      return;
    }
    
    try {
      // Prepare data for export
      const exportData = students.map(student => ({
        'First Name': student.firstName || '',
        'Middle Name': student.middleName || '',
        'Last Name': student.lastName || '',
        'Username': student.userName || '',
        'Password': student.password || '',
        'LRN': student.lrn || '',
        'Address': student.address || '',
        'Contact': student.contact || '',
        'Gender': student.gender || '',
        'Grade Level': student.gradeLevel || '',
        'Parent/Guardian Name': student.parentGuardianName || '',
        'Date of Enrollment': student.dateOfEnrollment || '',
        'Current Status': student.currentStatus || ''
      }));
      
      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
      
      // Set column widths for better formatting
      const columnWidths = [
        { wch: 15 }, // First Name
        { wch: 15 }, // Middle Name
        { wch: 15 }, // Last Name
        { wch: 15 }, // Username
        { wch: 15 }, // Password
        { wch: 15 }, // LRN
        { wch: 25 }, // Address
        { wch: 15 }, // Contact
        { wch: 10 }, // Gender
        { wch: 12 }, // Grade Level
        { wch: 20 }, // Parent/Guardian Name
        { wch: 18 }, // Date of Enrollment
        { wch: 15 }  // Current Status
      ];
      worksheet['!cols'] = columnWidths;
      
      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `Students_Export_${currentDate}.xlsx`;
      
      // Export the file
      XLSX.writeFile(workbook, filename);
      
      // Show success message
      setSuccessStudentName(`Exported ${students.length} students successfully!`);
      setShowSuccessMessage(true);
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
      
    } catch (error) {
      console.error('Error exporting students:', error);
      alert('Error exporting students. Please try again.');
    }
  };


  return (
    <div className="student-record-page">
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
            Loading Student Records
          </h3>
          
          <p style={{
            fontSize: 14,
            color: '#6c757d',
            margin: 0,
            textAlign: 'center',
            lineHeight: 1.5,
            maxWidth: 200
          }}>
            Fetching student data and section information...
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
            background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
            borderRadius: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20
          }}>
            <div>
              <h1 style={{ 
                fontSize: 32, 
                fontWeight: 700, 
                color: '#2c3e50',
                margin: '0 0 4px 0',
                letterSpacing: '-0.5px'
              }}>
                Student Record
              </h1>
              <p style={{ 
                fontSize: 16, 
                color: '#6c757d', 
                margin: 0,
                fontWeight: 400,
                lineHeight: 1.4
              }}>
                Manage student information and enrollment records
              </p>
            </div>
            
            {canManageSections && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button
                  onClick={() => setShowSectionModal(true)}
                    style={{
                      background: '#e8f5e8',
                      color: '#2e7d32',
                      border: '1px solid #c8e6c9',
                      borderRadius: 12,
                      padding: '14px 24px',
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#d4edda';
                      e.target.style.borderColor = '#a5d6a7';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#e8f5e8';
                      e.target.style.borderColor = '#c8e6c9';
                    }}
                  >
                  <i className="ri-group-line" style={{ fontSize: '18px', color: '#2e7d32' }}></i>
                  Manage Sections
                  </button>
              </div>
            )}
            </div>

          </div>
          
          <input
            type="file"
            accept=".xlsx,.xls"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleImportStudents}
          />
          
          {/* Section Management */}
          {!canViewStudents ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#6c757d',
              fontSize: 18,
              fontStyle: 'italic'
            }}>
              <i className="ri-lock-line" style={{ fontSize: '64px', marginBottom: '20px', display: 'block', opacity: 0.5 }}></i>
              You do not have permission to view student records.
            </div>
          ) : sections.length > 0 ? (
            <div style={{ marginBottom: 30 }}>
              <div style={{
                fontSize: 20,
                fontWeight: 600,
                color: '#2c3e50',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}>
                <i className="ri-group-line" style={{ fontSize: '24px', color: '#4fa37e' }}></i>
                Sections ({sections.length})
              </div>
              
              <div style={{
                display: 'grid',
                gap: 16,
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))'
              }}>
                {sections.map((section, index) => {
                  const studentsInSection = getStudentsInSection(section.id);
                  const isExpanded = expandedSections.has(section.id);
                  const sectionColor = getSectionColor(index);
                  
                  return (
                    <div key={section.id} style={{
                      background: sectionColor,
                      borderRadius: 18,
                      border: '1px solid rgba(255,255,255,0.3)',
                      overflow: 'hidden',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                    }}>
                      {/* Section Header */}
                      <div 
                  style={{
                    color: '#343a40',
                          padding: '24px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.3s ease',
                          position: 'relative',
                          zIndex: 1
                  }}
                        onClick={(e) => {
                          handleSectionClick(section);
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <h3 style={{ 
                            margin: 0, 
                            fontSize: 20, 
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                          }}>
                            <i className="ri-group-line" style={{ fontSize: '22px' }}></i>
                            {section.name}
                          </h3>
                          {section.description && (
                            <p style={{ 
                              margin: '6px 0 0 0', 
                              fontSize: 14, 
                              opacity: 0.9 
                            }}>
                              {section.description}
                            </p>
                          )}
                          <p style={{ 
                            margin: '8px 0 0 0', 
                            fontSize: 13, 
                            opacity: 0.8,
                            fontWeight: 500
                          }}>
                            {studentsInSection.length} student{studentsInSection.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {canManageSections && (
                <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // reset hover style before opening modal
                                e.currentTarget.style.background = 'rgba(220, 53, 69, 0.2)';
                                handleDeleteSection(section);
                              }}
                  style={{
                                background: 'rgba(220, 53, 69, 0.2)',
                    border: 'none',
                                borderRadius: 8,
                                width: 36,
                                height: 36,
                    display: 'flex',
                    alignItems: 'center',
                                justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                                backdropFilter: 'blur(10px)'
                  }}
                  onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(220, 53, 69, 0.3)';
                                e.currentTarget.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(220, 53, 69, 0.2)';
                                e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                              <i className="ri-archive-line" style={{ fontSize: '18px', color: '#dc3545' }}></i>
                </button>
              )}
              </div>
            </div>

                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#6c757d',
              fontSize: 18,
              fontStyle: 'italic'
            }}>
              <i className="ri-group-line" style={{ fontSize: '64px', marginBottom: '20px', display: 'block', opacity: 0.5 }}></i>
              No sections found. {canManageSections ? 'Create a section to get started.' : 'Contact an administrator to create sections.'}
            </div>
          )}

          {/* Students now only show in sections - no main student list */}
          
          {/* Import Progress Modal */}
          {isImporting && (
            <div style={{
              position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
              background: 'rgba(0,0,0,0.7)', zIndex: 2000,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{
                background: '#fff', 
                borderRadius: 20, 
                padding: 40, 
                minWidth: 500,
                maxWidth: 600,
                textAlign: 'center',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Header with icon */}
                <div style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #4fa37e 0%, #3d8b6f 100%)',
                  margin: '0 auto 24px',
                display: 'flex',
                alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 25px rgba(79, 163, 126, 0.3)'
                }}>
                  <i className="ri-upload-line" style={{ 
                    fontSize: '32px', 
                    color: 'white',
                    animation: 'pulse 2s infinite'
                }}></i>
                </div>
                
                <h2 style={{ 
                  marginBottom: 8, 
                  fontSize: 28, 
                    color: '#2c3e50',
                  fontWeight: 700,
                  letterSpacing: '-0.5px'
                }}>
                  Importing Students
                </h2>
                
                <p style={{ 
                  marginBottom: 32, 
                      fontSize: 16,
                  color: '#6c757d',
                  lineHeight: 1.5
                }}>
                  {importStatus}
                </p>
                
                {/* Progress Bar Container */}
                <div style={{
                  background: '#f8f9fa',
                  borderRadius: 12,
                      padding: 4,
                  marginBottom: 24,
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {/* Progress Bar */}
                  <div style={{
                    background: 'linear-gradient(90deg, #4fa37e 0%, #3d8b6f 100%)',
                    height: 12,
                    borderRadius: 8,
                    width: `${importProgress}%`,
                    transition: 'width 0.3s ease',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {/* Animated shine effect */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: '-100%',
                      width: '100%',
                      height: '100%',
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                      animation: 'shine 2s infinite'
                    }}></div>
            </div>
          </div>
          
                {/* Progress Stats */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 24
                }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ 
                      fontSize: 14, 
                      color: '#6c757d', 
                      marginBottom: 4,
                      fontWeight: 500
                    }}>
                      Progress
            </div>
              <div style={{
                      fontSize: 24, 
                        color: '#2c3e50',
                      fontWeight: 700
                    }}>
                      {importProgress}%
                  </div>
              </div>
                  
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ 
                      fontSize: 14, 
                color: '#6c757d',
                      marginBottom: 4,
                      fontWeight: 500
              }}>
                      Imported
              </div>
                    <div style={{ 
                      fontSize: 24, 
                      color: '#4fa37e', 
                      fontWeight: 700
                    }}>
                      {importedCount} / {totalToImport}
                    </div>
                  </div>
                </div>
                
                {/* Loading Animation */}
                <div style={{
                      display: 'flex', 
                  justifyContent: 'center',
                      alignItems: 'center', 
                  gap: 8,
                  marginTop: 16
                }}>
                    <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#4fa37e',
                    animation: 'bounce 1.4s infinite ease-in-out both'
                    }}></div>
                  <div style={{
                    width: 8,
                    height: 8,
                        borderRadius: '50%', 
                    background: '#4fa37e',
                    animation: 'bounce 1.4s infinite ease-in-out both',
                    animationDelay: '-0.16s'
                  }}></div>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#4fa37e',
                    animation: 'bounce 1.4s infinite ease-in-out both',
                    animationDelay: '-0.32s'
                  }}></div>
                  </div>
              </div>
          </div>
          )}
          
          {showModal && canManageStudents && (
            <div style={{
              position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
              background: 'rgba(0,0,0,0.6)', zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(4px)'
            }}>
              <div style={{ 
                background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                borderRadius: 20, 
                padding: 0, 
                width: '90%',
                maxWidth: 700,
                maxHeight: '90vh',
                position: 'relative',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.2)'
              }}>
                {/* Header Section */}
                <div style={{
                  background: 'linear-gradient(135deg, #4fa37e 0%, #3d8b6f 100%)',
                  padding: '24px 32px',
                  color: 'white',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {/* Decorative elements */}
                  <div style={{
                    position: 'absolute',
                    top: -50,
                    right: -50,
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.1)',
                    zIndex: 1
                  }}></div>
                  <div style={{
                    position: 'absolute',
                    bottom: -30,
                    left: -30,
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.08)',
                    zIndex: 1
                  }}></div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                    <div>
                      <h2 style={{ 
                        margin: 0, 
                        fontSize: 24, 
                        fontWeight: 700, 
                        letterSpacing: '-0.5px',
                        textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}>
                        Register New Student
                      </h2>
                      <p style={{ 
                        margin: '6px 0 0 0', 
                        fontSize: 14, 
                        opacity: 0.9,
                        fontWeight: 400
                      }}>
                        Add student information to the system
                      </p>
                    </div>
                    
                <button
                      style={{ 
                        background: 'rgba(255,255,255,0.2)', 
                        border: 'none', 
                        borderRadius: 12, 
                        width: 48, 
                        height: 48,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        backdropFilter: 'blur(10px)'
                      }}
                  onClick={() => {
                    setShowModal(false);
                    setFieldErrors({});
                    setForm(defaultStudent);
                  }}
                      onMouseEnter={(e) => {
                        e.target.style.background = 'rgba(255,255,255,0.3)';
                        e.target.style.transform = 'scale(1.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'rgba(255,255,255,0.2)';
                        e.target.style.transform = 'scale(1)';
                  }}
                  aria-label="Close"
                >
                      <i className="ri-close-line" style={{ fontSize: '24px', color: 'white' }}></i>
                </button>
                  </div>
                </div>
                
                {/* Form Section */}
                <div style={{ padding: '24px', maxHeight: 'calc(90vh - 120px)', overflowY: 'auto' }}>
                <form onSubmit={handleAddStudent} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      First Name *
                    </label>
                    <input 
                      name="firstName" 
                      value={form.firstName} 
                      onChange={handleInputChange} 
                      placeholder="Enter first name" 
                      style={{ 
                        background: fieldErrors.firstName 
                          ? 'linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)' 
                          : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: fieldErrors.firstName 
                          ? '2px solid #ff4444' 
                          : '2px solid #e9ecef', 
                        borderRadius: 10, 
                        padding: '12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: fieldErrors.firstName 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 2px 8px rgba(0,0,0,0.05)'
                      }}
                      onFocus={(e) => {
                        if (!fieldErrors.firstName) {
                          e.target.style.borderColor = '#4fa37e';
                          e.target.style.boxShadow = '0 4px 12px rgba(79, 163, 126, 0.15)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!fieldErrors.firstName) {
                          e.target.style.borderColor = '#e9ecef';
                          e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                        }
                      }} 
                    />
                    {fieldErrors.firstName && (
                      <div style={{ 
                        color: '#ff4444', 
                        fontSize: 12, 
                        marginTop: 6,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <i className="ri-error-warning-line" style={{ fontSize: '14px' }}></i>
                        {fieldErrors.firstName}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Middle Name
                    </label>
                    <input 
                      name="middleName" 
                      value={form.middleName} 
                      onChange={handleInputChange} 
                      placeholder="Enter middle name" 
                      style={{ 
                        background: fieldErrors.middleName 
                          ? 'linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)' 
                          : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: fieldErrors.middleName 
                          ? '2px solid #ff4444' 
                          : '2px solid #e9ecef', 
                        borderRadius: 10, 
                        padding: '12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: fieldErrors.middleName 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 2px 8px rgba(0,0,0,0.05)'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = fieldErrors.middleName ? '#ff4444' : '#4fa37e';
                        e.target.style.boxShadow = fieldErrors.middleName 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 4px 12px rgba(79, 163, 126, 0.15)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = fieldErrors.middleName ? '#ff4444' : '#e9ecef';
                        e.target.style.boxShadow = fieldErrors.middleName 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 2px 8px rgba(0,0,0,0.05)';
                      }} 
                    />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Last Name *
                    </label>
                    <input 
                      name="lastName" 
                      value={form.lastName} 
                      onChange={handleInputChange} 
                      placeholder="Enter last name" 
                      style={{ 
                        background: fieldErrors.lastName 
                          ? 'linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)' 
                          : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: fieldErrors.lastName 
                          ? '2px solid #ff4444' 
                          : '2px solid #e9ecef', 
                        borderRadius: 10, 
                        padding: '12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: fieldErrors.lastName 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 2px 8px rgba(0,0,0,0.05)'
                      }}
                      onFocus={(e) => {
                        if (!fieldErrors.lastName) {
                          e.target.style.borderColor = '#4fa37e';
                          e.target.style.boxShadow = '0 4px 12px rgba(79, 163, 126, 0.15)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!fieldErrors.lastName) {
                          e.target.style.borderColor = '#e9ecef';
                          e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                        }
                      }} 
                    />
                    {fieldErrors.lastName && (
                      <div style={{ 
                        color: '#ff4444', 
                        fontSize: 12, 
                        marginTop: 6,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <i className="ri-error-warning-line" style={{ fontSize: '14px' }}></i>
                        {fieldErrors.lastName}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Username *
                    </label>
                    <input 
                      name="userName" 
                      value={form.userName} 
                      onChange={handleInputChange} 
                      placeholder="Enter username" 
                      style={{ 
                        background: fieldErrors.userName 
                          ? 'linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)' 
                          : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: fieldErrors.userName 
                          ? '2px solid #ff4444' 
                          : '2px solid #e9ecef', 
                        borderRadius: 10, 
                        padding: '12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: fieldErrors.userName 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 2px 8px rgba(0,0,0,0.05)'
                      }}
                      onFocus={(e) => {
                        if (!fieldErrors.userName) {
                          e.target.style.borderColor = '#4fa37e';
                          e.target.style.boxShadow = '0 4px 12px rgba(79, 163, 126, 0.15)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!fieldErrors.userName) {
                          e.target.style.borderColor = '#e9ecef';
                          e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                        }
                      }} 
                    />
                    {fieldErrors.userName && (
                      <div style={{ 
                        color: '#ff4444', 
                        fontSize: 12, 
                        marginTop: 6,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <i className="ri-error-warning-line" style={{ fontSize: '14px' }}></i>
                        {fieldErrors.userName}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Password *
                    </label>
                     <div style={{ position: 'relative' }}>
                    <input 
                      name="password" 
                      value={form.password} 
                      onChange={handleInputChange} 
                      placeholder="Enter password" 
                         type={showPassword ? "text" : "password"} 
                      style={{ 
                        background: fieldErrors.password 
                          ? 'linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)' 
                          : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: fieldErrors.password 
                          ? '2px solid #ff4444' 
                          : '2px solid #e9ecef', 
                        borderRadius: 10, 
                           padding: '12px 50px 12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: fieldErrors.password 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 2px 8px rgba(0,0,0,0.05)'
                      }}
                      onFocus={(e) => {
                        if (!fieldErrors.password) {
                          e.target.style.borderColor = '#4fa37e';
                          e.target.style.boxShadow = '0 4px 12px rgba(79, 163, 126, 0.15)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!fieldErrors.password) {
                          e.target.style.borderColor = '#e9ecef';
                          e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                        }
                      }} 
                    />
                       <button
                         type="button"
                         onClick={() => setShowPassword(!showPassword)}
                         style={{
                           position: 'absolute',
                           right: 12,
                           top: '50%',
                           transform: 'translateY(-50%)',
                           background: 'transparent',
                           border: 'none',
                           cursor: 'pointer',
                           padding: 4,
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           color: '#6c757d',
                           fontSize: 18,
                           transition: 'color 0.2s ease'
                         }}
                         onMouseEnter={(e) => {
                           e.target.style.color = '#4fa37e';
                         }}
                         onMouseLeave={(e) => {
                           e.target.style.color = '#6c757d';
                         }}
                       >
                         <i className={showPassword ? "ri-eye-off-line" : "ri-eye-line"}></i>
                       </button>
                     </div>
                    {fieldErrors.password && (
                      <div style={{ 
                        color: '#ff4444', 
                        fontSize: 12, 
                        marginTop: 6,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <i className="ri-error-warning-line" style={{ fontSize: '14px' }}></i>
                        {fieldErrors.password}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      LRN *
                    </label>
                    <input 
                      name="lrn" 
                      value={form.lrn} 
                      onChange={handleInputChange} 
                      placeholder="Enter LRN number" 
                      style={{ 
                        background: fieldErrors.lrn 
                          ? 'linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)' 
                          : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: fieldErrors.lrn 
                          ? '2px solid #ff4444' 
                          : '2px solid #e9ecef', 
                        borderRadius: 10, 
                        padding: '12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: fieldErrors.lrn 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 2px 8px rgba(0,0,0,0.05)'
                      }}
                      onFocus={(e) => {
                        if (!fieldErrors.lrn) {
                          e.target.style.borderColor = '#4fa37e';
                          e.target.style.boxShadow = '0 4px 12px rgba(79, 163, 126, 0.15)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!fieldErrors.lrn) {
                          e.target.style.borderColor = '#e9ecef';
                          e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                        }
                      }} 
                    />
                    {fieldErrors.lrn && (
                      <div style={{ 
                        color: '#ff4444', 
                        fontSize: 12, 
                        marginTop: 6,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <i className="ri-error-warning-line" style={{ fontSize: '14px' }}></i>
                        {fieldErrors.lrn}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Address *
                    </label>
                    <input 
                      name="address" 
                      value={form.address} 
                      onChange={handleInputChange} 
                      placeholder="Enter complete address" 
                      style={{ 
                        background: fieldErrors.address 
                          ? 'linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)' 
                          : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: fieldErrors.address 
                          ? '2px solid #ff4444' 
                          : '2px solid #e9ecef', 
                        borderRadius: 10, 
                        padding: '12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: fieldErrors.address 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 2px 8px rgba(0,0,0,0.05)'
                      }}
                      onFocus={(e) => {
                        if (!fieldErrors.address) {
                          e.target.style.borderColor = '#4fa37e';
                          e.target.style.boxShadow = '0 4px 12px rgba(79, 163, 126, 0.15)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!fieldErrors.address) {
                          e.target.style.borderColor = '#e9ecef';
                          e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                        }
                      }} 
                    />
                    {fieldErrors.address && (
                      <div style={{ 
                        color: '#ff4444', 
                        fontSize: 12, 
                        marginTop: 6,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <i className="ri-error-warning-line" style={{ fontSize: '14px' }}></i>
                        {fieldErrors.address}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Contact Number *
                    </label>
                    <input 
                      name="contact" 
                      value={form.contact} 
                      onChange={handleInputChange} 
                      placeholder="Enter contact number" 
                      style={{ 
                        background: fieldErrors.contact 
                          ? 'linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)' 
                          : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: fieldErrors.contact 
                          ? '2px solid #ff4444' 
                          : '2px solid #e9ecef', 
                        borderRadius: 10, 
                        padding: '12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: fieldErrors.contact 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 2px 8px rgba(0,0,0,0.05)'
                      }}
                      onFocus={(e) => {
                        if (!fieldErrors.contact) {
                          e.target.style.borderColor = '#4fa37e';
                          e.target.style.boxShadow = '0 4px 12px rgba(79, 163, 126, 0.15)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!fieldErrors.contact) {
                          e.target.style.borderColor = '#e9ecef';
                          e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                        }
                      }} 
                    />
                    {fieldErrors.contact && (
                      <div style={{ 
                        color: '#ff4444', 
                        fontSize: 12, 
                        marginTop: 6,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <i className="ri-error-warning-line" style={{ fontSize: '14px' }}></i>
                        {fieldErrors.contact}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Gender *
                    </label>
                    <select 
                      name="gender" 
                      value={form.gender} 
                      onChange={handleInputChange} 
                      style={{ 
                        background: fieldErrors.gender 
                          ? 'linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)' 
                          : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: fieldErrors.gender 
                          ? '2px solid #ff4444' 
                          : '2px solid #e9ecef', 
                        borderRadius: 10, 
                        padding: '12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: fieldErrors.gender 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 2px 8px rgba(0,0,0,0.05)',
                        cursor: 'pointer'
                      }}
                      onFocus={(e) => {
                        if (!fieldErrors.gender) {
                          e.target.style.borderColor = '#4fa37e';
                          e.target.style.boxShadow = '0 4px 12px rgba(79, 163, 126, 0.15)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!fieldErrors.gender) {
                          e.target.style.borderColor = '#e9ecef';
                          e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                        }
                      }}
                    >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                    {fieldErrors.gender && (
                      <div style={{ 
                        color: '#ff4444', 
                        fontSize: 12, 
                        marginTop: 6,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <i className="ri-error-warning-line" style={{ fontSize: '14px' }}></i>
                        {fieldErrors.gender}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Grade Level *
                    </label>
                    <input 
                      name="gradeLevel" 
                      value={form.gradeLevel} 
                      onChange={handleInputChange} 
                      placeholder="Enter grade level" 
                      style={{ 
                        background: fieldErrors.gradeLevel 
                          ? 'linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)' 
                          : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: fieldErrors.gradeLevel 
                          ? '2px solid #ff4444' 
                          : '2px solid #e9ecef', 
                        borderRadius: 10, 
                        padding: '12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: fieldErrors.gradeLevel 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 2px 8px rgba(0,0,0,0.05)'
                      }}
                      onFocus={(e) => {
                        if (!fieldErrors.gradeLevel) {
                          e.target.style.borderColor = '#4fa37e';
                          e.target.style.boxShadow = '0 4px 12px rgba(79, 163, 126, 0.15)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!fieldErrors.gradeLevel) {
                          e.target.style.borderColor = '#e9ecef';
                          e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                        }
                      }} 
                    />
                    {fieldErrors.gradeLevel && (
                      <div style={{ 
                        color: '#ff4444', 
                        fontSize: 12, 
                        marginTop: 6,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <i className="ri-error-warning-line" style={{ fontSize: '14px' }}></i>
                        {fieldErrors.gradeLevel}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Parent/Guardian Name *
                    </label>
                    <input 
                      name="parentGuardianName" 
                      value={form.parentGuardianName} 
                      onChange={handleInputChange} 
                      placeholder="Enter parent/guardian name" 
                      style={{ 
                        background: fieldErrors.parentGuardianName 
                          ? 'linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)' 
                          : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: fieldErrors.parentGuardianName 
                          ? '2px solid #ff4444' 
                          : '2px solid #e9ecef', 
                        borderRadius: 10, 
                        padding: '12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: fieldErrors.parentGuardianName 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 2px 8px rgba(0,0,0,0.05)'
                      }}
                      onFocus={(e) => {
                        if (!fieldErrors.parentGuardianName) {
                          e.target.style.borderColor = '#4fa37e';
                          e.target.style.boxShadow = '0 4px 12px rgba(79, 163, 126, 0.15)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!fieldErrors.parentGuardianName) {
                          e.target.style.borderColor = '#e9ecef';
                          e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                        }
                      }} 
                    />
                    {fieldErrors.parentGuardianName && (
                      <div style={{ 
                        color: '#ff4444', 
                        fontSize: 12, 
                        marginTop: 6,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <i className="ri-error-warning-line" style={{ fontSize: '14px' }}></i>
                        {fieldErrors.parentGuardianName}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Date of Enrollment *
                    </label>
                    <input 
                      name="dateOfEnrollment" 
                      value={form.dateOfEnrollment} 
                      onChange={handleInputChange} 
                      placeholder="Select enrollment date" 
                      type="date" 
                      style={{ 
                        background: fieldErrors.dateOfEnrollment 
                          ? 'linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)' 
                          : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: fieldErrors.dateOfEnrollment 
                          ? '2px solid #ff4444' 
                          : '2px solid #e9ecef', 
                        borderRadius: 10, 
                        padding: '12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: fieldErrors.dateOfEnrollment 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 2px 8px rgba(0,0,0,0.05)'
                      }}
                      onFocus={(e) => {
                        if (!fieldErrors.dateOfEnrollment) {
                          e.target.style.borderColor = '#4fa37e';
                          e.target.style.boxShadow = '0 4px 12px rgba(79, 163, 126, 0.15)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!fieldErrors.dateOfEnrollment) {
                          e.target.style.borderColor = '#e9ecef';
                          e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                        }
                      }} 
                    />
                    {fieldErrors.dateOfEnrollment && (
                      <div style={{ 
                        color: '#ff4444', 
                        fontSize: 12, 
                        marginTop: 6,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <i className="ri-error-warning-line" style={{ fontSize: '14px' }}></i>
                        {fieldErrors.dateOfEnrollment}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Student Status
                    </label>
                    <select 
                      name="currentStatus" 
                      value={form.currentStatus} 
                      onChange={handleInputChange} 
                      style={{ 
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: '2px solid #e9ecef', 
                        borderRadius: 10, 
                        padding: '12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        cursor: 'pointer'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#4fa37e';
                        e.target.style.boxShadow = '0 4px 12px rgba(79, 163, 126, 0.15)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e9ecef';
                        e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                      }}
                    >
                    <option value="Regular Student">Regular Student</option>
                  </select>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Section
                    </label>
                    <select 
                      name="sectionId" 
                      value={form.sectionId} 
                      onChange={handleInputChange} 
                      style={{ 
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: '2px solid #e9ecef', 
                        borderRadius: 10, 
                        padding: '12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        cursor: 'pointer'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#4fa37e';
                        e.target.style.boxShadow = '0 4px 12px rgba(79, 163, 126, 0.15)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e9ecef';
                        e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                      }}
                    >
                      <option value="">Select Section (Optional)</option>
                      {sections.map(section => (
                        <option key={section.id} value={section.id}>
                          {section.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Submit Button */}
                  <div style={{ 
                    gridColumn: '1 / span 3', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    marginTop: 20,
                    paddingTop: 16,
                    borderTop: '1px solid #f1f3f4'
                  }}>
                    <button 
                      type="submit" 
                      style={{ 
                        background: 'linear-gradient(135deg, #4fa37e 0%, #3d8b6f 100%)',
                        color: '#fff', 
                        border: 'none', 
                        borderRadius: 12, 
                        padding: '14px 32px', 
                        fontWeight: 700, 
                        fontSize: 16, 
                        cursor: 'pointer',
                        boxShadow: '0 6px 20px rgba(79, 163, 126, 0.3)',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-3px)';
                        e.target.style.boxShadow = '0 12px 35px rgba(79, 163, 126, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 8px 25px rgba(79, 163, 126, 0.3)';
                      }}
                    >
                      <i className="ri-user-add-line" style={{ fontSize: '16px' }}></i>
                      Register Student
                    </button>
                  </div>
                </form>
                </div>
              </div>
            </div>
          )}
          {editModal && editStudent && canManageStudents && (
            <div style={{
              position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.15)', zIndex: 1200,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{ background: '#f1fcf7', borderRadius: 18, padding: 36, minWidth: 600, position: 'relative' }}>
                <div style={{ fontWeight: 600, fontSize: 22, marginBottom: 24 }}>Edit Information</div>
                <form onSubmit={handleEditSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>First Name</label>
                    <input name="firstName" value={editStudent.firstName} onChange={handleEditInputChange} placeholder="First name" style={{ 
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                      border: '1px solid rgba(179, 230, 199, 0.3)', 
                      borderRadius: 12, 
                      padding: 16, 
                      fontSize: 16,
                      fontWeight: 500,
                      color: '#34495e',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                      transition: 'all 0.2s ease'
                    }} required />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Student ID</label>
                    <input 
                      value={editStudent.userName ? editStudent.userName : (editStudent.id ? editStudent.id.replace('student', 'Student') : 'N/A')} 
                      disabled 
                      style={{ 
                        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)', 
                        border: '1px solid rgba(179, 230, 199, 0.3)', 
                        borderRadius: 12, 
                        padding: 16, 
                        fontSize: 16,
                        fontWeight: 500,
                        color: '#6c757d',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                        transition: 'all 0.2s ease',
                        fontFamily: 'monospace',
                        cursor: 'not-allowed'
                      }} 
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Middle Name</label>
                    <input name="middleName" value={editStudent.middleName} onChange={handleEditInputChange} placeholder="Middle name" style={{ 
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                      border: '1px solid rgba(179, 230, 199, 0.3)', 
                      borderRadius: 12, 
                      padding: 16, 
                      fontSize: 16,
                      fontWeight: 500,
                      color: '#34495e',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                      transition: 'all 0.2s ease'
                    }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Last Name</label>
                    <input name="lastName" value={editStudent.lastName} onChange={handleEditInputChange} placeholder="Last name" style={{ 
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                      border: '1px solid rgba(179, 230, 199, 0.3)', 
                      borderRadius: 12, 
                      padding: 16, 
                      fontSize: 16,
                      fontWeight: 500,
                      color: '#34495e',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                      transition: 'all 0.2s ease'
                    }} required />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Password</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        name="password" 
                        value={editStudent.password} 
                        onChange={handleEditInputChange} 
                        placeholder="Password" 
                        type={showPassword ? "text" : "password"} 
                        style={{ 
                          background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                          border: '1px solid rgba(179, 230, 199, 0.3)', 
                          borderRadius: 12, 
                          padding: '16px 50px 16px 16px', 
                          fontSize: 16,
                          fontWeight: 500,
                          color: '#34495e',
                          fontFamily: 'monospace',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                          transition: 'all 0.2s ease',
                          width: '100%',
                          boxSizing: 'border-box'
                        }} 
                        required 
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: 12,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#6c757d',
                          fontSize: 16,
                          transition: 'color 0.2s ease',
                          width: 24,
                          height: 24
                        }}
                        onMouseEnter={(e) => e.target.style.color = '#495057'}
                        onMouseLeave={(e) => e.target.style.color = '#6c757d'}
                      >
                        {showPassword ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>LRN</label>
                    <input name="lrn" value={editStudent.lrn} onChange={handleEditInputChange} placeholder="LRN" style={{ 
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                      border: '1px solid rgba(179, 230, 199, 0.3)', 
                      borderRadius: 12, 
                      padding: 16, 
                      fontSize: 16,
                      fontWeight: 500,
                      color: '#34495e',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                      transition: 'all 0.2s ease'
                    }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Address</label>
                    <input name="address" value={editStudent.address} onChange={handleEditInputChange} placeholder="Address" style={{ 
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                      border: '1px solid rgba(179, 230, 199, 0.3)', 
                      borderRadius: 12, 
                      padding: 16, 
                      fontSize: 16,
                      fontWeight: 500,
                      color: '#34495e',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                      transition: 'all 0.2s ease'
                    }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Contact</label>
                    <input name="contact" value={editStudent.contact} onChange={handleEditInputChange} placeholder="Contact" style={{ 
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                      border: '1px solid rgba(179, 230, 199, 0.3)', 
                      borderRadius: 12, 
                      padding: 16, 
                      fontSize: 16,
                      fontWeight: 500,
                      color: '#34495e',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                      transition: 'all 0.2s ease'
                    }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Gender</label>
                    <select name="gender" value={editStudent.gender} onChange={handleEditInputChange} style={{ 
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                      border: '1px solid rgba(179, 230, 199, 0.3)', 
                      borderRadius: 12, 
                      padding: 16, 
                      fontSize: 16,
                      fontWeight: 500,
                      color: '#34495e',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                      transition: 'all 0.2s ease'
                    }}>
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Grade Level</label>
                    <input name="gradeLevel" value={editStudent.gradeLevel} disabled placeholder="Grade Level" style={{ 
                      background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)', 
                      border: '1px solid rgba(179, 230, 199, 0.3)', 
                      borderRadius: 12, 
                      padding: 16, 
                      fontSize: 16,
                      fontWeight: 500,
                      color: '#6c757d',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                      transition: 'all 0.2s ease',
                      cursor: 'not-allowed'
                    }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Parent/Guardian</label>
                    <input name="parentGuardianName" value={editStudent.parentGuardianName} onChange={handleEditInputChange} placeholder="Parent/Guardian Name" style={{ 
                      background: fieldErrors.parentGuardianName 
                        ? 'linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)' 
                        : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                      border: fieldErrors.parentGuardianName 
                        ? '2px solid #ff4444' 
                        : '1px solid rgba(179, 230, 199, 0.3)', 
                      borderRadius: 12, 
                      padding: 16, 
                      fontSize: 16,
                      fontWeight: 500,
                      color: '#34495e',
                      boxShadow: fieldErrors.parentGuardianName 
                        ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                        : '0 2px 8px rgba(0, 0, 0, 0.08)',
                      transition: 'all 0.2s ease'
                    }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Enrollment Date</label>
                    <input name="dateOfEnrollment" value={editStudent.dateOfEnrollment} onChange={handleEditInputChange} placeholder="Date of Enrollment" type="date" style={{ 
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                      border: '1px solid rgba(179, 230, 199, 0.3)', 
                      borderRadius: 12, 
                      padding: 16, 
                      fontSize: 16,
                      fontWeight: 500,
                      color: '#34495e',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                      transition: 'all 0.2s ease'
                    }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Status</label>
                    <select name="currentStatus" value={editStudent.currentStatus} onChange={handleEditInputChange} style={{ 
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                      border: '1px solid rgba(179, 230, 199, 0.3)', 
                      borderRadius: 12, 
                      padding: 16, 
                      fontSize: 16,
                      fontWeight: 500,
                      color: '#34495e',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                      transition: 'all 0.2s ease'
                    }}>
                    <option value="Regular Student">Regular Student</option>
                  </select>
                  </div>
                  <div style={{ gridColumn: '1 / span 3', display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
                    <button type="button" onClick={() => {
                      console.log('Back button clicked, hasUnsavedChanges:', hasUnsavedChanges); // Debug log
                      if (hasUnsavedChanges) {
                        console.log('Showing edit warning from Back button'); // Debug log
                        setShowEditWarning(true);
                        console.log('showEditWarning set to true from Back button'); // Debug log
                      } else {
                        console.log('Closing edit modal from Back button without warning'); // Debug log
                        setEditModal(false);
                        setEditStudent(null);
                        setHasUnsavedChanges(false);
                        setShowStudentInfo(true);
                      }
                    }} style={{ 
                      background: '#f5f5f5', 
                      color: '#616161', 
                      border: '1px solid #e0e0e0', 
                      borderRadius: 12, 
                      padding: '16px 40px', 
                      fontWeight: 600, 
                      fontSize: 16, 
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#eeeeee';
                      e.target.style.borderColor = '#bdbdbd';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#f5f5f5';
                      e.target.style.borderColor = '#e0e0e0';
                    }}>
                      <i className="ri-arrow-left-line" style={{ fontSize: '16px', color: '#616161' }}></i>
                      Back
                    </button>
                    <button type="submit" style={{ 
                      background: '#e8f5e8', 
                      color: '#2e7d32', 
                      border: '1px solid #c8e6c9', 
                      borderRadius: 12, 
                      padding: '16px 40px', 
                      fontWeight: 600, 
                      fontSize: 16, 
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#d4edda';
                      e.target.style.borderColor = '#a5d6a7';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#e8f5e8';
                      e.target.style.borderColor = '#c8e6c9';
                    }}>
                      <i className="ri-check-line" style={{ fontSize: '16px', color: '#2e7d32' }}></i>
                      Done
                    </button>
                  </div>
                </form>
              </div>
            </div>
                     )}

          {/* Student Information Modal */}
          {showStudentInfo && selectedStudent && (
            <div style={{
              position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.15)', zIndex: 1100,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{ background: '#f1fcf7', borderRadius: 18, padding: 36, minWidth: 600, position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <div style={{ fontWeight: 600, fontSize: 22 }}>Student Information</div>
                  <div style={{ display: 'flex', gap: 12, marginRight: 20 }}>
                    {canManageStudents && (
                      <button
                        style={{ 
                          background: '#e8f5e8', 
                          color: '#2e7d32', 
                          border: '1px solid #c8e6c9', 
                          borderRadius: 12, 
                          padding: '12px 24px', 
                          fontSize: 14, 
                          fontWeight: 600, 
                          cursor: 'pointer',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                          transition: 'all 0.3s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        }}
                        onClick={() => {
                          handleEdit(selectedStudent);
                          // Keep section modal open by not closing it
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = '#d4edda';
                          e.target.style.borderColor = '#a5d6a7';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = '#e8f5e8';
                          e.target.style.borderColor = '#c8e6c9';
                        }}
                        title="Edit Student"
                      >
                        <i className="ri-pencil-line" style={{ fontSize: '16px', color: '#2e7d32' }}></i>
                        Edit
                      </button>
                    )}
                    {canManageStudents && (
                      <button
                        style={{ 
                          background: '#ffebee', 
                          color: '#c62828', 
                          border: '1px solid #ffcdd2', 
                          borderRadius: 12, 
                          padding: '12px 24px', 
                          fontSize: 14, 
                          fontWeight: 600, 
                          cursor: 'pointer',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                          transition: 'all 0.3s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        }}
                        onClick={() => {
                          const studentIndex = students.findIndex(s => s.id === selectedStudent.id);
                          // Open confirm dialog without closing Student Information modal
                          handleDelete(studentIndex);
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = '#ffcdd2';
                          e.target.style.borderColor = '#ef9a9a';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = '#ffebee';
                          e.target.style.borderColor = '#ffcdd2';
                        }}
                        title="Archive Student"
                      >
                        <i className="ri-archive-line" style={{ fontSize: '16px', color: '#c62828' }}></i>
                        Archive
                      </button>
                    )}
                  </div>
                    <button
                      style={{ position: 'absolute', top: 18, right: 18, background: 'none', border: 'none', fontSize: 28, cursor: 'pointer' }}
                      onClick={() => { setShowStudentInfo(false); setSelectedStudent(null); }}
                      aria-label="Close"
                    >
                      &times;
                    </button>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                  <div style={{ 
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                    borderRadius: 12, 
                    padding: 16, 
                    fontSize: 15,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(179, 230, 199, 0.3)',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>First Name</div>
                    <div style={{ 
                      color: '#34495e', 
                      fontSize: 16, 
                      fontWeight: 500,
                      lineHeight: 1.4
                    }}>{selectedStudent.firstName}</div>
                  </div>
                  <div style={{ 
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                    borderRadius: 12, 
                    padding: 16, 
                    fontSize: 15,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(179, 230, 199, 0.3)',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Student ID</div>
                    <div style={{ 
                      color: '#34495e', 
                      fontSize: 16, 
                      fontWeight: 500,
                      lineHeight: 1.4,
                      fontFamily: 'monospace'
                    }}>{selectedStudent.userName ? selectedStudent.userName : (selectedStudent.id ? selectedStudent.id.replace('student', 'Student') : 'N/A')}</div>
                  </div>
                  <div style={{ 
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                    borderRadius: 12, 
                    padding: 16, 
                    fontSize: 15,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(179, 230, 199, 0.3)',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Middle Name</div>
                    <div style={{ 
                      color: '#34495e', 
                      fontSize: 16, 
                      fontWeight: 500,
                      lineHeight: 1.4
                    }}>{selectedStudent.middleName}</div>
                  </div>
                  <div style={{ 
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                    borderRadius: 12, 
                    padding: 16, 
                    fontSize: 15,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(179, 230, 199, 0.3)',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Last Name</div>
                    <div style={{ 
                      color: '#34495e', 
                      fontSize: 16, 
                      fontWeight: 500,
                      lineHeight: 1.4
                    }}>{selectedStudent.lastName}</div>
                  </div>
                  <div style={{ 
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                    borderRadius: 12, 
                    padding: 16, 
                    fontSize: 15,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(179, 230, 199, 0.3)',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Password</div>
                    <div style={{ 
                      color: '#34495e', 
                      fontSize: 16, 
                      fontWeight: 500,
                      lineHeight: 1.4,
                      fontFamily: 'monospace'
                    }}>{'•'.repeat(selectedStudent.password?.length || 0)}</div>
                  </div>
                  <div style={{ 
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                    borderRadius: 12, 
                    padding: 16, 
                    fontSize: 15,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(179, 230, 199, 0.3)',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>LRN</div>
                    <div style={{ 
                      color: '#34495e', 
                      fontSize: 16, 
                      fontWeight: 500,
                      lineHeight: 1.4
                    }}>{selectedStudent.lrn}</div>
                  </div>
                  <div style={{ 
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                    borderRadius: 12, 
                    padding: 16, 
                    fontSize: 15,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(179, 230, 199, 0.3)',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Address</div>
                    <div style={{ 
                      color: '#34495e', 
                      fontSize: 16, 
                      fontWeight: 500,
                      lineHeight: 1.4
                    }}>{selectedStudent.address}</div>
                  </div>
                  <div style={{ 
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                    borderRadius: 12, 
                    padding: 16, 
                    fontSize: 15,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(179, 230, 199, 0.3)',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Contact</div>
                    <div style={{ 
                      color: '#34495e', 
                      fontSize: 16, 
                      fontWeight: 500,
                      lineHeight: 1.4
                    }}>{selectedStudent.contact}</div>
                  </div>
                  <div style={{ 
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                    borderRadius: 12, 
                    padding: 16, 
                    fontSize: 15,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(179, 230, 199, 0.3)',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Gender</div>
                    <div style={{ 
                      color: '#34495e', 
                      fontSize: 16, 
                      fontWeight: 500,
                      lineHeight: 1.4
                    }}>{selectedStudent.gender}</div>
                  </div>
                  <div style={{ 
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                    borderRadius: 12, 
                    padding: 16, 
                    fontSize: 15,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(179, 230, 199, 0.3)',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Grade Level</div>
                    <div style={{ 
                      color: '#34495e', 
                      fontSize: 16, 
                      fontWeight: 500,
                      lineHeight: 1.4
                    }}>{selectedStudent.gradeLevel}</div>
                  </div>
                  <div style={{ 
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                    borderRadius: 12, 
                    padding: 16, 
                    fontSize: 15,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(179, 230, 199, 0.3)',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Parent/Guardian</div>
                    <div style={{ 
                      color: '#34495e', 
                      fontSize: 16, 
                      fontWeight: 500,
                      lineHeight: 1.4
                    }}>{selectedStudent.parentGuardianName}</div>
                  </div>
                  <div style={{ 
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                    borderRadius: 12, 
                    padding: 16, 
                    fontSize: 15,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(179, 230, 199, 0.3)',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Enrollment Date</div>
                    <div style={{ 
                      color: '#34495e', 
                      fontSize: 16, 
                      fontWeight: 500,
                      lineHeight: 1.4
                    }}>{selectedStudent.dateOfEnrollment}</div>
                  </div>
                  <div style={{ 
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                    borderRadius: 12, 
                    padding: 16, 
                    fontSize: 15,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(179, 230, 199, 0.3)',
                    transition: 'all 0.2s ease',
                    gridColumn: '1 / span 3'
                  }}>
                    <div style={{ 
                      fontWeight: 700, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>Status</div>
                    <div style={{ 
                      color: '#34495e', 
                      fontSize: 16, 
                      fontWeight: 500,
                      lineHeight: 1.4
                    }}>{selectedStudent.currentStatus}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
           
           {/* Professional Success Message */}
           {showSuccessMessage && (
             <div style={{
               position: 'fixed',
               top: '20px',
               right: '20px',
               background: '#4fa37e',
               color: 'white',
               padding: '16px 24px',
               borderRadius: '12px',
               boxShadow: '0 4px 20px rgba(79, 163, 126, 0.3)',
               zIndex: 2000,
               display: 'flex',
               alignItems: 'center',
               gap: '12px',
               animation: 'slideInRight 0.3s ease-out',
               maxWidth: '400px'
             }}>
               <div style={{
                 width: '24px',
                 height: '24px',
                 borderRadius: '50%',
                 background: 'rgba(255, 255, 255, 0.2)',
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center'
               }}>
                 <i className="ri-check-line" style={{ fontSize: '16px', color: 'white' }}></i>
               </div>
               <div>
                 <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>
                   {successStudentName.includes('Exported') ? 'Export Successful!' : 'Student Added Successfully!'}
                 </div>
                 <div style={{ fontSize: '14px', opacity: '0.9' }}>
                   {successStudentName.includes('Exported') 
                     ? successStudentName 
                     : `${successStudentName} has been registered to the system.`
                   }
                 </div>
               </div>
               <button
                 onClick={() => setShowSuccessMessage(false)}
                 style={{
                   background: 'none',
                   border: 'none',
                   color: 'white',
                   cursor: 'pointer',
                   fontSize: '18px',
                   opacity: '0.7',
                   marginLeft: 'auto'
                 }}
               >
                 ×
               </button>
             </div>
                       )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && studentToDelete && canManageStudents && (
              <div onClick={cancelDelete} style={{
                position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', zIndex: 3000,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <div onClick={(e) => e.stopPropagation()} style={{ 
                  background: '#f1fcf7', 
                  borderRadius: 18, 
                  padding: 36, 
                  minWidth: 400, 
                  position: 'relative',
                  textAlign: 'center',
                  zIndex: 3001,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.25)'
                }}>
                  <div style={{ 
                    width: '64px', 
                    height: '64px', 
                    borderRadius: '50%', 
                    background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)', 
                    margin: '0 auto 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 15px rgba(198, 40, 40, 0.2)',
                    border: '2px solid #ffcdd2'
                  }}>
                    <i className="ri-archive-line" style={{ fontSize: '32px', color: '#c62828' }}></i>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 22, marginBottom: 16, color: '#333' }}>
                    Archive Student
                  </div>
                  <div style={{ fontSize: 16, marginBottom: 32, color: '#666', lineHeight: 1.5 }}>
                    Are you sure you want to archive <strong>{studentToDelete.firstName} {studentToDelete.lastName}</strong>?<br />
                    The student will be moved to the archive and can be restored later.
                  </div>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                    <button 
                      onClick={cancelDelete}
                      style={{ 
                        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)', 
                        color: '#6c757d', 
                        border: '2px solid #e9ecef', 
                        borderRadius: 12, 
                        padding: '12px 24px', 
                        fontWeight: 600, 
                        fontSize: 16, 
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = 'linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%)';
                        e.target.style.borderColor = '#dee2e6';
                        e.target.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)';
                        e.target.style.borderColor = '#e9ecef';
                        e.target.style.transform = 'translateY(0)';
                      }}
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={confirmDelete}
                      style={{ 
                        background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)', 
                        color: '#c62828', 
                        border: '1px solid #ffcdd2', 
                        borderRadius: 12, 
                        padding: '12px 24px', 
                        fontWeight: 500, 
                        fontSize: 16, 
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(198, 40, 40, 0.15)',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 4px 12px rgba(198, 40, 40, 0.25)';
                        e.target.style.background = 'linear-gradient(135deg, #ffcdd2 0%, #ffb3ba 100%)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 2px 8px rgba(198, 40, 40, 0.15)';
                        e.target.style.background = 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)';
                      }}
                    >
                      <i className="ri-archive-line" style={{ fontSize: '16px', color: '#c62828' }}></i>
                      Archive
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Form Validation Warning Modal */}
            {showFormValidation && (
              <div style={{
                position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.15)', zIndex: 1000,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <div style={{ 
                  background: '#f1fcf7', 
                  borderRadius: 18, 
                  padding: 36, 
                  minWidth: 400, 
                  position: 'relative',
                  textAlign: 'center'
                }}>
                  <div style={{ 
                    width: '64px', 
                    height: '64px', 
                    borderRadius: '50%', 
                    background: '#ffc107', 
                    margin: '0 auto 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <i className="ri-error-warning-line" style={{ fontSize: '32px', color: 'white' }}></i>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 22, marginBottom: 16, color: '#333' }}>
                    Required Fields Missing
                  </div>
                  <div style={{ fontSize: 16, marginBottom: 32, color: '#666', lineHeight: 1.5 }}>
                    Please fill out all required fields before adding a student.<br />
                    Required fields: First Name, Last Name, Username, Password, and LRN.
                  </div>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                    <button 
                      onClick={() => setShowFormValidation(false)}
                      style={{ 
                        background: '#4fa37e', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: 8, 
                        padding: '12px 24px', 
                        fontWeight: 600, 
                        fontSize: 16, 
                        cursor: 'pointer' 
                      }}
                    >
                      OK
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Warning Modal */}
            {showEditWarning && (
              console.log('Rendering warning modal, showEditWarning:', showEditWarning),
              <div style={{
                position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.15)', zIndex: 1300,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <div style={{ 
                  background: '#f1fcf7', 
                  borderRadius: 18, 
                  padding: 36, 
                  minWidth: 400, 
                  position: 'relative',
                  textAlign: 'center'
                }}>
                  <div style={{ 
                    width: '64px', 
                    height: '64px', 
                    borderRadius: '50%', 
                    background: '#ffc107', 
                    margin: '0 auto 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <i className="ri-error-warning-line" style={{ fontSize: '32px', color: 'white' }}></i>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 22, marginBottom: 16, color: '#333' }}>
                    Unsaved Changes
                  </div>
                  <div style={{ fontSize: 16, marginBottom: 32, color: '#666', lineHeight: 1.5 }}>
                    You have unsaved changes. If you go back now, your changes will be lost.<br />
                    Are you sure you want to continue?
                  </div>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                    <button 
                      onClick={() => {
                        setShowEditWarning(false);
                        setEditModal(false);
                        setEditStudent(null);
                        setHasUnsavedChanges(false);
                        setShowStudentInfo(true);
                      }}
                      style={{ 
                        background: '#6c757d', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: 8, 
                        padding: '12px 24px', 
                        fontWeight: 600, 
                        fontSize: 16, 
                        cursor: 'pointer' 
                      }}
                    >
                      Discard Changes
                    </button>
                    <button 
                      onClick={() => setShowEditWarning(false)}
                      style={{ 
                        background: '#4fa37e', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: 8, 
                        padding: '12px 24px', 
                        fontWeight: 600, 
                        fontSize: 16, 
                        cursor: 'pointer' 
                      }}
                    >
                      Continue Editing
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Archive Success Message */}
            {showDeleteSuccess && (
              <div style={{
                position: 'fixed',
                top: '20px',
                right: '20px',
                background: 'linear-gradient(135deg, #4fa37e 0%, #2d5a3d 100%)',
                color: 'white',
                padding: '16px 24px',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(79, 163, 126, 0.3)',
                zIndex: 2000,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                animation: 'slideInRight 0.3s ease-out',
                maxWidth: '400px'
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <i className="ri-archive-line" style={{ fontSize: '16px', color: 'white' }}></i>
                </div>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>
                    Student Archived Successfully!
                  </div>
                  <div style={{ fontSize: '14px', opacity: '0.9' }}>
                    {deletedStudentName} has been moved to the archive.
                  </div>
                </div>
                <button
                  onClick={() => setShowDeleteSuccess(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '18px',
                    opacity: '0.7',
                    marginLeft: 'auto'
                  }}
                >
                  ×
                </button>
              </div>
            )}
        
        <style jsx>{`
          @keyframes slideInRight {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          
          @keyframes pulse {
            0% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.1);
            }
            100% {
              transform: scale(1);
            }
          }
          
          @keyframes shine {
            0% {
              left: -100%;
            }
            100% {
              left: 100%;
            }
          }
          
          @keyframes bounce {
            0%, 80%, 100% {
              transform: scale(0);
            }
            40% {
              transform: scale(1);
            }
          }
          
          @keyframes spin {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
        `}</style>

        {/* Section Creation Modal */}
        {showSectionModal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
            background: 'rgba(0,0,0,0.6)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)'
          }}>
            <div style={{ 
              background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
              borderRadius: 20, 
              padding: 0, 
              width: '90%',
              maxWidth: 500,
              position: 'relative',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              {/* Header Section */}
              <div style={{
                background: 'linear-gradient(135deg, #4fa37e 0%, #3d8b6f 100%)',
                padding: '24px 32px',
                color: 'white',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Decorative elements */}
                <div style={{
                  position: 'absolute',
                  top: -30,
                  right: -30,
                  width: 60,
                  height: 60,
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '50%',
                  zIndex: 1
                }}></div>
                <div style={{
                  position: 'absolute',
                  bottom: -20,
                  left: -20,
                  width: 40,
                  height: 40,
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '50%',
                  zIndex: 1
                }}></div>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                  <div>
                    <h2 style={{ 
                      margin: 0, 
                      fontSize: 24, 
                      fontWeight: 700, 
                      letterSpacing: '-0.5px',
                      textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                      Create New Section
                    </h2>
                    <p style={{ 
                      margin: '6px 0 0 0', 
                      fontSize: 14, 
                      opacity: 0.9,
                      fontWeight: 400
                    }}>
                      Add a new section to organize students
                    </p>
                  </div>
                  
                  <button
                    style={{ 
                      background: 'rgba(255,255,255,0.2)', 
                      border: 'none', 
                      borderRadius: 12, 
                      width: 40, 
                      height: 40, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      backdropFilter: 'blur(10px)'
                    }}
                    onClick={() => {
                      setShowSectionModal(false);
                      setSectionForm({ name: '', description: '' });
                      setSectionErrors({});
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(255,255,255,0.3)';
                      e.target.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'rgba(255,255,255,0.2)';
                      e.target.style.transform = 'scale(1)';
                    }}
                  >
                    <i className="ri-close-line" style={{ fontSize: '24px', color: 'white' }}></i>
                  </button>
                </div>
              </div>
              
              {/* Form Section */}
              <div style={{ padding: '32px' }}>
                <form onSubmit={handleAddSection} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 8, 
                      color: '#2c3e50',
                      fontSize: 14,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Section Name *
                    </label>
                    <input 
                      name="name" 
                      value={sectionForm.name} 
                      onChange={handleSectionInputChange} 
                      placeholder="Enter section name (e.g., Section A)" 
                      style={{ 
                        background: sectionErrors.name 
                          ? 'linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)' 
                          : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: sectionErrors.name 
                          ? '2px solid #ff4444' 
                          : '2px solid #e9ecef', 
                        borderRadius: 12, 
                        padding: '16px 20px', 
                        fontSize: 16,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: sectionErrors.name 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 2px 8px rgba(0,0,0,0.05)'
                      }}
                      onFocus={(e) => {
                        if (!sectionErrors.name) {
                      e.target.style.borderColor = '#4fa37e';
                      e.target.style.boxShadow = '0 4px 12px rgba(79, 163, 126, 0.15)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!sectionErrors.name) {
                          e.target.style.borderColor = '#e9ecef';
                          e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                        }
                      }}
                    />
                    {sectionErrors.name && (
                      <div style={{ 
                        color: '#ff4444', 
                        fontSize: 12, 
                        marginTop: 6,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <i className="ri-error-warning-line" style={{ fontSize: '14px' }}></i>
                        {sectionErrors.name}
                      </div>
                    )}
                  </div>
                  
                  {/* Description removed per design request */}
                  
                  {/* Submit Button */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    marginTop: 20,
                    paddingTop: 16,
                    borderTop: '1px solid #f1f3f4'
                  }}>
                    <button 
                      type="submit" 
                      disabled={sectionCreating}
                      style={{ 
                        background: sectionCreating 
                          ? '#f5f5f5' 
                          : '#e8f5e8',
                        color: sectionCreating 
                          ? '#9e9e9e' 
                          : '#2e7d32', 
                        border: sectionCreating 
                          ? '1px solid #e0e0e0' 
                          : '1px solid #c8e6c9', 
                        borderRadius: 12, 
                        padding: '14px 32px', 
                        fontWeight: 700, 
                        fontSize: 16, 
                        cursor: sectionCreating ? 'not-allowed' : 'pointer',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        opacity: sectionCreating ? 0.7 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!sectionCreating) {
                          e.target.style.background = '#d4edda';
                          e.target.style.borderColor = '#a5d6a7';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!sectionCreating) {
                          e.target.style.background = '#e8f5e8';
                          e.target.style.borderColor = '#c8e6c9';
                        }
                      }}
                    >
                      <i className="ri-group-line" style={{ fontSize: '16px', color: sectionCreating ? '#9e9e9e' : '#2e7d32' }}></i>
                      {sectionCreating ? 'Creating...' : 'Create Section'}
                    </button>
                  </div>
                </form>
              </div>
              
              {/* Professional Loading Screen */}
              {sectionCreating && (
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
                  borderRadius: 24,
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
                    Creating Section
                  </h3>
                  
                  <p style={{
                    fontSize: 13,
                    color: '#6c757d',
                    margin: 0,
                    textAlign: 'center',
                    lineHeight: 1.4,
                    maxWidth: 180
                  }}>
                    Setting up your new section...
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

        {/* Deleting Section Progress Overlay */}
        {isDeletingSection && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.6)', zIndex: 1100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)'
          }}>
            <div style={{
              background: '#fff', borderRadius: 16, width: '92%', maxWidth: 640,
              padding: '36px 32px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
            }}>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{
                  width: 96, height: 96, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #dc3545 0%, #fd7e14 100%)',
                  margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 40
                }}>
                  <i className="ri-archive-line"></i>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#2c3e50' }}>Archiving Section</div>
                <div style={{ marginTop: 6, fontSize: 16, fontWeight: 700, color: '#6b7280', letterSpacing: 1 }}>{sectionToDelete?.name?.toUpperCase?.() || sectionToDelete?.name}</div>
              </div>
              {/* Progress bar (orange gradient) */}
              <div style={{
                background: '#e9ecef', borderRadius: 10, height: 8, overflow: 'hidden', margin: '12px 0 10px 0'
              }}>
                <div style={{
                  height: '100%',
                  background: 'linear-gradient(135deg, #dc3545 0%, #fd7e14 100%)',
                  width: `${deleteTotalCount > 0 ? (deleteCurrentCount / deleteTotalCount) * 100 : 100}%`,
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <div style={{ marginTop: 8, textAlign: 'center', color: '#6b7280', fontWeight: 600 }}>
                {deleteCurrentCount} of {deleteTotalCount} students
              </div>
              {deleteTotalCount > 0 && (
                <div style={{ marginTop: 8, textAlign: 'center', color: '#2c3e50', fontWeight: 700 }}>
                  Deleting: {deleteCurrentStudentName || '...'}
                </div>
              )}
              <div style={{ marginTop: 12, textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>
                Please wait while we process the students...
              </div>
            </div>
          </div>
        )}



        {/* Delete Section Confirmation Modal */}
        {showDeleteSectionModal && sectionToDelete && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
            background: 'rgba(0,0,0,0.6)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)'
          }}>
            <div style={{ 
              background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
              borderRadius: 20, 
              padding: 0, 
              width: '90%',
              maxWidth: 500,
              position: 'relative',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              {/* In-modal loading overlay */}
              {deleteSectionLoading.isLoading && (
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <Spinner size="xl" color="secondary" />
                    <div style={{ marginTop: 12, color: '#555', fontWeight: 600 }}>Deleting section...</div>
                  </div>
                </div>
              )}
              {/* Header Section */}
              <div style={{
                background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
                padding: '24px 32px',
                color: 'white',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Decorative elements */}
                <div style={{
                  position: 'absolute',
                  top: -30,
                  right: -30,
                  width: 60,
                  height: 60,
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '50%',
                  zIndex: 1
                }}></div>
                <div style={{
                  position: 'absolute',
                  bottom: -20,
                  left: -20,
                  width: 40,
                  height: 40,
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '50%',
                  zIndex: 1
                }}></div>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                  <div>
                    <h2 style={{ 
                      margin: 0, 
                      fontSize: 24, 
                      fontWeight: 700, 
                      letterSpacing: '-0.5px',
                      textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12
                    }}>
                      <i className="ri-archive-line" style={{ fontSize: '28px' }}></i>
                      Archive Section
                    </h2>
                    <p style={{ 
                      margin: '6px 0 0 0', 
                      fontSize: 14, 
                      opacity: 0.9,
                      fontWeight: 400
                    }}>
                      The section will be archived for backup purposes
                    </p>
                  </div>
                  
                  <button
                    style={{ 
                      background: 'rgba(255,255,255,0.2)', 
                      border: 'none', 
                      borderRadius: 12, 
                      width: 40, 
                      height: 40, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      backdropFilter: 'blur(10px)'
                    }}
                    onClick={cancelDeleteSection}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(255,255,255,0.3)';
                      e.target.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'rgba(255,255,255,0.2)';
                      e.target.style.transform = 'scale(1)';
                    }}
                  >
                    <i className="ri-close-line" style={{ fontSize: '24px', color: 'white' }}></i>
                  </button>
                </div>
              </div>
              
              {/* Content Section */}
              <div style={{ padding: '32px' }}>
                <div style={{
                  textAlign: 'center',
                  marginBottom: 24
                }}>
                  <div style={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
                    margin: '0 auto 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 25px rgba(220, 53, 69, 0.3)'
                  }}>
                    <i className="ri-archive-line" style={{ fontSize: '40px', color: 'white' }}></i>
                  </div>
                  
                  <h3 style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: '#2c3e50',
                    margin: '0 0 12px 0'
                  }}>
                    Are you sure you want to archive "{sectionToDelete.name}"?
                  </h3>
                  
                  <p style={{
                    fontSize: 16,
                    color: '#6c757d',
                    margin: '0 0 8px 0',
                    lineHeight: 1.5
                  }}>
                    This will archive the section and move all students to the archive.
                  </p>
                  
                  <p style={{
                    fontSize: 14,
                    color: '#dc3545',
                    fontWeight: 600,
                    margin: 0
                  }}>
                    The section will be archived for backup purposes.
                  </p>
                </div>
                
                {/* Action Buttons */}
                <div style={{ 
                  display: 'flex', 
                  gap: 16,
                  justifyContent: 'center'
                }}>
                  <button 
                    onClick={cancelDeleteSection}
                    style={{ 
                      background: '#f5f5f5',
                      color: '#616161', 
                      border: '1px solid #e0e0e0', 
                      borderRadius: 12, 
                      padding: '14px 28px', 
                      fontWeight: 700, 
                      fontSize: 16, 
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      opacity: deleteSectionLoading.isLoading ? 0.6 : 1
                    }}
                    disabled={deleteSectionLoading.isLoading}
                    onMouseEnter={(e) => {
                      if (!deleteSectionLoading.isLoading) {
                        e.target.style.background = '#eeeeee';
                        e.target.style.borderColor = '#bdbdbd';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!deleteSectionLoading.isLoading) {
                        e.target.style.background = '#f5f5f5';
                        e.target.style.borderColor = '#e0e0e0';
                      }
                    }}
                  >
                    <i className="ri-close-line" style={{ fontSize: '16px', color: '#616161' }}></i>
                    Cancel
                  </button>
                  
                  <button 
                    onClick={confirmDeleteSection}
                    style={{ 
                      background: deleteSectionLoading.isLoading ? '#f5f5f5' : '#ffebee',
                      color: deleteSectionLoading.isLoading ? '#9e9e9e' : '#c62828', 
                      border: deleteSectionLoading.isLoading ? '1px solid #e0e0e0' : '1px solid #ffcdd2', 
                      borderRadius: 12, 
                      padding: '14px 28px', 
                      fontWeight: 700, 
                      fontSize: 16, 
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      opacity: deleteSectionLoading.isLoading ? 0.8 : 1
                    }}
                    disabled={deleteSectionLoading.isLoading}
                    onMouseEnter={(e) => {
                      if (!deleteSectionLoading.isLoading) {
                        e.target.style.background = '#ffcdd2';
                        e.target.style.borderColor = '#ef9a9a';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!deleteSectionLoading.isLoading) {
                        e.target.style.background = '#ffebee';
                        e.target.style.borderColor = '#ffcdd2';
                      }
                    }}
                  >
                    {deleteSectionLoading.isLoading ? (
                      <>
                        <Spinner size="sm" color="#9e9e9e" className="mr-2" />
                        Archiving...
                      </>
                    ) : (
                      <>
                        <i className="ri-archive-line" style={{ fontSize: '16px', color: '#c62828' }}></i>
                        Archive Section
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section Students Modal */}
        {showSectionStudentsModal && selectedSection && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
            background: 'rgba(0,0,0,0.6)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)'
          }}>
            <div style={{ 
              background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
              borderRadius: 20, 
              padding: 0, 
              width: '95%',
              maxWidth: 1200,
              maxHeight: '90vh',
              height: '85vh',
              position: 'relative',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.2)',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Header Section */}
              <div style={{
                background: 'linear-gradient(135deg, #4fa37e 0%, #3d8b6f 100%)',
                padding: '24px 32px',
                color: 'white',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Decorative elements */}
                <div style={{
                  position: 'absolute',
                  top: -30,
                  right: -30,
                  width: 60,
                  height: 60,
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '50%',
                  zIndex: 1
                }}></div>
                <div style={{
                  position: 'absolute',
                  bottom: -20,
                  left: -20,
                  width: 40,
                  height: 40,
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '50%',
                  zIndex: 1
                }}></div>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                  <div>
                    <h2 style={{ 
                      margin: 0, 
                      fontSize: 24, 
                      fontWeight: 700, 
                      letterSpacing: '-0.5px',
                      textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12
                    }}>
                      <i className="ri-group-line" style={{ fontSize: '28px' }}></i>
                      {selectedSection.name} - Student List
                    </h2>
                    <p style={{ 
                      margin: '6px 0 0 0', 
                      fontSize: 14, 
                      opacity: 0.9,
                      fontWeight: 400
                    }}>
                      {selectedSection.description || 'View and manage students in this section'}
                    </p>
                    <p style={{ 
                      margin: '8px 0 0 0', 
                      fontSize: 13, 
                      opacity: 0.8,
                      fontWeight: 500
                    }}>
                      {getStudentsInSection(selectedSection.id).length} student{getStudentsInSection(selectedSection.id).length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  
                  <button
                    style={{ 
                      background: 'rgba(255,255,255,0.2)', 
                      border: 'none', 
                      borderRadius: 12, 
                      width: 40, 
                      height: 40, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      backdropFilter: 'blur(10px)'
                    }}
                    onClick={() => {
                      setShowSectionStudentsModal(false);
                      setSelectedSection(null);
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(255,255,255,0.3)';
                      e.target.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'rgba(255,255,255,0.2)';
                      e.target.style.transform = 'scale(1)';
                    }}
                  >
                    <i className="ri-close-line" style={{ fontSize: '24px', color: 'white' }}></i>
                  </button>
                </div>
              </div>
              
              {/* Action Buttons */}
              {canManageStudents && (
                <div style={{
                  padding: '24px',
                  display: 'flex',
                  gap: 16,
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
                  borderBottom: '1px solid #e9ecef'
                }}>
                  <button
                    onClick={() => handleSectionAddStudent(selectedSection)}
                    style={{
                      background: '#e8f5e8',
                      color: '#2e7d32',
                      border: '1px solid #c8e6c9',
                      borderRadius: 12,
                      padding: '14px 28px',
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      minWidth: '140px',
                      justifyContent: 'center'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#d4edda';
                      e.target.style.borderColor = '#a5d6a7';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#e8f5e8';
                      e.target.style.borderColor = '#c8e6c9';
                    }}
                  >
                    <i className="ri-add-line" style={{ fontSize: '18px', color: '#2e7d32' }}></i>
                    Add Student
                  </button>
                  
                  {canImportStudents && (
                    <button
                      onClick={() => handleSectionImportStudents(selectedSection)}
                      style={{
                        background: '#f3e5f5',
                        color: '#7b1fa2',
                        border: '1px solid #e1bee7',
                        borderRadius: 12,
                        padding: '14px 28px',
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        minWidth: '160px',
                        justifyContent: 'center'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = '#e8dae8';
                        e.target.style.borderColor = '#ce93d8';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = '#f3e5f5';
                        e.target.style.borderColor = '#e1bee7';
                      }}
                    >
                      <i className="ri-upload-line" style={{ fontSize: '18px', color: '#7b1fa2' }}></i>
                      Import Students
                    </button>
                  )}

                  <button
                    onClick={() => handleSectionExportStudents(selectedSection)}
                    style={{
                      background: '#e8f5e8',
                      color: '#2e7d32',
                      border: '1px solid #c8e6c9',
                      borderRadius: 12,
                      padding: '14px 28px',
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      minWidth: '160px',
                      justifyContent: 'center'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#d4edda';
                      e.target.style.borderColor = '#a5d6a7';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#e8f5e8';
                      e.target.style.borderColor = '#c8e6c9';
                    }}
                  >
                    <i className="ri-file-excel-line" style={{ fontSize: '18px', color: '#2e7d32' }}></i>
                    Export Students
                  </button>
                </div>
              )}

              {/* Students List Content */}
              <div style={{ 
                padding: '24px',
                flex: 1,
                overflowY: 'auto',
                minHeight: 0
              }}>
                {getStudentsInSection(selectedSection.id).length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    color: '#6c757d',
                    padding: '60px 20px',
                    fontStyle: 'italic',
                    fontSize: 18
                  }}>
                    <i className="ri-user-line" style={{ fontSize: '64px', marginBottom: '20px', display: 'block', opacity: 0.5 }}></i>
                    No students in this section
                  </div>
                ) : (
                  <>
                  <div style={{ 
                    display: 'grid', 
                    gap: 20,
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    alignItems: 'start'
                  }}>
                    {getCurrentPageStudents(getStudentsInSection(selectedSection.id)).map((student, index) => (
                      <div key={student.id} className="student-card" style={{
                        background: 'white',
                        borderRadius: 12,
                        padding: '20px',
                        border: '1px solid #e9ecef',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                      }}
                      >
                        {/* Student Avatar */}
                        <div style={{
                          width: 50,
                          height: 50,
                          borderRadius: '50%',
                          overflow: 'hidden',
                          marginRight: 16,
                          border: '2px solid #e9ecef'
                        }}>
                          <img 
                            src={student.gender === 'Female' ? '/avatar4.png' : '/avatar3.png'} 
                            alt={student.id || 'Student'}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                            onError={(e) => {
                              // Fallback to colored circle with initial if image fails to load
                              e.target.style.display = 'none';
                              e.target.parentElement.style.background = `linear-gradient(135deg, ${rowColors[index % rowColors.length]} 0%, ${rowColors[(index + 1) % rowColors.length]} 100%)`;
                              e.target.parentElement.style.display = 'flex';
                              e.target.parentElement.style.alignItems = 'center';
                              e.target.parentElement.style.justifyContent = 'center';
                              e.target.parentElement.style.fontSize = '24px';
                              e.target.parentElement.style.fontWeight = '700';
                              e.target.parentElement.style.color = '#2c3e50';
                              e.target.parentElement.textContent = student.firstName?.charAt(0)?.toUpperCase() || '?';
                            }}
                          />
                        </div>
                        
                        {/* Student Info */}
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontWeight: 600,
                            color: '#2c3e50',
                            fontSize: 16,
                            marginBottom: 4,
                            fontFamily: 'monospace'
                          }}>
                            {student.userName ? student.userName : (student.id ? student.id.replace('student', 'Student') : 'N/A')}
                          </div>
                          <div style={{
                            fontSize: 12,
                            color: '#6c757d',
                            marginBottom: 4
                          }}>
                            Grade {student.gradeLevel} • {student.currentStatus}
                          </div>
                          <div style={{
                            fontSize: 11,
                            color: '#6c757d'
                          }}>
                            {student.gender} • {student.dateOfEnrollment}
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        }}>
                          <button
                            onClick={() => {
                              setSelectedStudent(student);
                              setShowStudentInfo(true);
                            }}
                            style={{
                              background: '#e8f5e8',
                              color: '#2e7d32',
                              border: '1px solid #c8e6c9',
                              borderRadius: 8,
                              width: 32,
                              height: 32,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              fontSize: 14,
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                              transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.background = '#d4edda';
                              e.target.style.borderColor = '#a5d6a7';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = '#e8f5e8';
                              e.target.style.borderColor = '#c8e6c9';
                            }}
                          >
                            <i className="ri-eye-line" style={{ color: '#2e7d32' }}></i>
                          </button>
                          
                          {canManageStudents && (
                            <button
                              onClick={() => {
                                setStudentToDelete({ ...student, index: index });
                                setShowDeleteConfirm(true);
                              }}
                              style={{
                                background: '#ffebee',
                                color: '#c62828',
                                border: '1px solid #ffcdd2',
                                borderRadius: 8,
                                width: 32,
                                height: 32,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: 14,
                                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                                transition: 'all 0.3s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.background = '#ffcdd2';
                                e.target.style.borderColor = '#ef9a9a';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.background = '#ffebee';
                                e.target.style.borderColor = '#ffcdd2';
                              }}
                            >
                              <i className="ri-archive-line" style={{ color: '#c62828' }}></i>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  </>
                )}
              </div>

              {/* Pagination controls - moved outside scrollable area */}
              {getStudentsInSection(selectedSection.id).length > 0 && getTotalPagesForSection(selectedSection.id) > 1 && (
                <div style={{
                  padding: '20px',
                  borderTop: '1px solid #e9ecef',
                  background: '#f8f9fa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '20px',
                  borderRadius: '0 0 20px 20px',
                  flexShrink: 0,
                  marginTop: 'auto'
                }}>
                  <button
                    onClick={goToPreviousSectionPage}
                    disabled={currentPage === 1}
                    style={{
                      background: currentPage === 1 ? 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' : 'linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%)',
                      color: currentPage === 1 ? '#6c757d' : '#495057',
                      border: '1px solid #e9ecef',
                      borderRadius: 12,
                      padding: '12px 24px',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      fontSize: 14,
                      fontWeight: 500,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (currentPage !== 1) {
                        e.target.style.background = 'linear-gradient(135deg, #dee2e6 0%, #ced4da 100%)';
                        e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                        e.target.style.transform = 'translateY(-1px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (currentPage !== 1) {
                        e.target.style.background = 'linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%)';
                        e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                        e.target.style.transform = 'translateY(0)';
                      }
                    }}
                  >
                    Previous
                  </button>
                  
                  <span style={{ 
                    color: '#2c3e50', 
                    fontWeight: 700, 
                    fontSize: 16,
                    padding: '0 24px'
                  }}>
                    Page {currentPage} of {getTotalPagesForSection(selectedSection.id)}
                  </span>
                  
                  <button
                    onClick={goToNextSectionPage}
                    disabled={currentPage >= getTotalPagesForSection(selectedSection.id)}
                    style={{
                      background: currentPage >= getTotalPagesForSection(selectedSection.id) ? 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)' : 'linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%)',
                      color: currentPage >= getTotalPagesForSection(selectedSection.id) ? '#6c757d' : '#2e7d32',
                      border: '1px solid #e9ecef',
                      borderRadius: 12,
                      padding: '12px 24px',
                      cursor: currentPage >= getTotalPagesForSection(selectedSection.id) ? 'not-allowed' : 'pointer',
                      fontSize: 14,
                      fontWeight: 500,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (currentPage < getTotalPagesForSection(selectedSection.id)) {
                        e.target.style.background = 'linear-gradient(135deg, #c8e6c9 0%, #a5d6a7 100%)';
                        e.target.style.boxShadow = '0 4px 8px rgba(46, 125, 50, 0.2)';
                        e.target.style.transform = 'translateY(-1px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (currentPage < getTotalPagesForSection(selectedSection.id)) {
                        e.target.style.background = 'linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%)';
                        e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                        e.target.style.transform = 'translateY(0)';
                      }
                    }}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section Add Student Modal */}
        {showSectionAddStudentModal && selectedSection && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
            background: 'rgba(0,0,0,0.6)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)'
          }}>
            <div style={{ 
              background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
              borderRadius: 20, 
              padding: 0, 
              width: '90%',
              maxWidth: 800,
              maxHeight: '90vh',
              position: 'relative',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              {/* Header Section */}
              <div style={{
                background: 'linear-gradient(135deg, #4fa37e 0%, #3d8b6f 100%)',
                padding: '24px 32px',
                color: 'white',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Decorative elements */}
                <div style={{
                  position: 'absolute',
                  top: -30,
                  right: -30,
                  width: 60,
                  height: 60,
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '50%',
                  zIndex: 1
                }}></div>
                <div style={{
                  position: 'absolute',
                  bottom: -20,
                  left: -20,
                  width: 40,
                  height: 40,
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '50%',
                  zIndex: 1
                }}></div>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                  <div>
                    <h2 style={{ 
                      margin: 0, 
                      fontSize: 24, 
                      fontWeight: 700, 
                      letterSpacing: '-0.5px',
                      textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12
                    }}>
                      <i className="ri-user-add-line" style={{ fontSize: '28px' }}></i>
                      Add Student to {selectedSection.name}
                    </h2>
                    <p style={{ 
                      margin: '6px 0 0 0', 
                      fontSize: 14, 
                      opacity: 0.9,
                      fontWeight: 400
                    }}>
                      Register a new student in this section
                    </p>
                  </div>
                  
                  <button
                    style={{ 
                      background: 'rgba(255,255,255,0.2)', 
                      border: 'none', 
                      borderRadius: 12, 
                      width: 40, 
                      height: 40, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      backdropFilter: 'blur(10px)'
                    }}
                    onClick={() => {
                      setShowSectionAddStudentModal(false);
                      setSectionStudentForm({
                        firstName: '', middleName: '', lastName: '', studentId: '', password: '', lrn: '', address: '', contact: '',
                        gender: '', gradeLevel: '', parentGuardianName: '', dateOfEnrollment: '', currentStatus: 'Regular Student', sectionId: ''
                      });
                      setSectionStudentErrors({});
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(255,255,255,0.3)';
                      e.target.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'rgba(255,255,255,0.2)';
                      e.target.style.transform = 'scale(1)';
                    }}
                  >
                    <i className="ri-close-line" style={{ fontSize: '24px', color: 'white' }}></i>
                  </button>
                </div>
              </div>
              
              {/* Form Section */}
              <div style={{ padding: '32px', maxHeight: 'calc(90vh - 120px)', overflowY: 'auto' }}>
                <form onSubmit={handleSectionAddStudentSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      First Name *
                    </label>
                    <input 
                      name="firstName" 
                      value={sectionStudentForm.firstName} 
                      onChange={handleSectionStudentInputChange} 
                      placeholder="Enter first name" 
                      style={{ 
                        background: sectionStudentErrors.firstName 
                          ? 'linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)' 
                          : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: sectionStudentErrors.firstName 
                          ? '2px solid #ff4444' 
                          : '2px solid #e9ecef', 
                        borderRadius: 10, 
                        padding: '12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: sectionStudentErrors.firstName 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 2px 8px rgba(0,0,0,0.05)'
                      }}
                      onFocus={(e) => {
                        if (!sectionStudentErrors.firstName) {
                          e.target.style.borderColor = '#4fa37e';
                          e.target.style.boxShadow = '0 4px 12px rgba(79, 163, 126, 0.15)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!sectionStudentErrors.firstName) {
                          e.target.style.borderColor = '#e9ecef';
                          e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                        }
                      }}
                    />
                    {sectionStudentErrors.firstName && (
                      <div style={{ 
                        color: '#ff4444', 
                        fontSize: 12, 
                        marginTop: 6,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <i className="ri-error-warning-line" style={{ fontSize: '14px' }}></i>
                        {sectionStudentErrors.firstName}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Middle Name
                    </label>
                    <input 
                      name="middleName" 
                      value={sectionStudentForm.middleName} 
                      onChange={handleSectionStudentInputChange} 
                      placeholder="Enter middle name" 
                      style={{ 
                        background: sectionStudentErrors.middleName 
                          ? 'linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)' 
                          : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: sectionStudentErrors.middleName 
                          ? '2px solid #ff4444' 
                          : '2px solid #e9ecef', 
                        borderRadius: 10, 
                        padding: '12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: sectionStudentErrors.middleName 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 2px 8px rgba(0,0,0,0.05)'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = sectionStudentErrors.middleName ? '#ff4444' : '#4fa37e';
                        e.target.style.boxShadow = sectionStudentErrors.middleName 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 4px 12px rgba(79, 163, 126, 0.15)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = sectionStudentErrors.middleName ? '#ff4444' : '#e9ecef';
                        e.target.style.boxShadow = sectionStudentErrors.middleName 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 2px 8px rgba(0,0,0,0.05)';
                      }}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Last Name *
                    </label>
                    <input 
                      name="lastName" 
                      value={sectionStudentForm.lastName} 
                      onChange={handleSectionStudentInputChange} 
                      placeholder="Enter last name" 
                      style={{ 
                        background: sectionStudentErrors.lastName 
                          ? 'linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)' 
                          : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: sectionStudentErrors.lastName 
                          ? '2px solid #ff4444' 
                          : '2px solid #e9ecef', 
                        borderRadius: 10, 
                        padding: '12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: sectionStudentErrors.lastName 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 2px 8px rgba(0,0,0,0.05)'
                      }}
                      onFocus={(e) => {
                        if (!sectionStudentErrors.lastName) {
                          e.target.style.borderColor = '#4fa37e';
                          e.target.style.boxShadow = '0 4px 12px rgba(79, 163, 126, 0.15)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!sectionStudentErrors.lastName) {
                          e.target.style.borderColor = '#e9ecef';
                          e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                        }
                      }}
                    />
                    {sectionStudentErrors.lastName && (
                      <div style={{ 
                        color: '#ff4444', 
                        fontSize: 12, 
                        marginTop: 6,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <i className="ri-error-warning-line" style={{ fontSize: '14px' }}></i>
                        {sectionStudentErrors.lastName}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Student ID
                    </label>
                    <input 
                      value={sectionStudentForm.studentId || 'Auto-generated'} 
                      disabled 
                      style={{ 
                        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)', 
                        border: '2px solid #e9ecef', 
                        borderRadius: 10, 
                        padding: '12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#6c757d',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        fontFamily: 'monospace',
                        cursor: 'not-allowed',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                      }}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Password *
                    </label>
                     <div style={{ position: 'relative' }}>
                    <input 
                      name="password" 
                         type={showSectionPassword ? "text" : "password"}
                      value={sectionStudentForm.password} 
                      onChange={handleSectionStudentInputChange} 
                      placeholder="Enter password" 
                      style={{ 
                        background: sectionStudentErrors.password 
                          ? 'linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)' 
                          : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: sectionStudentErrors.password 
                          ? '2px solid #ff4444' 
                          : '2px solid #e9ecef', 
                        borderRadius: 10, 
                           padding: '12px 50px 12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: sectionStudentErrors.password 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 2px 8px rgba(0,0,0,0.05)'
                      }}
                      onFocus={(e) => {
                        if (!sectionStudentErrors.password) {
                          e.target.style.borderColor = '#4fa37e';
                          e.target.style.boxShadow = '0 4px 12px rgba(79, 163, 126, 0.15)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!sectionStudentErrors.password) {
                          e.target.style.borderColor = '#e9ecef';
                          e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                        }
                      }}
                    />
                       <button
                         type="button"
                         onClick={() => setShowSectionPassword(!showSectionPassword)}
                         style={{
                           position: 'absolute',
                           right: 12,
                           top: '50%',
                           transform: 'translateY(-50%)',
                           background: 'transparent',
                           border: 'none',
                           cursor: 'pointer',
                           padding: 4,
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           color: '#6c757d',
                           fontSize: 18,
                           transition: 'color 0.2s ease'
                         }}
                         onMouseEnter={(e) => {
                           e.target.style.color = '#4fa37e';
                         }}
                         onMouseLeave={(e) => {
                           e.target.style.color = '#6c757d';
                         }}
                       >
                         <i className={showSectionPassword ? "ri-eye-off-line" : "ri-eye-line"}></i>
                       </button>
                     </div>
                    {sectionStudentErrors.password && (
                      <div style={{ 
                        color: '#ff4444', 
                        fontSize: 12, 
                        marginTop: 6,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <i className="ri-error-warning-line" style={{ fontSize: '14px' }}></i>
                        {sectionStudentErrors.password}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      LRN *
                    </label>
                    <input 
                      name="lrn" 
                      value={sectionStudentForm.lrn} 
                      onChange={handleSectionStudentInputChange} 
                      placeholder="Enter LRN" 
                      style={{ 
                        background: sectionStudentErrors.lrn 
                          ? 'linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)' 
                          : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: sectionStudentErrors.lrn 
                          ? '2px solid #ff4444' 
                          : '2px solid #e9ecef', 
                        borderRadius: 10, 
                        padding: '12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: sectionStudentErrors.lrn 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 2px 8px rgba(0,0,0,0.05)'
                      }}
                      onFocus={(e) => {
                        if (!sectionStudentErrors.lrn) {
                          e.target.style.borderColor = '#4fa37e';
                          e.target.style.boxShadow = '0 4px 12px rgba(79, 163, 126, 0.15)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!sectionStudentErrors.lrn) {
                          e.target.style.borderColor = '#e9ecef';
                          e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                        }
                      }}
                    />
                    {sectionStudentErrors.lrn && (
                      <div style={{ 
                        color: '#ff4444', 
                        fontSize: 12, 
                        marginTop: 6,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <i className="ri-error-warning-line" style={{ fontSize: '14px' }}></i>
                        {sectionStudentErrors.lrn}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Address *
                    </label>
                    <input 
                      name="address" 
                      value={sectionStudentForm.address} 
                      onChange={handleSectionStudentInputChange} 
                      placeholder="Enter complete address" 
                      style={{ 
                        background: sectionStudentErrors.address 
                          ? 'linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)' 
                          : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: sectionStudentErrors.address 
                          ? '2px solid #ff4444' 
                          : '2px solid #e9ecef', 
                        borderRadius: 10, 
                        padding: '12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: sectionStudentErrors.address 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 2px 8px rgba(0,0,0,0.05)'
                      }}
                      onFocus={(e) => {
                        if (!sectionStudentErrors.address) {
                          e.target.style.borderColor = '#4fa37e';
                          e.target.style.boxShadow = '0 4px 12px rgba(79, 163, 126, 0.15)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!sectionStudentErrors.address) {
                          e.target.style.borderColor = '#e9ecef';
                          e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                        }
                      }}
                    />
                    {sectionStudentErrors.address && (
                      <div style={{ 
                        color: '#ff4444', 
                        fontSize: 12, 
                        marginTop: 6,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <i className="ri-error-warning-line" style={{ fontSize: '14px' }}></i>
                        {sectionStudentErrors.address}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Contact Number *
                    </label>
                    <input 
                      name="contact" 
                      value={sectionStudentForm.contact} 
                      onChange={handleSectionStudentInputChange} 
                      placeholder="Enter contact number" 
                      style={{ 
                        background: sectionStudentErrors.contact 
                          ? 'linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)' 
                          : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: sectionStudentErrors.contact 
                          ? '2px solid #ff4444' 
                          : '2px solid #e9ecef', 
                        borderRadius: 10, 
                        padding: '12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: sectionStudentErrors.contact 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 2px 8px rgba(0,0,0,0.05)'
                      }}
                      onFocus={(e) => {
                        if (!sectionStudentErrors.contact) {
                          e.target.style.borderColor = '#4fa37e';
                          e.target.style.boxShadow = '0 4px 12px rgba(79, 163, 126, 0.15)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!sectionStudentErrors.contact) {
                          e.target.style.borderColor = '#e9ecef';
                          e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                        }
                      }}
                    />
                    {sectionStudentErrors.contact && (
                      <div style={{ 
                        color: '#ff4444', 
                        fontSize: 12, 
                        marginTop: 6,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <i className="ri-error-warning-line" style={{ fontSize: '14px' }}></i>
                        {sectionStudentErrors.contact}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Gender *
                    </label>
                    <select 
                      name="gender" 
                      value={sectionStudentForm.gender} 
                      onChange={handleSectionStudentInputChange} 
                      style={{ 
                        background: sectionStudentErrors.gender 
                          ? 'linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)' 
                          : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: sectionStudentErrors.gender 
                          ? '2px solid #ff4444' 
                          : '2px solid #e9ecef', 
                        borderRadius: 10, 
                        padding: '12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: sectionStudentErrors.gender 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 2px 8px rgba(0,0,0,0.05)',
                        cursor: 'pointer'
                      }}
                      onFocus={(e) => {
                        if (!sectionStudentErrors.gender) {
                          e.target.style.borderColor = '#4fa37e';
                          e.target.style.boxShadow = '0 4px 12px rgba(79, 163, 126, 0.15)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!sectionStudentErrors.gender) {
                          e.target.style.borderColor = '#e9ecef';
                          e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                        }
                      }}
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                    {sectionStudentErrors.gender && (
                      <div style={{ 
                        color: '#ff4444', 
                        fontSize: 12, 
                        marginTop: 6,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <i className="ri-error-warning-line" style={{ fontSize: '14px' }}></i>
                        {sectionStudentErrors.gender}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Grade Level *
                    </label>
                    <input 
                      name="gradeLevel" 
                      value={sectionStudentForm.gradeLevel} 
                      disabled 
                      style={{ 
                        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)', 
                        border: '2px solid #e9ecef', 
                        borderRadius: 10, 
                        padding: '12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#6c757d',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        cursor: 'not-allowed',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                      }}
                    />
                    {sectionStudentErrors.gradeLevel && (
                      <div style={{ 
                        color: '#ff4444', 
                        fontSize: 12, 
                        marginTop: 6,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <i className="ri-error-warning-line" style={{ fontSize: '14px' }}></i>
                        {sectionStudentErrors.gradeLevel}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Parent/Guardian Name *
                    </label>
                    <input 
                      name="parentGuardianName" 
                      value={sectionStudentForm.parentGuardianName} 
                      onChange={handleSectionStudentInputChange} 
                      placeholder="Enter parent/guardian name" 
                      style={{ 
                        background: sectionStudentErrors.parentGuardianName 
                          ? 'linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)' 
                          : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: sectionStudentErrors.parentGuardianName 
                          ? '2px solid #ff4444' 
                          : '2px solid #e9ecef', 
                        borderRadius: 10, 
                        padding: '12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: sectionStudentErrors.parentGuardianName 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 2px 8px rgba(0,0,0,0.05)'
                      }}
                      onFocus={(e) => {
                        if (!sectionStudentErrors.parentGuardianName) {
                          e.target.style.borderColor = '#4fa37e';
                          e.target.style.boxShadow = '0 4px 12px rgba(79, 163, 126, 0.15)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!sectionStudentErrors.parentGuardianName) {
                          e.target.style.borderColor = '#e9ecef';
                          e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                        }
                      }}
                    />
                    {sectionStudentErrors.parentGuardianName && (
                      <div style={{ 
                        color: '#ff4444', 
                        fontSize: 12, 
                        marginTop: 6,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <i className="ri-error-warning-line" style={{ fontSize: '14px' }}></i>
                        {sectionStudentErrors.parentGuardianName}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Date of Enrollment *
                    </label>
                    <input 
                      name="dateOfEnrollment" 
                      value={sectionStudentForm.dateOfEnrollment} 
                      onChange={handleSectionStudentInputChange} 
                      placeholder="Select enrollment date" 
                      type="date" 
                      style={{ 
                        background: sectionStudentErrors.dateOfEnrollment 
                          ? 'linear-gradient(135deg, #ffe6e6 0%, #ffcccc 100%)' 
                          : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: sectionStudentErrors.dateOfEnrollment 
                          ? '2px solid #ff4444' 
                          : '2px solid #e9ecef', 
                        borderRadius: 10, 
                        padding: '12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: sectionStudentErrors.dateOfEnrollment 
                          ? '0 4px 12px rgba(255, 68, 68, 0.15)' 
                          : '0 2px 8px rgba(0,0,0,0.05)'
                      }}
                      onFocus={(e) => {
                        if (!sectionStudentErrors.dateOfEnrollment) {
                          e.target.style.borderColor = '#4fa37e';
                          e.target.style.boxShadow = '0 4px 12px rgba(79, 163, 126, 0.15)';
                        }
                      }}
                      onBlur={(e) => {
                        if (!sectionStudentErrors.dateOfEnrollment) {
                          e.target.style.borderColor = '#e9ecef';
                          e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                        }
                      }}
                    />
                    {sectionStudentErrors.dateOfEnrollment && (
                      <div style={{ 
                        color: '#ff4444', 
                        fontSize: 12, 
                        marginTop: 6,
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <i className="ri-error-warning-line" style={{ fontSize: '14px' }}></i>
                        {sectionStudentErrors.dateOfEnrollment}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ 
                      fontWeight: 600, 
                      marginBottom: 6, 
                      color: '#2c3e50',
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Student Status
                    </label>
                    <select 
                      name="currentStatus" 
                      value={sectionStudentForm.currentStatus} 
                      onChange={handleSectionStudentInputChange} 
                      style={{ 
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
                        border: '2px solid #e9ecef', 
                        borderRadius: 10, 
                        padding: '12px 16px', 
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#2c3e50',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        cursor: 'pointer'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#4fa37e';
                        e.target.style.boxShadow = '0 4px 12px rgba(79, 163, 126, 0.15)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#e9ecef';
                        e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                      }}
                    >
                      <option value="Regular Student">Regular Student</option>
                    </select>
                  </div>
                  
                  {/* Submit Button */}
                  <div style={{ 
                    gridColumn: '1 / span 3', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    marginTop: 20,
                    paddingTop: 16,
                    borderTop: '1px solid #f1f3f4'
                  }}>
                    <button 
                      type="submit" 
                      style={{ 
                        background: '#e8f5e8',
                        color: '#2e7d32', 
                        border: '1px solid #c8e6c9', 
                        borderRadius: 12, 
                        padding: '14px 32px', 
                        fontWeight: 500, 
                        fontSize: 16, 
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(46, 125, 50, 0.15)',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 4px 12px rgba(46, 125, 50, 0.25)';
                        e.target.style.background = '#c8e6c9';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 2px 8px rgba(46, 125, 50, 0.15)';
                        e.target.style.background = '#e8f5e8';
                      }}
                    >
                      <i className="ri-user-add-line" style={{ fontSize: '16px', color: '#2e7d32' }}></i>
                      Add to {selectedSection.name}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Section Import Modal */}
        {showSectionImportModal && selectedSection && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
            background: 'rgba(0,0,0,0.6)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)',
            padding: '20px',
            boxSizing: 'border-box'
          }}>
            <div style={{ 
              background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)', 
              borderRadius: 24, 
              padding: 0, 
              width: '90%',
              maxWidth: 700,
              position: 'relative',
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
              overflow: 'hidden',
              border: '2px solid rgba(255,255,255,0.3)',
              margin: '20px auto',
              backdropFilter: 'blur(20px)'
            }}>
              {/* Header Section */}
              <div style={{
                background: 'linear-gradient(135deg, #6f42c1 0%, #5a32a3 100%)',
                padding: '28px 32px',
                color: 'white',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '24px 24px 0 0'
              }}>
                {/* Decorative elements */}
                <div style={{
                  position: 'absolute',
                  top: -40,
                  right: -40,
                  width: 80,
                  height: 80,
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '50%',
                  zIndex: 1
                }}></div>
                <div style={{
                  position: 'absolute',
                  bottom: -30,
                  left: -30,
                  width: 60,
                  height: 60,
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: '50%',
                  zIndex: 1
                }}></div>
                <div style={{
                  position: 'absolute',
                  top: 20,
                  right: 100,
                  width: 40,
                  height: 40,
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '50%',
                  zIndex: 1
                }}></div>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                  <div>
                    <h2 style={{ 
                      margin: 0, 
                      fontSize: 26, 
                      fontWeight: 700, 
                      letterSpacing: '-0.5px',
                      textShadow: '0 3px 6px rgba(0,0,0,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14
                    }}>
                      <i className="ri-upload-line" style={{ fontSize: '30px' }}></i>
                      Import Students to {selectedSection.name}
                    </h2>
                    <p style={{ 
                      margin: '8px 0 0 0', 
                      fontSize: 15, 
                      opacity: 0.95,
                      fontWeight: 400,
                      textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                    }}>
                      Upload an Excel file to import multiple students
                    </p>
                  </div>
                  
                  <button
                    style={{ 
                      background: 'rgba(255,255,255,0.2)', 
                      border: 'none', 
                      borderRadius: 12, 
                      width: 40, 
                      height: 40, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      backdropFilter: 'blur(10px)'
                    }}
                    onClick={() => {
                      setShowSectionImportModal(false);
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(255,255,255,0.35)';
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'rgba(255,255,255,0.25)';
                      e.target.style.transform = 'scale(1)';
                      e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                    }}
                  >
                    <i className="ri-close-line" style={{ fontSize: '22px', color: 'white' }}></i>
                  </button>
                </div>
              </div>
              
              {/* Content Section */}
              <div style={{ 
                padding: '24px'
              }}>
                <div style={{
                  textAlign: 'center',
                  marginBottom: 24
                }}>
                  <div style={{
                    width: 60,
                    height: 60,
                    background: 'linear-gradient(135deg, #6f42c1 0%, #5a32a3 100%)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                    boxShadow: '0 6px 20px rgba(111, 66, 193, 0.3)'
                  }}>
                    <i className="ri-file-excel-line" style={{ fontSize: '24px', color: 'white' }}></i>
                  </div>
                  
                  <h3 style={{
                    margin: '0 0 6px 0',
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#2c3e50'
                  }}>
                    Upload Excel File
                  </h3>
                  
                  <p style={{
                    margin: '0 0 16px 0',
                    fontSize: 13,
                    color: '#6c757d',
                    lineHeight: 1.4
                  }}>
                    Select an Excel file (.xlsx) containing student data. The file should have columns for First Name, Last Name, Username, LRN, Address, Contact, Gender, Grade Level, Parent/Guardian Name, Date of Enrollment, and Status.
                  </p>
                </div>

                <div style={{
                  border: '3px dashed #6f42c1',
                  borderRadius: 20,
                  padding: '32px',
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #f8f9ff 0%, #f0f2ff 100%)',
                  transition: 'all 0.4s ease',
                  cursor: 'pointer',
                  position: 'relative',
                  boxShadow: '0 8px 25px rgba(111, 66, 193, 0.1)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = '#5a32a3';
                  e.target.style.background = 'linear-gradient(135deg, #f0f2ff 0%, #e8ebff 100%)';
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 12px 35px rgba(111, 66, 193, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = '#6f42c1';
                  e.target.style.background = 'linear-gradient(135deg, #f8f9ff 0%, #f0f2ff 100%)';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 8px 25px rgba(111, 66, 193, 0.1)';
                }}>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleSectionImportFile}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      cursor: 'pointer'
                    }}
                  />
                  
                  <i className="ri-upload-cloud-2-line" style={{ 
                    fontSize: '48px', 
                    color: '#6f42c1',
                    marginBottom: '16px',
                    display: 'block'
                  }}></i>
                  
                  <h4 style={{
                    margin: '0 0 8px 0',
                    fontSize: 18,
                    fontWeight: 600,
                    color: '#2c3e50'
                  }}>
                    Click to Upload
                  </h4>
                  
                  <p style={{
                    margin: '0 0 16px 0',
                    fontSize: 14,
                    color: '#6c757d'
                  }}>
                    or drag and drop your Excel file here
                  </p>
                  
                  <div style={{
                    background: 'linear-gradient(135deg, #6f42c1 0%, #5a32a3 100%)',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'inline-block'
                  }}>
                    Choose File
                  </div>
                </div>

                <div style={{
                  marginTop: 20,
                  padding: '20px',
                  background: 'linear-gradient(135deg, #e8f5e8 0%, #f0f8f0 100%)',
                  borderRadius: 16,
                  border: '2px solid #d4edda',
                  boxShadow: '0 4px 15px rgba(40, 167, 69, 0.1)'
                }}>
                  <h5 style={{
                    margin: '0 0 6px 0',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#155724',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <i className="ri-information-line" style={{ fontSize: '14px' }}></i>
                    File Requirements
                  </h5>
                  <ul style={{
                    margin: 0,
                    paddingLeft: 16,
                    fontSize: 12,
                    color: '#155724',
                    lineHeight: 1.4
                  }}>
                    <li>File format: .xlsx or .xls</li>
                    <li>Required columns: First Name, Last Name, Username, LRN, Address, Contact, Gender, Grade Level, Parent/Guardian Name, Date of Enrollment, Status</li>
                    <li>Students will be automatically assigned to {selectedSection.name}</li>
                    <li>Default password will be set for all imported students</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
        </>
      )}
    </div>
    );
  }
