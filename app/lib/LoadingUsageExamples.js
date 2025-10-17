// Loading System Usage Examples
// This file shows how to use the loading system in your Next.js pages

import React, { useState, useEffect } from 'react';
import { useLoading, LOADING_TYPES } from './LoadingContext';
import { 
  LoadingCard, 
  LoadingButton, 
  LoadingOverlay, 
  Spinner, 
  ProgressBar,
  useLoadingState 
} from '../components/LoadingComponents';

// Example 1: Basic Page Loading
export const BasicPageExample = () => {
  const [data, setData] = useState(null);
  const pageLoading = useLoadingState('page-data', LOADING_TYPES.DATA);

  useEffect(() => {
    const fetchData = async () => {
      pageLoading.start('Loading page data...');
      
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000));
        setData({ message: 'Data loaded!' });
        pageLoading.stop(true);
      } catch (error) {
        pageLoading.stop(false);
        console.error('Error loading data:', error);
      }
    };

    fetchData();
  }, []);

  if (pageLoading.isLoading) {
    return (
      <LoadingCard 
        title="Loading..."
        message="Please wait while we load your data."
      />
    );
  }

  return (
    <div>
      <h1>Page Content</h1>
      <p>{data?.message}</p>
    </div>
  );
};

// Example 2: Button with Loading State
export const ButtonLoadingExample = () => {
  const [saving, setSaving] = useState(false);
  const actionLoading = useLoadingState('save-action', LOADING_TYPES.ACTION);

  const handleSave = async () => {
    actionLoading.start('Saving...');
    
    try {
      // Simulate save operation
      await new Promise(resolve => setTimeout(resolve, 1500));
      alert('Saved successfully!');
      actionLoading.stop(true);
    } catch (error) {
      actionLoading.stop(false);
      alert('Error saving data');
    }
  };

  return (
    <div>
      <h2>Save Data</h2>
      <LoadingButton
        loading={actionLoading.isLoading}
        loadingText="Saving..."
        onClick={handleSave}
      >
        Save Data
      </LoadingButton>
    </div>
  );
};

