'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db, collection, onSnapshot, doc, updateDoc, notificationsCollection } from '../lib/firebase';
import { deleteNotification, deleteAllNotifications, deleteSelectedNotifications } from '../lib/notificationUtils';

export default function Header({ teacherEmail, onMenuClick }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedNotifications, setSelectedNotifications] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);

  useEffect(() => {
    if (!teacherEmail) return;

    const unsubscribe = onSnapshot(notificationsCollection(), (snapshot) => {
      const notificationData = [];
      let unread = 0;
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.teacherEmail === teacherEmail) {
          notificationData.push({
            id: doc.id,
            ...data
          });
          if (!data.isRead) unread++;
        }
      });
      
      // Sort by timestamp (newest first)
      notificationData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setNotifications(notificationData);
      setUnreadCount(unread);
    });

    return () => unsubscribe();
  }, [teacherEmail]);

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
    setSelectedNotifications([]);
  };

  const markAsRead = async (notificationId) => {
    try {
      await updateDoc(doc(notificationsCollection(), notificationId), {
        isRead: true
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.isRead);
      const updatePromises = unreadNotifications.map(n => 
        updateDoc(doc(notificationsCollection(), n.id), { isRead: true })
      );
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleNotificationSelect = (notificationId) => {
    setSelectedNotifications(prev => 
      prev.includes(notificationId) 
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedNotifications.length === 0) return;
    
    try {
      await deleteSelectedNotifications(selectedNotifications);
      setSelectedNotifications([]);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Error deleting selected notifications:', error);
    }
  };

  const handleDeleteAll = async () => {
    try {
      await deleteAllNotifications(teacherEmail);
      setSelectedNotifications([]);
      setShowDeleteConfirm(false);
      setShowDeleteAllConfirm(false);
    } catch (error) {
      console.error('Error deleting all notifications:', error);
    }
  };

  // Mobile-only avatar click: toggle small profile menu
  const handleAvatarClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 769) {
      setShowAvatarMenu((prev) => !prev);
    }
  };

  const handleMobileLogout = () => {
    try {
      localStorage.removeItem('teacherLoggedIn');
      localStorage.removeItem('teacherEmail');
      localStorage.removeItem('teacherRole');
      localStorage.removeItem('teacherPermissions');
    } catch (e) {}
    window.location.href = '/homepage/login';
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getNotificationIcon = (type, details = {}) => {
    switch (type) {
      case 'student_added':
        return details.gender === 'Male' ? '👨' : '👩';
      case 'student_updated':
        return '✏️';
      case 'student_deleted':
        return '🗑️';
      case 'student_restored':
        return '🔄';
      case 'student_permanently_deleted':
        return '💀';
      case 'quiz_created':
        return '📝';
      case 'quiz_deleted':
        return '❌';
      case 'quiz_restored':
        return '🔄';
      case 'quiz_permanently_deleted':
        return '💀';
      case 'quiz_completed':
        return '✅';
      case 'performance_update':
        return '📊';
      case 'admin_created':
        return '👨‍💼';
      case 'admin_updated':
        return '✏️';
      case 'admin_deleted':
        return '🗑️';
      case 'admin_status_changed':
        return '🔄';
      case 'permissions_updated':
        return '🔐';
      default:
        return '🔔';
    }
  };

  return (
    <header style={{
      background: 'linear-gradient(135deg, #4fa37e 0%, #3d8b6f 100%)',
      color: 'white',
      padding: 'max(12px, env(safe-area-inset-top)) 16px 12px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      width: '100%'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={onMenuClick}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: 24,
            cursor: 'pointer',
            padding: '8px 14px 8px 6px',
            borderRadius: 8,
            transition: 'background-color 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            position: 'relative'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.1)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <span style={{ 
            transform: 'translateX(1px)',
            display: 'block',
            lineHeight: 1,
            textAlign: 'center'
          }}>
            ☰
          </span>
        </button>
        
        {/* Clickable Logo */}
        <button
          onClick={() => router.push('/dashboard')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 8,
            borderRadius: 8,
            transition: 'background-color 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.1)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <img 
            src="/AGHAM_LOGO2.png" 
            alt="AGHAM Logo" 
            style={{ 
              width: 40, 
              height: 40, 
              objectFit: 'contain' 
            }} 
          />
          <h1 style={{ 
            margin: 0, 
            fontSize: 'clamp(18px, 4vw, 24px)', 
            fontWeight: 600, 
            color: 'white',
            letterSpacing: '0.5px'
          }}>
            AGHAM
          </h1>
          {/* Show teacher name/email beside logo on mobile */}
          {teacherEmail && (
            <span className="header-teacher-email" style={{
              marginLeft: 8,
              color: 'white',
              fontWeight: 500,
              fontSize: 'clamp(12px, 3.5vw, 14px)',
              opacity: 0.95,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 160
            }}>
              {teacherEmail}
            </span>
          )}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={toggleNotifications}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: 24,
              cursor: 'pointer',
              padding: 8,
              borderRadius: 8,
              position: 'relative',
              transition: 'background-color 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            <i className="ri-notification-3-line" style={{ fontSize: '24px' }}></i>
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: -5,
                right: -5,
                background: '#e74c3c',
                color: 'white',
                borderRadius: '50%',
                width: 20,
                height: 20,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                animation: 'pulse 2s infinite'
              }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                width: 400,
                maxHeight: 500,
                background: 'white',
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                zIndex: 1000,
                overflow: 'hidden',
                border: '1px solid #e9ecef'
              }}>
                {/* Header */}
                <div style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #e9ecef',
                  background: '#f8f9fa',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#333' }}>
                    Notifications ({notifications.length})
                  </h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {selectedNotifications.length > 0 && (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        style={{
                          background: 'rgba(220, 53, 69, 0.1)',
                          color: '#dc3545',
                          border: '1px solid rgba(220, 53, 69, 0.2)',
                          borderRadius: 12,
                          padding: '6px 12px',
                          fontSize: 12,
                          cursor: 'pointer',
                          fontWeight: 500,
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = 'rgba(220, 53, 69, 0.2)';
                          e.target.style.borderColor = 'rgba(220, 53, 69, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'rgba(220, 53, 69, 0.1)';
                          e.target.style.borderColor = 'rgba(220, 53, 69, 0.2)';
                        }}
                      >
                        <i className="ri-delete-bin-line" style={{ fontSize: 12 }}></i>
                        Delete ({selectedNotifications.length})
                      </button>
                    )}
                    <button
                      onClick={() => setShowDeleteAllConfirm(true)}
                      style={{
                        background: 'rgba(108, 117, 125, 0.1)',
                        color: '#6c757d',
                        border: '1px solid rgba(108, 117, 125, 0.2)',
                        borderRadius: 12,
                        padding: '6px 12px',
                        fontSize: 12,
                        cursor: 'pointer',
                        fontWeight: 500,
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = 'rgba(108, 117, 125, 0.2)';
                        e.target.style.borderColor = 'rgba(108, 117, 125, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'rgba(108, 117, 125, 0.1)';
                        e.target.style.borderColor = 'rgba(108, 117, 125, 0.2)';
                      }}
                    >
                      <i className="ri-delete-bin-6-line" style={{ fontSize: 12 }}></i>
                      Delete All
                    </button>
                    <button
                      onClick={markAllAsRead}
                      style={{
                        background: 'rgba(40, 167, 69, 0.1)',
                        color: '#28a745',
                        border: '1px solid rgba(40, 167, 69, 0.2)',
                        borderRadius: 12,
                        padding: '6px 12px',
                        fontSize: 12,
                        cursor: 'pointer',
                        fontWeight: 500,
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = 'rgba(40, 167, 69, 0.2)';
                        e.target.style.borderColor = 'rgba(40, 167, 69, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'rgba(40, 167, 69, 0.1)';
                        e.target.style.borderColor = 'rgba(40, 167, 69, 0.2)';
                      }}
                    >
                      <i className="ri-check-double-line" style={{ fontSize: 12 }}></i>
                      Mark All Read
                    </button>
                  </div>
                </div>

                {/* Notifications List */}
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{
                      padding: '32px 20px',
                      textAlign: 'center',
                      color: '#6c757d',
                      fontSize: 14
                    }}>
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        style={{
                          padding: '16px 20px',
                          borderBottom: '1px solid #f1f3f4',
                          background: notification.isRead ? 'white' : '#f8f9fa',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s ease',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12
                        }}
                        onClick={() => markAsRead(notification.id)}
                        onMouseEnter={(e) => e.target.style.backgroundColor = notification.isRead ? '#f8f9fa' : '#e9ecef'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = notification.isRead ? 'white' : '#f8f9fa'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={selectedNotifications.includes(notification.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleNotificationSelect(notification.id);
                            }}
                            style={{ margin: 0 }}
                          />
                          <span style={{ fontSize: 20 }}>
                            {getNotificationIcon(notification.type, notification.details)}
                          </span>
                        </div>
                        
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 14,
                            color: '#333',
                            fontWeight: notification.isRead ? 400 : 600,
                            marginBottom: 4,
                            lineHeight: 1.4
                          }}>
                            {notification.message}
                          </div>
                          <div style={{
                            fontSize: 12,
                            color: '#6c757d'
                          }}>
                            {formatTimestamp(notification.timestamp)}
                          </div>
                        </div>

                        {!notification.isRead && (
                          <div style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: '#007bff',
                            flexShrink: 0
                          }} />
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div style={{
                  padding: '12px 20px',
                  borderTop: '1px solid #e9ecef',
                  background: '#f8f9fa',
                  textAlign: 'center'
                }}>
                  <button
                    onClick={toggleNotifications}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#6c757d',
                      fontSize: 14,
                      cursor: 'pointer',
                      fontWeight: 500
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Delete Confirmation Modal */}
              {showDeleteConfirm && (
                <div style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100vw',
                  height: '100vh',
                  background: 'rgba(0,0,0,0.5)',
                  zIndex: 2000,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{
                    background: 'white',
                    borderRadius: 12,
                    padding: 24,
                    maxWidth: 400,
                    textAlign: 'center'
                  }}>
                    <h3 style={{ margin: '0 0 16px 0', color: '#333' }}>
                      Confirm Deletion
                    </h3>
                    <p style={{ margin: '0 0 24px 0', color: '#666', lineHeight: 1.5 }}>
                      Are you sure you want to delete {selectedNotifications.length} selected notification{selectedNotifications.length > 1 ? 's' : ''}? This action cannot be undone.
                    </p>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        style={{
                          background: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: 8,
                          padding: '10px 20px',
                          fontSize: 14,
                          cursor: 'pointer',
                          fontWeight: 500
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteSelected}
                        style={{
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: 8,
                          padding: '10px 20px',
                          fontSize: 14,
                          cursor: 'pointer',
                          fontWeight: 500
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Delete All Confirmation Modal */}
              {showDeleteAllConfirm && (
                <div style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100vw',
                  height: '100vh',
                  background: 'rgba(0,0,0,0.5)',
                  zIndex: 2000,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{
                    background: 'white',
                    borderRadius: 12,
                    padding: 24,
                    maxWidth: 400,
                    textAlign: 'center'
                  }}>
                    <h3 style={{ margin: '0 0 16px 0', color: '#333' }}>
                      Confirm Delete All
                    </h3>
                    <p style={{ margin: '0 0 24px 0', color: '#666', lineHeight: 1.5 }}>
                      Are you sure you want to delete all {notifications.length} notifications? This action cannot be undone.
                    </p>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                      <button
                        onClick={() => setShowDeleteAllConfirm(false)}
                        style={{
                          background: 'rgba(108, 117, 125, 0.1)',
                          color: '#6c757d',
                          border: '1px solid rgba(108, 117, 125, 0.2)',
                          borderRadius: 16,
                          padding: '12px 24px',
                          fontSize: 14,
                          cursor: 'pointer',
                          fontWeight: 500,
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = 'rgba(108, 117, 125, 0.2)';
                          e.target.style.borderColor = 'rgba(108, 117, 125, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'rgba(108, 117, 125, 0.1)';
                          e.target.style.borderColor = 'rgba(108, 117, 125, 0.2)';
                        }}
                      >
                        <i className="ri-close-line" style={{ fontSize: 16 }}></i>
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteAll}
                        style={{
                          background: 'rgba(220, 53, 69, 0.1)',
                          color: '#dc3545',
                          border: '1px solid rgba(220, 53, 69, 0.2)',
                          borderRadius: 16,
                          padding: '12px 24px',
                          fontSize: 14,
                          cursor: 'pointer',
                          fontWeight: 500,
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = 'rgba(220, 53, 69, 0.2)';
                          e.target.style.borderColor = 'rgba(220, 53, 69, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'rgba(220, 53, 69, 0.1)';
                          e.target.style.borderColor = 'rgba(220, 53, 69, 0.2)';
                        }}
                      >
                        <i className="ri-delete-bin-6-line" style={{ fontSize: 16 }}></i>
                        Delete All
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
          <button onClick={handleAvatarClick} aria-label="Open profile menu" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            <img src="/TeacherProfile.png" alt="Profile Picture" style={{ width: 28, height: 28, borderRadius: '50%' }} />
          </button>
          <span className="hide-on-mobile" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>
            {teacherEmail}
          </span>
          {/* Mobile profile popover anchored to avatar */}
          {showAvatarMenu && (
            <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 1200 }} className="mobile-avatar-menu">
              <div style={{
                background: 'white',
                color: '#2c3e50',
                borderRadius: 12,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                border: '1px solid #e9ecef',
                minWidth: 220,
                overflow: 'hidden'
              }}>
                <div style={{ padding: '12px 14px', fontWeight: 600, fontSize: 14, borderBottom: '1px solid #e9ecef' }}>
                  {teacherEmail}
                </div>
                <button onClick={handleMobileLogout} style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: '#dc3545'
                }}>
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fixed overlay to close dropdown when clicking outside */}
      {(showNotifications || showAvatarMenu) && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 999
          }}
          onClick={() => { setShowNotifications(false); setShowAvatarMenu(false); }}
        />
      )}

      <style jsx>{`
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
        @media (max-width: 768px) {
          .hide-on-mobile { display: none; }
          .header-teacher-email { display: none; }
          .mobile-avatar-menu { display: block; }
        }
        @media (min-width: 769px) {
          .header-teacher-email { display: none; }
          .mobile-avatar-menu { display: none; }
        }
      `}</style>
    </header>
  );
} 