'use client';

import React, { useState, useEffect } from 'react';

// Toast notification component
export const NotificationToast = ({ 
  message, 
  type = 'success', 
  duration = 3000, 
  onClose 
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose?.(), 300); // Wait for animation to complete
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose?.(), 300);
  };

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
          borderColor: '#28a745',
          icon: '✓'
        };
      case 'error':
        return {
          background: 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)',
          borderColor: '#dc3545',
          icon: '✕'
        };
      case 'warning':
        return {
          background: 'linear-gradient(135deg, #ffc107 0%, #fd7e14 100%)',
          borderColor: '#ffc107',
          icon: '⚠'
        };
      case 'info':
        return {
          background: 'linear-gradient(135deg, #17a2b8 0%, #6f42c1 100%)',
          borderColor: '#17a2b8',
          icon: 'ℹ'
        };
      default:
        return {
          background: 'linear-gradient(135deg, #6c757d 0%, #495057 100%)',
          borderColor: '#6c757d',
          icon: 'ℹ'
        };
    }
  };

  const typeStyles = getTypeStyles();

  return (
    <div
      className={`notification-toast ${isVisible ? 'show' : 'hide'}`}
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 10000,
        minWidth: '300px',
        maxWidth: '400px',
        background: typeStyles.background,
        color: 'white',
        padding: '16px 20px',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        border: `1px solid ${typeStyles.borderColor}`,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
        opacity: isVisible ? 1 : 0,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer'
      }}
      onClick={handleClose}
    >
      <div
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          fontWeight: 'bold',
          flexShrink: 0
        }}
      >
        {typeStyles.icon}
      </div>
      
      <div style={{ flex: 1, fontSize: '14px', lineHeight: '1.4' }}>
        {message}
      </div>
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
        }}
        style={{
          background: 'none',
          border: 'none',
          color: 'white',
          fontSize: '18px',
          cursor: 'pointer',
          padding: '0',
          width: '20px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          transition: 'background 0.2s ease'
        }}
        onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
        onMouseOut={(e) => e.target.style.background = 'none'}
      >
        ×
      </button>
    </div>
  );
};

// Notification context for global notifications
export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = (message, type = 'success', duration = 3000) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, message, type, duration }]);
    return id;
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const showSuccess = (message, duration) => addNotification(message, 'success', duration);
  const showError = (message, duration) => addNotification(message, 'error', duration);
  const showWarning = (message, duration) => addNotification(message, 'warning', duration);
  const showInfo = (message, duration) => addNotification(message, 'info', duration);

  return (
    <NotificationContext.Provider value={{
      addNotification,
      removeNotification,
      showSuccess,
      showError,
      showWarning,
      showInfo
    }}>
      {children}
      {notifications.map(notification => (
        <NotificationToast
          key={notification.id}
          message={notification.message}
          type={notification.type}
          duration={notification.duration}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </NotificationContext.Provider>
  );
};

// Hook to use notifications
export const useNotifications = () => {
  const context = React.useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

// Create context
const NotificationContext = React.createContext();

export default NotificationToast;
