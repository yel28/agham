'use client';

import React, { useCallback } from 'react';
import { useLoading, LOADING_TYPES, LOADING_STATES } from '../lib/LoadingContext';

// Spinner component
export const Spinner = ({ size = 'md', color = 'primary', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  const colorClasses = {
    primary: 'text-blue-600',
    secondary: 'text-gray-600',
    success: 'text-green-600',
    error: 'text-red-600',
    white: 'text-white'
  };

  return (
    <div className={`animate-spin ${sizeClasses[size]} ${colorClasses[color]} ${className}`}>
      <svg className="w-full h-full" fill="none" viewBox="0 0 24 24">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
};

// Progress bar component
export const ProgressBar = ({ 
  progress = 0, 
  size = 'md', 
  color = 'primary', 
  showPercentage = true,
  animated = true,
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  const colorClasses = {
    primary: 'bg-blue-600',
    secondary: 'bg-gray-600',
    success: 'bg-green-600',
    error: 'bg-red-600'
  };

  return (
    <div className={`w-full ${sizeClasses[size]} bg-gray-200 rounded-full overflow-hidden ${className}`}>
      <div
        className={`${sizeClasses[size]} ${colorClasses[color]} transition-all duration-300 ease-out ${
          animated ? 'animate-pulse' : ''
        }`}
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
      {showPercentage && (
        <div className="text-xs text-gray-600 mt-1 text-center">
          {Math.round(progress)}%
        </div>
      )}
    </div>
  );
};

// Loading overlay component
export const LoadingOverlay = ({ 
  isVisible = false, 
  message = 'Loading...', 
  progress = null,
  type = LOADING_TYPES.DATA,
  className = '' 
}) => {
  if (!isVisible) return null;

  const getIcon = () => {
    switch (type) {
      case LOADING_TYPES.UPLOAD:
        return (
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        );
      case LOADING_TYPES.FIREBASE:
        return (
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full animate-pulse flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      default:
        return <Spinner size="xl" color="primary" />;
    }
  };

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 ${className}`}>
      <div className="bg-white rounded-lg p-8 max-w-sm w-full mx-4 shadow-xl">
        <div className="text-center">
          {getIcon()}
          <h3 className="mt-4 text-lg font-semibold text-gray-900">
            {message}
          </h3>
          {progress !== null && (
            <div className="mt-4">
              <ProgressBar 
                progress={progress} 
                size="md" 
                color="primary" 
                showPercentage={true}
                animated={true}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Loading button component
export const LoadingButton = ({ 
  children, 
  loading = false, 
  loadingText = 'Loading...',
  disabled = false,
  onClick,
  className = '',
  ...props 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`relative inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {loading && (
        <Spinner size="sm" color="white" className="mr-2" />
      )}
      {loading ? loadingText : children}
    </button>
  );
};

// Loading card component
export const LoadingCard = ({ 
  title = 'Loading...', 
  message = 'Please wait while we load your data.',
  progress = null,
  className = '' 
}) => {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      <div className="text-center">
        <Spinner size="lg" color="primary" className="mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {title}
        </h3>
        <p className="text-gray-600 mb-4">
          {message}
        </p>
        {progress !== null && (
          <ProgressBar 
            progress={progress} 
            size="md" 
            color="primary" 
            showPercentage={true}
          />
        )}
      </div>
    </div>
  );
};

// Global loading indicator
export const GlobalLoadingIndicator = () => {
  const { globalLoading, getLoadingMessage } = useLoading();

  if (!globalLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="bg-blue-600 text-white px-4 py-2 text-center text-sm font-medium">
        <div className="flex items-center justify-center">
          <Spinner size="sm" color="white" className="mr-2" />
          {getLoadingMessage()}
        </div>
      </div>
    </div>
  );
};

// Loading hook for easy integration
export const useLoadingState = (key, type = LOADING_TYPES.DATA) => {
  const { 
    startLoading, 
    stopLoading, 
    setLoadingError, 
    setLoadingProgress,
    isLoading, 
    getLoadingState,
    getLoadingMessage 
  } = useLoading();

  const loadingState = getLoadingState(key);
  const isCurrentlyLoading = isLoading(key);
  const message = getLoadingMessage(key);

  const start = useCallback((customMessage) => {
    startLoading(key, type, customMessage);
  }, [key, type, startLoading]);

  const stop = useCallback((success = true) => {
    stopLoading(key, success);
  }, [key, stopLoading]);

  const error = useCallback((error) => {
    setLoadingError(key, error);
  }, [key, setLoadingError]);

  const progress = useCallback((progressValue) => {
    setLoadingProgress(key, progressValue);
  }, [key, setLoadingProgress]);

  return {
    loadingState,
    isLoading: isCurrentlyLoading,
    message,
    start,
    stop,
    error,
    progress,
    LOADING_STATES
  };
};

export default {
  Spinner,
  ProgressBar,
  LoadingOverlay,
  LoadingButton,
  LoadingCard,
  GlobalLoadingIndicator,
  useLoadingState
};
