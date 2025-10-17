'use client';

import React from 'react';
import { useLoading } from '../lib/LoadingContext';
import { Spinner, ProgressBar } from './LoadingComponents';

// ARIA-friendly skeleton loader component
const LoadingSkeleton = ({ type = 'default', className = '' }) => {
  const baseClasses = 'animate-pulse bg-gray-200 rounded';
  
  const skeletonTypes = {
    // Dashboard card skeleton
    card: (
      <div className={`${baseClasses} h-32 w-full ${className}`} role="status" aria-label="Loading dashboard card">
        <div className="flex items-center justify-between p-6 h-full">
          <div className="space-y-2">
            <div className="h-4 bg-gray-300 rounded w-24"></div>
            <div className="h-8 bg-gray-300 rounded w-16"></div>
          </div>
          <div className="h-12 w-12 bg-gray-300 rounded-full"></div>
        </div>
        <span className="sr-only">Loading dashboard card...</span>
      </div>
    ),
    
    // Student list skeleton
    studentList: (
      <div className={`${baseClasses} p-4 ${className}`} role="status" aria-label="Loading student list">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4 p-4 bg-white rounded-lg">
              <div className="h-12 w-12 bg-gray-300 rounded-full"></div>
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                <div className="h-3 bg-gray-300 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
        <span className="sr-only">Loading student list...</span>
      </div>
    ),
    
    // Quiz list skeleton
    quizList: (
      <div className={`${baseClasses} p-6 ${className}`} role="status" aria-label="Loading quiz list">
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-white rounded-lg">
              <div className="space-y-2 flex-1">
                <div className="h-5 bg-gray-300 rounded w-1/3"></div>
                <div className="h-4 bg-gray-300 rounded w-1/2"></div>
              </div>
              <div className="flex space-x-2">
                <div className="h-8 w-8 bg-gray-300 rounded"></div>
                <div className="h-8 w-8 bg-gray-300 rounded"></div>
              </div>
            </div>
          ))}
        </div>
        <span className="sr-only">Loading quiz list...</span>
      </div>
    ),
    
    // Admin list skeleton
    adminList: (
      <div className={`${baseClasses} p-6 ${className}`} role="status" aria-label="Loading admin list">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4 p-4 bg-white rounded-lg">
              <div className="h-12 w-12 bg-gray-300 rounded-full"></div>
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-gray-300 rounded w-1/3"></div>
                <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                <div className="h-3 bg-gray-300 rounded w-1/4"></div>
              </div>
              <div className="flex space-x-2">
                <div className="h-8 w-16 bg-gray-300 rounded"></div>
                <div className="h-8 w-16 bg-gray-300 rounded"></div>
                <div className="h-8 w-16 bg-gray-300 rounded"></div>
              </div>
            </div>
          ))}
        </div>
        <span className="sr-only">Loading admin list...</span>
      </div>
    ),
    
    // Default skeleton
    default: (
      <div className={`${baseClasses} h-32 w-full ${className}`} role="status" aria-label="Loading content">
        <div className="p-6">
          <div className="space-y-3">
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            <div className="h-4 bg-gray-300 rounded w-1/2"></div>
            <div className="h-4 bg-gray-300 rounded w-5/6"></div>
          </div>
        </div>
        <span className="sr-only">Loading content...</span>
      </div>
    )
  };

  return skeletonTypes[type] || skeletonTypes.default;
};

// Page-level loading component
export const PageLoadingSkeleton = ({ pageType = 'default' }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header skeleton */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="h-8 w-8 bg-gray-300 rounded animate-pulse"></div>
              <div className="h-6 w-24 bg-gray-300 rounded animate-pulse"></div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="h-8 w-8 bg-gray-300 rounded-full animate-pulse"></div>
              <div className="h-4 w-32 bg-gray-300 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar skeleton */}
      <div className="flex">
        <div className="w-64 bg-white shadow-sm h-screen">
          <div className="p-6 space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="h-5 w-5 bg-gray-300 rounded animate-pulse"></div>
                <div className="h-4 w-24 bg-gray-300 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Main content skeleton */}
        <div className="flex-1 p-6">
          <div className="space-y-6">
            {/* Page header skeleton */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="h-8 w-48 bg-gray-300 rounded animate-pulse mb-2"></div>
              <div className="h-4 w-96 bg-gray-300 rounded animate-pulse"></div>
            </div>

            {/* Content skeleton based on page type */}
            <LoadingSkeleton type={pageType} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingSkeleton;
