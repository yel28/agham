import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { checkUserPermissions } from '../lib/adminUtils';

export default function Sidebar({ active, handleLogout, sidebarActive, teacherRole, teacherPermissions, onNavigate, onTooltipChange }) {
  const [hoveredItem, setHoveredItem] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const sidebarRef = useRef(null);

  const handleMouseEnter = (itemName, event) => {
    if (sidebarActive) {
      const rect = event.currentTarget.getBoundingClientRect();
      const position = {
        top: rect.top + rect.height / 2,
        left: rect.right + 8
      };
      setTooltipPosition(position);
      setHoveredItem(itemName);
      onTooltipChange && onTooltipChange(itemName, position);
    }
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
    onTooltipChange && onTooltipChange(null, null);
  };

  return (
    <div className={`sidebar${sidebarActive ? ' active' : ''}`}>
      <ul className="sidebar--items">
        <li>
          <Link 
            href="/dashboard" 
            id={active === 'dashboard' ? 'active--link' : ''} 
            onClick={onNavigate}
            onMouseEnter={(e) => handleMouseEnter('dashboard', e)}
            onMouseLeave={handleMouseLeave}
          >
            <span className="icon icon-1"><i className="ri-layout-grid-line"></i></span>
            <span className="sidebar--item">Dashboard</span>
          </Link>
        </li>
        <li>
          <Link 
            href="/dashboard/student-assessment" 
            id={active === 'student-assessment' ? 'active--link' : ''} 
            onClick={onNavigate}
            onMouseEnter={(e) => handleMouseEnter('student-assessment', e)}
            onMouseLeave={handleMouseLeave}
          >
            <span className="icon icon-2"><i className="ri-pie-chart-line"></i></span>
            <span className="sidebar--item">Student Assessment</span>
          </Link>
        </li>
        <li>
          <Link 
            href="/dashboard/student-record" 
            id={active === 'student-record' ? 'active--link' : ''} 
            onClick={onNavigate}
            onMouseEnter={(e) => handleMouseEnter('student-record', e)}
            onMouseLeave={handleMouseLeave}
          >
            <span className="icon icon-3"><i className="ri-user-line"></i></span>
            <span className="sidebar--item">Student Record</span>
          </Link>
        </li>
        {/* Lesson Module - placed under Student Record and above Quizzes */}
        <li>
          <Link 
            href="/dashboard/lesson-module" 
            id={active === 'lesson-module' ? 'active--link' : ''} 
            onClick={onNavigate}
            onMouseEnter={(e) => handleMouseEnter('lesson-module', e)}
            onMouseLeave={handleMouseLeave}
          >
            <span className="icon icon-lesson"><i className="ri-book-2-line"></i></span>
            <span className="sidebar--item">Lesson Module</span>
          </Link>
        </li>
        <li>
          <Link 
            href="/dashboard/quizzes" 
            id={active === 'quizzes' ? 'active--link' : ''} 
            onClick={onNavigate}
            onMouseEnter={(e) => handleMouseEnter('quizzes', e)}
            onMouseLeave={handleMouseLeave}
          >
            <span className="icon icon-4"><i className="ri-todo-line"></i></span>
            <span className="sidebar--item">Quizzes</span>
          </Link>
        </li>
        {checkUserPermissions(teacherRole, teacherPermissions, 'access_archive') && (
          <li>
            <Link 
              href="/dashboard/archive" 
              id={active === "archive" ? "active--link" : ""} 
              onClick={onNavigate}
              onMouseEnter={(e) => handleMouseEnter('archive', e)}
              onMouseLeave={handleMouseLeave}
            >
              <span className="icon icon-5"><i className="ri-archive-line"></i></span>
              <span className="sidebar--item">Archive</span>
            </Link>
          </li>
        )}
        {checkUserPermissions(teacherRole, teacherPermissions, 'admin_access') && (
          <li>
            <Link 
              href="/dashboard/admin-management" 
              id={active === "admin-management" ? "active--link" : ""} 
              onClick={onNavigate}
              onMouseEnter={(e) => handleMouseEnter('admin-management', e)}
              onMouseLeave={handleMouseLeave}
            >
              <span className="icon icon-6"><i className="ri-user-settings-line"></i></span>
              <span className="sidebar--item">Admin Management</span>
            </Link>
          </li>
        )}
      </ul>
      <ul className="sidebar--bottom-items">
        <li className="sidebar-logout-desktop">
          <a 
            href="#" 
            onClick={handleLogout} 
            style={{ display: 'flex', alignItems: 'center' }}
            onMouseEnter={(e) => handleMouseEnter('logout', e)}
            onMouseLeave={handleMouseLeave}
          >
            <span className="icon icon-7"><i className="ri-logout-box-r-line"></i></span>
            <span className="sidebar--item">Logout</span>
          </a>
        </li>
      </ul>
      
    </div>
  );
}

// Tooltip component rendered outside sidebar to avoid overflow issues
export function SidebarTooltip({ hoveredItem, position }) {
  if (!hoveredItem) return null;

  const getTooltipText = () => {
    switch (hoveredItem) {
      case 'dashboard': return 'Dashboard';
      case 'student-assessment': return 'Student Assessment';
      case 'student-record': return 'Student Record';
      case 'lesson-module': return 'Lesson Module';
      case 'quizzes': return 'Quizzes';
      case 'archive': return 'Archive';
      case 'admin-management': return 'Admin Management';
      case 'logout': return 'Logout';
      default: return '';
    }
  };

  return (
    <div 
      className="sidebar-tooltip"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        transform: 'translateY(-50%)',
        zIndex: 10000
      }}
    >
      {getTooltipText()}
    </div>
  );
} 