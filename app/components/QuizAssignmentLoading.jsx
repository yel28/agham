'use client';

import React from 'react';

const QuizAssignmentLoading = ({ isVisible = false, quizTitle = '', isCompleted = false, onClose = () => {} }) => {
  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.6)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: 'white',
        borderRadius: 24,
        padding: '48px 40px',
        width: '90%',
        maxWidth: 500,
        maxHeight: '90vh',
        boxShadow: '0 25px 80px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.1)',
        border: '1px solid rgba(79,163,126,0.2)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center'
      }}>
        {/* Close button */}
        <button
          onClick={isCompleted ? onClose : () => {}} // Enabled when completed
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            background: isCompleted ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.1)',
            border: 'none',
            borderRadius: 12,
            width: 36,
            height: 36,
            color: '#666',
            cursor: isCompleted ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            opacity: isCompleted ? 1 : 0.5
          }}
          disabled={!isCompleted}
        >
          ×
        </button>

        {!isCompleted ? (
          <>
            {/* Loading Spinner */}
            <div style={{
              width: 80,
              height: 80,
              border: '4px solid #e9ecef',
              borderTop: '4px solid #4fa37e',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: 32
            }} />

            {/* Main Text */}
            <h2 style={{
              margin: '0 0 12px 0',
              fontSize: 28,
              fontWeight: 700,
              color: '#2c3e50',
              letterSpacing: '-0.5px'
            }}>
              Assigning Quiz
            </h2>

            {/* Sub Text */}
            <p style={{
              margin: '0 0 32px 0',
              fontSize: 16,
              color: '#6c757d',
              lineHeight: 1.5,
              maxWidth: 300
            }}>
              Setting up your quiz assignment...
            </p>

            {/* Progress Dots */}
            <div style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center'
            }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#4fa37e',
                animation: 'pulse 1.5s ease-in-out infinite'
              }} />
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#4fa37e',
                animation: 'pulse 1.5s ease-in-out infinite 0.3s'
              }} />
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#4fa37e',
                animation: 'pulse 1.5s ease-in-out infinite 0.6s'
              }} />
            </div>
          </>
        ) : (
          <>
            {/* Success Icon */}
            <div style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 32,
              boxShadow: '0 8px 32px rgba(40, 167, 69, 0.3)'
            }}>
              <i className="ri-check-line" style={{ fontSize: 40, color: 'white', fontWeight: 'bold' }}></i>
            </div>

            {/* Success Text */}
            <h2 style={{
              margin: '0 0 12px 0',
              fontSize: 28,
              fontWeight: 700,
              color: '#2c3e50',
              letterSpacing: '-0.5px'
            }}>
              Quiz Assigned Successfully!
            </h2>

            {/* Success Sub Text */}
            <p style={{
              margin: '0 0 32px 0',
              fontSize: 16,
              color: '#6c757d',
              lineHeight: 1.5,
              maxWidth: 300
            }}>
              Your quiz has been successfully assigned to all selected students.
            </p>

            {/* Close Button */}
            <button
              onClick={onClose}
              style={{
                background: 'linear-gradient(135deg, #4fa37e 0%, #3d8b6f 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 14,
                padding: '14px 28px',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 16px rgba(79, 163, 126, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(79, 163, 126, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 16px rgba(79, 163, 126, 0.3)';
              }}
            >
              Done
            </button>
          </>
        )}

        {/* CSS Animations */}
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          @keyframes pulse {
            0%, 100% {
              opacity: 0.3;
              transform: scale(0.8);
            }
            50% {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default QuizAssignmentLoading;
