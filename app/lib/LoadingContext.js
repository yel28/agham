'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

// Loading context for global loading state management
const LoadingContext = createContext();

// Loading types
export const LOADING_TYPES = {
  PAGE: 'page',
  DATA: 'data',
  ACTION: 'action',
  UPLOAD: 'upload',
  FIREBASE: 'firebase',
  API: 'api'
};

// Loading states
export const LOADING_STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error'
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

export const LoadingProvider = ({ children }) => {
  const [loadingStates, setLoadingStates] = useState({});
  const [globalLoading, setGlobalLoading] = useState(false);
  const [loadingQueue, setLoadingQueue] = useState([]);

  // Start loading
  const startLoading = useCallback((key, type = LOADING_TYPES.DATA, message = 'Loading...') => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: {
        type,
        message,
        state: LOADING_STATES.LOADING,
        startTime: Date.now()
      }
    }));

    // Add to queue for global loading
    setLoadingQueue(prev => [...prev, key]);
    setGlobalLoading(true);
  }, []);

  // Stop loading
  const stopLoading = useCallback((key, success = true) => {
    setLoadingStates(prev => {
      const newStates = { ...prev };
      if (newStates[key]) {
        newStates[key] = {
          ...newStates[key],
          state: success ? LOADING_STATES.SUCCESS : LOADING_STATES.ERROR,
          endTime: Date.now()
        };
      }
      return newStates;
    });

    // Remove from queue
    setLoadingQueue(prev => {
      const newQueue = prev.filter(item => item !== key);
      if (newQueue.length === 0) {
        setGlobalLoading(false);
      }
      return newQueue;
    });

    // Auto-clear after success/error
    setTimeout(() => {
      setLoadingStates(prev => {
        const newStates = { ...prev };
        delete newStates[key];
        return newStates;
      });
    }, success ? 1000 : 3000);
  }, []);

  // Set loading error
  const setLoadingError = useCallback((key, error) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        state: LOADING_STATES.ERROR,
        error: error.message || error,
        endTime: Date.now()
      }
    }));

    // Remove from queue
    setLoadingQueue(prev => {
      const newQueue = prev.filter(item => item !== key);
      if (newQueue.length === 0) {
        setGlobalLoading(false);
      }
      return newQueue;
    });
  }, []);

  // Get loading state
  const getLoadingState = useCallback((key) => {
    return loadingStates[key] || { state: LOADING_STATES.IDLE };
  }, [loadingStates]);

  // Check if any loading is active
  const isLoading = useCallback((key) => {
    if (key) {
      return loadingStates[key]?.state === LOADING_STATES.LOADING;
    }
    return globalLoading;
  }, [loadingStates, globalLoading]);

  // Get current loading message
  const getLoadingMessage = useCallback((key) => {
    if (key) {
      return loadingStates[key]?.message || 'Loading...';
    }
    
    // Get message from first loading item
    const firstLoading = Object.values(loadingStates).find(
      state => state.state === LOADING_STATES.LOADING
    );
    return firstLoading?.message || 'Loading...';
  }, [loadingStates]);

  // Get loading progress (for uploads, etc.)
  const setLoadingProgress = useCallback((key, progress) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        progress: Math.min(100, Math.max(0, progress))
      }
    }));
  }, []);

  // Clear all loading states
  const clearAllLoading = useCallback(() => {
    setLoadingStates({});
    setGlobalLoading(false);
    setLoadingQueue([]);
  }, []);

  const value = {
    // State
    loadingStates,
    globalLoading,
    loadingQueue,
    
    // Actions
    startLoading,
    stopLoading,
    setLoadingError,
    setLoadingProgress,
    clearAllLoading,
    
    // Getters
    getLoadingState,
    isLoading,
    getLoadingMessage,
    
    // Constants
    LOADING_TYPES,
    LOADING_STATES
  };

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
};
