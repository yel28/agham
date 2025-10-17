'use client';

import React, { useState, useEffect } from 'react';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // Check initial online status
    setIsOnline(navigator.onLine);

    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) {
    return null; // Don't show offline page when online
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
      <div className="text-center p-8 max-w-md mx-auto">
        {/* Offline Icon */}
        <div className="mb-6">
          <div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
            <svg 
              className="w-12 h-12 text-gray-400" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2.25a9.75 9.75 0 100 19.5 9.75 9.75 0 000-19.5z" 
              />
            </svg>
          </div>
        </div>

        {/* Offline Message */}
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          You're Offline
        </h1>
        
        <p className="text-gray-600 mb-6 leading-relaxed">
          Don't worry! You can still access your previously visited pages and continue working. 
          Your changes will be saved when you're back online.
        </p>

        {/* Features Available Offline */}
        <div className="bg-green-50 rounded-lg p-4 mb-6 text-left">
          <h3 className="font-semibold text-green-800 mb-2">Available Offline:</h3>
          <ul className="text-sm text-green-700 space-y-1">
            <li>• View student records</li>
            <li>• Browse quizzes</li>
            <li>• Check assessments</li>
            <li>• Access dashboard</li>
          </ul>
        </div>

        {/* Retry Button */}
        <button
          onClick={() => window.location.reload()}
          className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
        >
          Try Again
        </button>

        {/* Connection Status */}
        <div className="mt-6 text-sm text-gray-500">
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span>No internet connection</span>
          </div>
        </div>
      </div>
    </div>
  );
}