// Example 3: Firebase Operations with Loading
export const FirebaseLoadingExample = () => {
  const { startLoading, stopLoading, setLoadingError } = useLoading();
  const [students, setStudents] = useState([]);

  const addStudent = async (studentData) => {
    const loadingKey = 'add-student';
    
    try {
      startLoading(loadingKey, LOADING_TYPES.FIREBASE, 'Adding student...');
      
      // Your Firebase operation here
      // await addStudentToFirebase(studentData);
      
      // Simulate Firebase operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setStudents(prev => [...prev, studentData]);
      stopLoading(loadingKey, true);
    } catch (error) {
      setLoadingError(loadingKey, error);
      throw error;
    }
  };

  const deleteStudent = async (studentId) => {
    const loadingKey = 'delete-student';
    
    try {
      startLoading(loadingKey, LOADING_TYPES.FIREBASE, 'Deleting student...');
      
      // Your Firebase operation here
      // await deleteStudentFromFirebase(studentId);
      
      // Simulate Firebase operation
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setStudents(prev => prev.filter(s => s.id !== studentId));
      stopLoading(loadingKey, true);
    } catch (error) {
      setLoadingError(loadingKey, error);
      throw error;
    }
  };

  return (
    <div>
      <h2>Students</h2>
      <button onClick={() => addStudent({ id: Date.now(), name: 'New Student' })}>
        Add Student
      </button>
      {students.map(student => (
        <div key={student.id}>
          {student.name}
          <button onClick={() => deleteStudent(student.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
};

// Example 4: Upload with Progress
export const UploadProgressExample = () => {
  const [progress, setProgress] = useState(0);
  const uploadLoading = useLoadingState('file-upload', LOADING_TYPES.UPLOAD);

  const handleUpload = async (file) => {
    uploadLoading.start('Uploading file...');
    
    try {
      // Simulate upload with progress
      for (let i = 0; i <= 100; i += 10) {
        setProgress(i);
        uploadLoading.progress(i);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      uploadLoading.stop(true);
      alert('Upload complete!');
    } catch (error) {
      uploadLoading.stop(false);
      alert('Upload failed');
    }
  };

  return (
    <div>
      <h2>File Upload</h2>
      <input 
        type="file" 
        onChange={(e) => handleUpload(e.target.files[0])}
        disabled={uploadLoading.isLoading}
      />
      
      {uploadLoading.isLoading && (
        <div>
          <p>{uploadLoading.message}</p>
          <ProgressBar progress={progress} showPercentage={true} />
        </div>
      )}
    </div>
  );
};

// Example 5: Multiple Loading States
export const MultipleLoadingExample = () => {
  const dataLoading = useLoadingState('data', LOADING_TYPES.DATA);
  const actionLoading = useLoadingState('action', LOADING_TYPES.ACTION);
  const { isLoading } = useLoading();

  const handleDataLoad = async () => {
    dataLoading.start('Loading data...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    dataLoading.stop(true);
  };

  const handleAction = async () => {
    actionLoading.start('Processing...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    actionLoading.stop(true);
  };

  return (
    <div>
      <h2>Multiple Loading States</h2>
      
      <div>
        <button onClick={handleDataLoad} disabled={dataLoading.isLoading}>
          {dataLoading.isLoading ? 'Loading...' : 'Load Data'}
        </button>
        {dataLoading.isLoading && <Spinner size="sm" />}
      </div>
      
      <div>
        <button onClick={handleAction} disabled={actionLoading.isLoading}>
          {actionLoading.isLoading ? 'Processing...' : 'Process'}
        </button>
        {actionLoading.isLoading && <Spinner size="sm" />}
      </div>
      
      <div>
        <p>Global loading: {isLoading() ? 'Yes' : 'No'}</p>
      </div>
    </div>
  );
};

// Example 6: Custom Loading Overlay
export const CustomOverlayExample = () => {
  const [showOverlay, setShowOverlay] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleLongOperation = async () => {
    setShowOverlay(true);
    
    try {
      // Simulate long operation with progress
      for (let i = 0; i <= 100; i += 5) {
        setProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setShowOverlay(false);
      alert('Operation complete!');
    } catch (error) {
      setShowOverlay(false);
      alert('Operation failed');
    }
  };

  return (
    <div>
      <h2>Custom Loading Overlay</h2>
      <button onClick={handleLongOperation}>
        Start Long Operation
      </button>
      
      <LoadingOverlay
        isVisible={showOverlay}
        message="Processing your request..."
        progress={progress}
        type={LOADING_TYPES.ACTION}
      />
    </div>
  );
};

// Example 7: Integration with Existing Pages
export const PageIntegrationExample = () => {
  const [students, setStudents] = useState([]);
  const pageLoading = useLoadingState('students-page', LOADING_TYPES.PAGE);
  const addLoading = useLoadingState('add-student', LOADING_TYPES.ACTION);

  useEffect(() => {
    const loadStudents = async () => {
      pageLoading.start('Loading students...');
      
      try {
        // Your data loading logic here
        await new Promise(resolve => setTimeout(resolve, 1500));
        setStudents([{ id: 1, name: 'John Doe' }]);
        pageLoading.stop(true);
      } catch (error) {
        pageLoading.stop(false);
        console.error('Error loading students:', error);
      }
    };

    loadStudents();
  }, []);

  const addStudent = async () => {
    addLoading.start('Adding student...');
    
    try {
      // Your add student logic here
      await new Promise(resolve => setTimeout(resolve, 1000));
      setStudents(prev => [...prev, { id: Date.now(), name: 'New Student' }]);
      addLoading.stop(true);
    } catch (error) {
      addLoading.stop(false);
      console.error('Error adding student:', error);
    }
  };

  // Show loading state
  if (pageLoading.isLoading) {
    return (
      <LoadingCard 
        title="Loading Students"
        message="Please wait while we load the student data."
      />
    );
  }

  return (
    <div>
      <h1>Students</h1>
      
      <LoadingButton
        loading={addLoading.isLoading}
        loadingText="Adding..."
        onClick={addStudent}
      >
        Add Student
      </LoadingButton>
      
      <ul>
        {students.map(student => (
          <li key={student.id}>{student.name}</li>
        ))}
      </ul>
    </div>
  );
};

export default {
  BasicPageExample,
  ButtonLoadingExample,
  FirebaseLoadingExample,
  UploadProgressExample,
  MultipleLoadingExample,
  CustomOverlayExample,
  PageIntegrationExample
};
