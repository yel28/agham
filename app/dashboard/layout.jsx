'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTeacher } from '../lib/Teacher-SPCC';
import Header from '../components/Header';
import Sidebar, { SidebarTooltip } from '../components/Sidebar';
import MainContent from '../components/MainContent';
import { PageLoadingSkeleton } from '../components/LoadingSkeleton';
import './style.css';
import { db, collectionGroup, onSnapshot, query, orderBy, limit, where, getDocs, notificationsCollection, doc, setDoc } from '../lib/firebase';
import { addNotification as addSystemNotification, NOTIFICATION_TYPES } from '../lib/notificationUtils';
import { useNotifications } from '../components/NotificationToast';

export default function DashboardLayout({ children }) {
  const { teacherEmail, setTeacherEmail } = useTeacher();
  const [sidebarActive, setSidebarActive] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [teacherRole, setTeacherRole] = useState('');
  const [teacherPermissions, setTeacherPermissions] = useState({});
  const [tooltipState, setTooltipState] = useState({ hoveredItem: null, position: null });
  const pathname = usePathname();
  const { showInfo } = useNotifications();
  const processedQuizResultIdsRef = React.useRef(new Set());

  // Load teacher role and permissions from localStorage
  React.useEffect(() => {
    const role = localStorage.getItem('teacherRole') || '';
    const permissions = JSON.parse(localStorage.getItem('teacherPermissions') || '{}');
    setTeacherRole(role);
    setTeacherPermissions(permissions);
  }, []);

  const handleLogout = (e) => {
    e.preventDefault();
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    setShowLogoutModal(false);
    
    // Simulate logout process with a delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    localStorage.removeItem('teacherLoggedIn');
    localStorage.removeItem('teacherEmail');
    localStorage.removeItem('teacherRole');
    localStorage.removeItem('teacherPermissions');
    setTeacherEmail('');
    window.location.href = '/homepage/login';
  };

  const cancelLogout = () => {
    setShowLogoutModal(false);
  };

  const handleMenuClick = () => setSidebarActive((prev) => !prev);

  const handleTooltipChange = (hoveredItem, position) => {
    setTooltipState({ hoveredItem, position });
  };

  // Lock body scroll when sidebar drawer is open on mobile
  React.useEffect(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile && sidebarActive) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [sidebarActive]);

  // Close the mobile drawer automatically on route change
  React.useEffect(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) {
      setSidebarActive(false);
      // Also ensure body scroll is restored in case of unexpected state
      document.body.style.overflow = '';
    }
  }, [pathname]);

  // Real-time toast when any student submits a quiz (new quizResults doc)
  React.useEffect(() => {
    // Listen across all students' quizResults subcollections
    let initialized = false;
    const unsub = onSnapshot(collectionGroup(db, 'quizResults'), (snapshot) => {
      // Skip initial load (which would treat existing docs as "added")
      if (!initialized) {
        initialized = true;
        return;
      }
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          // Ignore cache writes that will be followed by server event
          if (change.doc.metadata && change.doc.metadata.hasPendingWrites) return;
          // De-duplicate per quizResult document
          const quizResultId = change.doc.id;
          if (processedQuizResultIdsRef.current.has(quizResultId)) return;
          processedQuizResultIdsRef.current.add(quizResultId);

          const data = change.doc.data() || {};
          // Derive student id from path: .../students/{studentId}/quizResults/{docId}
          let studentLabel = data.studentName || data.studentId;
          if (!studentLabel) {
            try {
              const segments = change.doc.ref.path.split('/');
              // Expect last 4 segments: students/{studentId}/quizResults/{docId}
              const studentId = segments.length >= 4 ? segments[segments.length - 3] : '';
              if (studentId) {
                const num = (studentId.match(/(\d+)/) || [,''])[1];
                studentLabel = num ? `Student ${String(num).padStart(3, '0')}` : studentId;
              }
            } catch (_) {}
          }
          if (!studentLabel) studentLabel = 'A student';

          const quiz = data.quizTitle || data.topic || quizResultId.split('_')[0] || 'a quiz';
          const message = `${studentLabel} submitted ${quiz}`;
          showInfo(message);
          // Persist as system notification for the current teacher (idempotent by fixed doc id)
          if (teacherEmail) {
            try {
              const notifId = `${teacherEmail.replace(/[^a-zA-Z0-9_-]/g,'_')}__${quizResultId}`;
              await setDoc(
                doc(notificationsCollection(), notifId),
                {
                  teacherEmail,
                  type: NOTIFICATION_TYPES.QUIZ_COMPLETED,
                  message,
                  details: { studentName: studentLabel, quizTitle: quiz, quizResultId },
                  timestamp: new Date().toISOString(),
                  isRead: false
                },
                { merge: false }
              );
            } catch (_) {}
          }
        }
      });
    });
    return () => unsub();
  }, [showInfo, teacherEmail]);

  // Determine the active page based on pathname
  const getActivePage = () => {
    if (pathname === '/dashboard') return 'dashboard';
    if (pathname.includes('/student-record')) return 'student-record';
    if (pathname.includes('/student-assessment')) return 'student-assessment';
    if (pathname.includes('/lesson-module')) return 'lesson-module';
    if (pathname.includes('/quizzes')) return 'quizzes';
    if (pathname.includes('/leaderboard')) return 'leaderboard';
    if (pathname.includes('/archive')) return 'archive';
    if (pathname.includes('/admin-management')) return 'admin-management';
    return 'dashboard';
  };

  return (
    <>
      <Header teacherEmail={teacherEmail} onMenuClick={handleMenuClick} />
      <section className="main" style={{ marginTop: '80px' }}>
        <Sidebar 
          active={getActivePage()} 
          handleLogout={handleLogout} 
          sidebarActive={sidebarActive}
          teacherRole={teacherRole}
          teacherPermissions={teacherPermissions}
          onNavigate={() => setSidebarActive(false)}
          onTooltipChange={handleTooltipChange}
        />
        <MainContent sidebarActive={sidebarActive}>
          {children}
        </MainContent>
        {/* Overlay for mobile drawer */}
        {sidebarActive && (
          <div
            onClick={() => setSidebarActive(false)}
            style={{
              position: 'fixed',
              top: 80,
              left: 280,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.3)',
              zIndex: 1000,
              display: typeof window !== 'undefined' && window.innerWidth < 768 ? 'block' : 'none'
            }}
            aria-hidden="true"
          />
        )}
      </section>

      {/* Sidebar Tooltip */}
      <SidebarTooltip 
        hoveredItem={tooltipState.hoveredItem} 
        position={tooltipState.position} 
      />

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'white', borderRadius: 20, padding: 0, width: '90%', maxWidth: 450,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            border: '1px solid rgba(0,0,0,0.1)',
            animation: 'modalSlideIn 0.3s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
              color: 'white', padding: '25px 30px', borderRadius: '20px 20px 0 0',
              display: 'flex', alignItems: 'center', gap: 15
            }}>
              <div style={{
                width: 50, height: 50, background: 'rgba(255,255,255,0.2)',
                borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <i className="ri-logout-box-r-line" style={{ fontSize: 24 }}></i>
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Confirm Logout</h2>
              </div>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '30px' }}>
              <p style={{ 
                margin: '0 0 30px 0', 
                fontSize: 16, 
                color: '#666', 
                textAlign: 'center',
                lineHeight: 1.5
              }}>
                Are you sure you want to logout from your account?
              </p>

              {/* Action Buttons */}
              <div style={{ 
                display: 'flex', gap: 15, justifyContent: 'center'
              }}>
                <button
                  onClick={cancelLogout}
                  style={{
                    background: 'linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)',
                    color: 'white', border: 'none', borderRadius: 12, padding: '12px 25px',
                    fontSize: 16, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.2s ease', boxShadow: '0 4px 12px rgba(149, 165, 166, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(149, 165, 166, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(149, 165, 166, 0.3)';
                  }}
                >
                  <i className="ri-close-line" style={{ marginRight: 8 }}></i>
                  Cancel
                </button>
                <button
                  onClick={confirmLogout}
                  style={{
                    background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
                    color: 'white', border: 'none', borderRadius: 12, padding: '12px 25px',
                    fontSize: 16, fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.2s ease', boxShadow: '0 4px 12px rgba(231, 76, 60, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(231, 76, 60, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(231, 76, 60, 0.3)';
                  }}
                >
                  <i className="ri-logout-box-r-line" style={{ marginRight: 8 }}></i>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logout Loading Screen */}
      {isLoggingOut && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            background: 'white',
            borderRadius: 20,
            padding: '40px 50px',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            border: '1px solid rgba(0,0,0,0.1)',
            maxWidth: 400,
            width: '90%'
          }}>
            {/* Loading Spinner */}
            <div style={{
              width: 60,
              height: 60,
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #e74c3c',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px auto'
            }}></div>
            
            {/* Loading Text */}
            <h3 style={{
              margin: '0 0 10px 0',
              fontSize: 24,
              fontWeight: 700,
              color: '#2c3e50'
            }}>
              Logging Out...
            </h3>
            
            <p style={{
              margin: 0,
              fontSize: 16,
              color: '#6c757d',
              lineHeight: 1.5
            }}>
              Please wait while we securely log you out
            </p>
          </div>
        </div>
      )}
    </>
  );
}
