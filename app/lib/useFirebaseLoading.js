'use client';

import { useCallback, useEffect } from 'react';
import { useLoading, LOADING_TYPES } from './LoadingContext';

// Hook to automatically handle Firebase loading states
export const useFirebaseLoading = () => {
  const { startLoading, stopLoading, setLoadingError } = useLoading();

  // Wrap Firebase operations with loading states
  const withLoading = useCallback((operation, key, message = 'Loading...') => {
    return async (...args) => {
      try {
        startLoading(key, LOADING_TYPES.FIREBASE, message);
        const result = await operation(...args);
        stopLoading(key, true);
        return result;
      } catch (error) {
        setLoadingError(key, error);
        throw error;
      }
    };
  }, [startLoading, stopLoading, setLoadingError]);

  // Batch operations with progress tracking
  const withBatchLoading = useCallback((operations, key, message = 'Processing...') => {
    return async () => {
      try {
        startLoading(key, LOADING_TYPES.FIREBASE, message);
        const results = [];
        
        for (let i = 0; i < operations.length; i++) {
          const operation = operations[i];
          const result = await operation();
          results.push(result);
          
          // Update progress
          const progress = ((i + 1) / operations.length) * 100;
          // You can add progress tracking here if needed
        }
        
        stopLoading(key, true);
        return results;
      } catch (error) {
        setLoadingError(key, error);
        throw error;
      }
    };
  }, [startLoading, stopLoading, setLoadingError]);

  return {
    withLoading,
    withBatchLoading
  };
};

// Hook for specific Firebase operations
export const useFirebaseOperations = () => {
  const { withLoading, withBatchLoading } = useFirebaseLoading();

  // Common Firebase operations with loading
  const firebaseOperations = {
    // Student operations
    addStudentWithLoading: (addStudent) => 
      withLoading(addStudent, 'add-student', 'Adding student...'),
    
    updateStudentWithLoading: (updateStudent) => 
      withLoading(updateStudent, 'update-student', 'Updating student...'),
    
    deleteStudentWithLoading: (deleteStudent) => 
      withLoading(deleteStudent, 'delete-student', 'Deleting student...'),
    
    // Section operations
    addSectionWithLoading: (addSection) => 
      withLoading(addSection, 'add-section', 'Creating section...'),
    
    updateSectionWithLoading: (updateSection) => 
      withLoading(updateSection, 'update-section', 'Updating section...'),
    
    deleteSectionWithLoading: (deleteSection) => 
      withLoading(deleteSection, 'delete-section', 'Deleting section...'),
    
    // Quiz operations
    addQuizWithLoading: (addQuiz) => 
      withLoading(addQuiz, 'add-quiz', 'Creating quiz...'),
    
    updateQuizWithLoading: (updateQuiz) => 
      withLoading(updateQuiz, 'update-quiz', 'Updating quiz...'),
    
    deleteQuizWithLoading: (deleteQuiz) => 
      withLoading(deleteQuiz, 'delete-quiz', 'Deleting quiz...'),
    
    // Admin operations
    addAdminWithLoading: (addAdmin) => 
      withLoading(addAdmin, 'add-admin', 'Adding admin...'),
    
    updateAdminWithLoading: (updateAdmin) => 
      withLoading(updateAdmin, 'update-admin', 'Updating admin...'),
    
    deleteAdminWithLoading: (deleteAdmin) => 
      withLoading(deleteAdmin, 'delete-admin', 'Deleting admin...'),
    
    // Import/Export operations
    importStudentsWithLoading: (importStudents) => 
      withLoading(importStudents, 'import-students', 'Importing students...'),
    
    exportStudentsWithLoading: (exportStudents) => 
      withLoading(exportStudents, 'export-students', 'Exporting students...'),
    
    // Archive operations
    restoreStudentWithLoading: (restoreStudent) => 
      withLoading(restoreStudent, 'restore-student', 'Restoring student...'),
    
    permanentlyDeleteStudentWithLoading: (permanentlyDeleteStudent) => 
      withLoading(permanentlyDeleteStudent, 'permanently-delete-student', 'Permanently deleting student...'),
    
    // Bulk operations
    bulkRestoreWithLoading: (bulkRestore) => 
      withLoading(bulkRestore, 'bulk-restore', 'Restoring items...'),
    
    bulkDeleteWithLoading: (bulkDelete) => 
      withLoading(bulkDelete, 'bulk-delete', 'Deleting items...')
  };

  return firebaseOperations;
};

export default useFirebaseLoading;
