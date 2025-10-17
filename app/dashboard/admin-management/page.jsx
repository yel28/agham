'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db, collection, onSnapshot, doc, updateDoc, adminsCollection } from '../../lib/firebase';
import { 
  createAdmin, 
  getAllAdmins, 
  updateAdminPermissions, 
  toggleAdminStatus, 
  deleteAdmin, 
  isSuperAdmin,
  getAdminByEmail,
  ADMIN_ROLES,
  DEFAULT_PERMISSIONS,
  checkUserPermissions 
} from '../../lib/adminUtils';
import { 
  notifyAdminCreated, 
  notifyAdminDeleted, 
  notifyAdminStatusChanged, 
  notifyPermissionsUpdated 
} from '../../lib/notificationUtils';
import { useNotifications } from '../../components/NotificationToast';
import '../style.css';
import './adminManagement.css';

export default function AdminManagementPage() {
  const router = useRouter();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTeacherEmail, setCurrentTeacherEmail] = useState(null);
  const [isSuperAdminUser, setIsSuperAdminUser] = useState(false);
  const [teacherRole, setTeacherRole] = useState('');
  const [teacherPermissions, setTeacherPermissions] = useState({});
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  
  // Operation loading states
  const [createLoading, setCreateLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState({}); // per-admin toggle

  // Toast notifications
  const { showSuccess, showError, showWarning, showInfo } = useNotifications();
  
  // Create admin form state
  const [createForm, setCreateForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: ADMIN_ROLES.SUB_TEACHER,
    password: '',
    confirmPassword: ''
  });

  // Edit admin form state
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: ADMIN_ROLES.SUB_TEACHER
  });
  // Set teacher email on client side only
  useEffect(() => {
    const email = localStorage.getItem('teacherEmail');
    console.log('Admin Management - Current email from localStorage:', email);
    setCurrentTeacherEmail(email);
    
    if (!email) {
      console.log('Admin Management - No email found, redirecting to login');
      router.push('/homepage/login');
    } else {
      const isSuper = isSuperAdmin(email);
      console.log('Admin Management - Is super admin check:', { email, isSuper });
      setIsSuperAdminUser(isSuper);
    }
  }, [router]);

  // Load role and permissions from localStorage (used for admin access gate)
  useEffect(() => {
    const role = localStorage.getItem('teacherRole') || '';
    const permissions = JSON.parse(localStorage.getItem('teacherPermissions') || '{}');
    console.log('Admin Management - Loaded role/permissions from localStorage:', { role, permissions });
    setTeacherRole(role);
    setTeacherPermissions(permissions);
  }, []);

  // Ensure super admin state reflects stored role as well
  useEffect(() => {
    if (teacherRole === ADMIN_ROLES.SUPER_ADMIN) {
      setIsSuperAdminUser(true);
    }
  }, [teacherRole]);


  // Fetch admins data
  useEffect(() => {
    // Compute access inside the effect to avoid referencing before initialization
    const hasAccess = (
      isSuperAdminUser ||
      checkUserPermissions(teacherRole, teacherPermissions, 'manage_users') ||
      checkUserPermissions(teacherRole, teacherPermissions, 'change_roles')
    );

    if (!currentTeacherEmail || !hasAccess) return;

    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(adminsCollection(), (snapshot) => {
      const adminData = [];
      snapshot.forEach((doc) => {
        adminData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setAdmins(adminData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      setLoading(false);
    }, (error) => {
      console.error('Error fetching admins:', error);
      setError('Failed to fetch admin list');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentTeacherEmail, isSuperAdminUser, teacherRole, teacherPermissions]);


  const handleCreateAdmin = async () => {
    try {
      setCreateLoading(true);
      if (createForm.password !== createForm.confirmPassword) {
        showError('Passwords do not match');
        return;
      }

      if (createForm.password.length < 6) {
        showError('Password must be at least 6 characters long');
        return;
      }

      await createAdmin(createForm, currentTeacherEmail);
      
      // Add notification
      await notifyAdminCreated(
        currentTeacherEmail, 
        `${createForm.firstName} ${createForm.lastName}`, 
        createForm.role
      );

      setShowCreateModal(false);
      setCreateForm({
        firstName: '',
        lastName: '',
        email: '',
        role: ADMIN_ROLES.SUB_TEACHER,
        password: '',
        confirmPassword: ''
      });
      
      showSuccess('Admin created successfully!');
    } catch (error) {
      console.error('Error creating admin:', error);
      showError('Failed to create admin: ' + (error?.message || error));
    } finally {
      setCreateLoading(false);
    }
  };

  const handleEditAdmin = async () => {
    try {
      setEditLoading(true);
      if (!selectedAdmin) return;

      // Check if email is being changed and if it already exists
      if (editForm.email !== selectedAdmin.email) {
        const existingAdmin = await getAdminByEmail(editForm.email);
        if (existingAdmin && existingAdmin.id !== selectedAdmin.id) {
          showError('Admin with this email already exists');
          return;
        }
      }

      // Update admin in Firestore using adminsCollection()
      const adminRef = doc(adminsCollection(), selectedAdmin.id);
      await updateDoc(adminRef, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        email: editForm.email,
        role: editForm.role,
        updatedAt: new Date().toISOString(),
        updatedBy: currentTeacherEmail
      });

      // Update login credentials if email changed
      if (editForm.email !== selectedAdmin.email) {
        // You might want to update the teacher_credentials collection as well
        console.log('Email changed - consider updating login credentials');
      }

      setShowEditModal(false);
      setSelectedAdmin(null);
      showSuccess('Admin updated successfully!');
    } catch (error) {
      console.error('Error updating admin:', error);
      showError('Failed to update admin: ' + (error?.message || error));
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleStatus = async (adminId, currentStatus) => {
    try {
      setStatusLoading(prev => ({ ...prev, [adminId]: true }));
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      await toggleAdminStatus(adminId, newStatus, currentTeacherEmail);
      
      // Add notification
      const admin = admins.find(a => a.id === adminId);
      if (admin) {
        await notifyAdminStatusChanged(
          currentTeacherEmail,
          `${admin.firstName} ${admin.lastName}`,
          newStatus
        );
      }
      
      showSuccess(`Admin status changed to ${newStatus}`);
    } catch (error) {
      console.error('Error updating admin status:', error);
      showError('Failed to update admin status: ' + (error?.message || error));
    } finally {
      setStatusLoading(prev => ({ ...prev, [adminId]: false }));
    }
  };

  const handleDeleteAdmin = async () => {
    if (!selectedAdmin) return;
    
    try {
      setDeleteLoading(true);
      console.log('Attempting to delete admin:', selectedAdmin);
      console.log('Current teacher email:', currentTeacherEmail);
      
      await deleteAdmin(selectedAdmin.id, currentTeacherEmail);
      
      // Add notification
      await notifyAdminDeleted(
        currentTeacherEmail,
        `${selectedAdmin.firstName} ${selectedAdmin.lastName}`
      );
      
      setShowDeleteModal(false);
      setSelectedAdmin(null);
      showSuccess('Admin deleted successfully');
    } catch (error) {
      console.error('Error deleting admin:', error);
      showError('Failed to delete admin: ' + (error?.message || error));
    } finally {
      setDeleteLoading(false);
    }
  };


  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case ADMIN_ROLES.SUB_TEACHER:
        return '#ffc107';
      case ADMIN_ROLES.TEACHER:
        return '#28a745';
      case ADMIN_ROLES.ADMIN:
        return '#007bff';
      case ADMIN_ROLES.SUPER_ADMIN:
        return '#6f42c1';
      default:
        return '#6c757d';
    }
  };

  const getStatusBadgeColor = (status) => {
    return status === 'active' ? '#28a745' : '#dc3545';
  };
 
  // Filter out current user from admin list and group by role for organized rendering
  const filteredAdmins = admins.filter(admin => admin.email !== currentTeacherEmail);
  const adminsAdmins = filteredAdmins.filter(a => a.role === ADMIN_ROLES.ADMIN);
  const adminsTeachers = filteredAdmins.filter(a => a.role === ADMIN_ROLES.TEACHER);
  const adminsSubs = filteredAdmins.filter(a => a.role === ADMIN_ROLES.SUB_TEACHER);

  const renderAdminCard = (admin) => (
    <div
      key={admin.id}
      className="admin-card"
      style={{
        background: 'white',
        borderRadius: 16,
        padding: 24,
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        outline: 'none',
        willChange: 'transform, box-shadow, border-color',
        backfaceVisibility: 'hidden',
        transform: 'translateZ(0)'
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div style={{ position: 'relative' }}>
        <img 
          src={admin.avatar || '/TeacherProfile.png'} 
          alt="avatar" 
          style={{ 
            width: 56, 
            height: 56, 
            borderRadius: '50%',
            border: '3px solid #f1f5f9',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            objectFit: 'cover'
          }} 
        />
        <div style={{
          position: 'absolute',
          top: -2,
          right: -2,
          width: 20,
          height: 20,
          borderRadius: '50%',
          backgroundColor: getStatusBadgeColor(admin.status),
          border: '3px solid white',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <i className={admin.status === 'active' ? 'ri-check-line' : 'ri-close-line'} 
             style={{ 
               fontSize: 10, 
               color: 'white',
               fontWeight: 'bold'
             }}></i>
        </div>
      </div>
      
      <div style={{ flex: 1 }}>
        <div style={{ 
          fontSize: 20, 
          fontWeight: 700, 
          color: '#1a202c',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 16
        }}>
          <span style={{ letterSpacing: '-0.3px' }}>
            {admin.firstName} {admin.lastName}
          </span>
          <button style={{
            background: getRoleBadgeColor(admin.role),
            color: 'white',
            padding: '6px 14px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            border: 'none',
            cursor: 'default',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 3px 8px rgba(0,0,0,0.15)',
            letterSpacing: '0.8px'
          }}>
            <i className="ri-user-line" style={{ fontSize: 12 }}></i>
            {admin.role.replace('_', ' ')}
          </button>
        </div>
        
        <div style={{ 
          fontSize: 15, 
          color: '#4a5568', 
          marginBottom: 8,
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <i className="ri-mail-line" style={{ fontSize: 14, color: '#a0aec0' }}></i>
          {admin.email}
        </div>
        
        <div style={{ 
          fontSize: 13, 
          color: '#718096',
          display: 'flex',
          alignItems: 'center',
          gap: 16
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="ri-calendar-line" style={{ fontSize: 12 }}></i>
            Created: {formatDate(admin.createdAt)}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="ri-time-line" style={{ fontSize: 12 }}></i>
            Last Login: {formatDate(admin.lastLogin)}
          </span>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={() => {
            setSelectedAdmin(admin);
            setEditForm({ firstName: admin.firstName, lastName: admin.lastName, email: admin.email, role: admin.role });
            setShowEditModal(true);
          }}
          className="admin-btn admin-btn--edit"
        >
          <i className="ri-edit-line" style={{ fontSize: 14 }}></i>
          Edit
        </button>
        
        {/* Only show activate/deactivate for sub-teachers and teachers */}
        {(admin.role === ADMIN_ROLES.SUB_TEACHER || admin.role === ADMIN_ROLES.TEACHER) && (
          <button
            onClick={() => handleToggleStatus(admin.id, admin.status)}
            className={`admin-btn ${admin.status === 'active' ? 'admin-btn--deactivate' : 'admin-btn--activate'}`}
            disabled={statusLoading[admin.id]}
          >
            <i className={admin.status === 'active' ? 'ri-pause-line' : 'ri-play-line'} style={{ fontSize: 14 }}></i>
            {statusLoading[admin.id] ? 'Processing...' : (admin.status === 'active' ? 'Deactivate' : 'Activate')}
          </button>
        )}
        
        <button
          onClick={() => { setSelectedAdmin(admin); setShowDeleteModal(true); }}
          className="admin-btn admin-btn--delete"
        >
          <i className="ri-delete-bin-line" style={{ fontSize: 14 }}></i>
          Delete
        </button>
      </div>
    </div>
  );

  // Don't render until we have teacher email
  if (!currentTeacherEmail) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: 18,
        color: '#6c757d'
      }}>
        Loading teacher information...
      </div>
    );
  }

  // Check if user can access Admin Management:
  // Allow super admin OR role 'admin' OR explicit manage users/roles permissions
  const canAccessAdminManagement = (
    isSuperAdminUser ||
    checkUserPermissions(teacherRole, teacherPermissions, 'manage_users') ||
    checkUserPermissions(teacherRole, teacherPermissions, 'change_roles')
  );

  // Only deny once we have an email and role evaluated
  if (currentTeacherEmail && teacherRole !== '' && !canAccessAdminManagement) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: 18,
        color: '#6c757d'
      }}>
        Access denied. Only Admins or Super Administrators can access this page.
      </div>
    );
  }
  return (
    <div>
          {/* Professional Header Section */}
          <div style={{ 
            marginBottom: 32, 
            borderBottom: '2px solid #f0f0f0',
            paddingBottom: 20,
            paddingTop: 20,
            paddingLeft: 24,
            paddingRight: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
            borderRadius: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}>
            <div>
              <h1 style={{ 
                fontSize: 32, 
                fontWeight: 700, 
                color: '#2c3e50',
                margin: '0 0 4px 0',
                letterSpacing: '-0.5px'
              }}>
                Admin Management
              </h1>
              <p style={{ 
                fontSize: 16, 
                color: '#6c757d', 
                margin: 0,
                fontWeight: 400,
                lineHeight: 1.4
              }}>
                Manage teacher accounts, permissions, and system access
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="admin-btn admin-btn--primary"
              style={{ borderRadius: 12, padding: '12px 24px', fontSize: 16 }}
            >
              <span style={{ fontSize: 20, color: 'white' }}>+</span>
              Create User
            </button>
          </div>


          {/* Content Area */}
          <div style={{ padding: '0 24px' }}>
            {error && (
              <div style={{ 
                background: '#fff5f5', 
                border: '1px solid #fed7d7', 
                borderRadius: 12, 
                padding: 20, 
                marginBottom: 24,
                color: '#c53030'
              }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Error loading admins:</div>
                <div>{error}</div>
              </div>
            )}

            {/* Current User Info */}
            {currentTeacherEmail && (
              <div style={{ 
                background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', 
                borderRadius: 20, 
                padding: 28, 
                marginBottom: 24,
                border: '1px solid #cbd5e0',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Decorative background pattern */}
                <div style={{
                  position: 'absolute',
                  top: -20,
                  right: -20,
                  width: 80,
                  height: 80,
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                  borderRadius: '50%',
                  zIndex: 0
                }}></div>
                
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 20,
                  marginBottom: 16,
                  position: 'relative',
                  zIndex: 1
                }}>
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: 24,
                    fontWeight: 700,
                    boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
                    border: '3px solid white',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    <img 
                      src="/TeacherProfile.png" 
                      alt="Teacher Avatar" 
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover',
                        borderRadius: '50%'
                      }} 
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'none',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      borderRadius: '50%'
                    }}>
                      <i className="ri-graduation-cap-line" style={{ fontSize: 24 }}></i>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontSize: 20, 
                      fontWeight: 700, 
                      color: '#2c3e50',
                      marginBottom: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12
                    }}>
                      <span>Currently Logged In</span>
                      <div style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                      }}>
                        <i className="ri-graduation-cap-line" style={{ fontSize: 10 }}></i>
                        Administrator
                      </div>
                    </div>
                    <div style={{ 
                      fontSize: 15, 
                      color: '#4a5568',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}>
                      <i className="ri-mail-line" style={{ fontSize: 14, color: '#667eea' }}></i>
                      {currentTeacherEmail}
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <div style={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      padding: '8px 16px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                      border: '2px solid rgba(255, 255, 255, 0.2)'
                    }}>
                      <i className="ri-check-line" style={{ fontSize: 12 }}></i>
                      Active Session
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {loading ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 40px',
                background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                borderRadius: 24,
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(20px)',
                minWidth: 280,
                margin: '40px auto',
                maxWidth: 400
              }}>
                {/* Professional Spinner */}
                <div style={{
                  position: 'relative',
                  width: 56,
                  height: 56,
                  marginBottom: 24
                }}>
                  <div style={{
                    width: '100%',
                    height: '100%',
                    border: '4px solid rgba(79, 163, 126, 0.1)',
                    borderTop: '4px solid #4fa37e',
                    borderRadius: '50%',
                    animation: 'spin 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                    position: 'absolute',
                    top: 0,
                    left: 0
                  }}></div>
                  <div style={{
                    width: '100%',
                    height: '100%',
                    border: '4px solid transparent',
                    borderTop: '4px solid rgba(79, 163, 126, 0.3)',
                    borderRadius: '50%',
                    animation: 'spin 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite reverse',
                    position: 'absolute',
                    top: 0,
                    left: 0
                  }}></div>
                </div>
                
                {/* Professional Text */}
                <h3 style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: '#2c3e50',
                  margin: '0 0 8px 0',
                  textAlign: 'center',
                  letterSpacing: '-0.2px'
                }}>
                  Loading Admin Management
                </h3>
                
                <p style={{
                  fontSize: 14,
                  color: '#6c757d',
                  margin: 0,
                  textAlign: 'center',
                  lineHeight: 1.5,
                  maxWidth: 200
                }}>
                  Fetching admin data and permissions...
                </p>
                
                {/* Progress Indicator */}
                <div style={{
                  display: 'flex',
                  gap: 6,
                  marginTop: 20
                }}>
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#4fa37e',
                    animation: 'pulse 1.4s ease-in-out infinite'
                  }}></div>
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#4fa37e',
                    animation: 'pulse 1.4s ease-in-out infinite 0.2s'
                  }}></div>
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#4fa37e',
                    animation: 'pulse 1.4s ease-in-out infinite 0.4s'
                  }}></div>
                </div>
                
                <style jsx>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                  @keyframes pulse {
                    0%, 100% { 
                      opacity: 0.3; 
                      transform: scale(1); 
                    }
                    50% { 
                      opacity: 1; 
                      transform: scale(1.3); 
                    }
                  }
                `}</style>
              </div>
            ) : (
              <div style={{ 
                background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)', 
                borderRadius: 20, 
                padding: 32,
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: 28
                }}>
                  <h2 style={{ 
                    margin: 0, 
                    fontSize: 28, 
                    color: '#1a202c',
                    fontWeight: 700,
                    letterSpacing: '-0.5px'
                  }}>
                    Staff Accounts
                  </h2>
                  <div style={{
                    background: 'rgba(79, 163, 126, 0.1)',
                    color: '#4fa37e',
                    padding: '8px 16px',
                    borderRadius: 20,
                    fontSize: 14,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <i className="ri-user-line" style={{ fontSize: 16 }}></i>
                    {filteredAdmins.length} Total Staff
                  </div>
                </div>
                
                {filteredAdmins.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '60px 40px', 
                    color: '#6c757d',
                    fontSize: 16,
                    background: 'rgba(79, 163, 126, 0.05)',
                    borderRadius: 16,
                    border: '2px dashed #cbd5e0'
                  }}>
                    <div style={{ fontSize: 48, marginBottom: 16, color: '#a0aec0' }}>
                      <i className="ri-user-add-line"></i>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#4a5568' }}>
                      No Admin Accounts Found
                    </div>
                    <div style={{ fontSize: 14, color: '#718096' }}>
                      Create your first admin account to get started with managing your school system.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                     {adminsAdmins.length > 0 && (
                       <div>
                         {adminsAdmins.map(renderAdminCard)}
                       </div>
                     )}
                     {adminsTeachers.length > 0 && (
                       <div>
                         {adminsTeachers.map(renderAdminCard)}
                       </div>
                     )}
                     {adminsSubs.length > 0 && (
                       <div>
                         {adminsSubs.map(renderAdminCard)}
                       </div>
                     )}
                  </div>
                )}
              </div>
            )}
          </div>

      {/* Create Admin Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: 16,
            padding: 32,
            maxWidth: 500,
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2 style={{
              fontSize: 24,
              fontWeight: 700,
              color: '#2c3e50',
              margin: '0 0 24px 0',
              textAlign: 'center'
            }}>
            Create New Account
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#2c3e50' }}>
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={createForm.firstName}
                    onChange={(e) => setCreateForm({...createForm, firstName: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e9ecef',
                      borderRadius: 8,
                      fontSize: 16
                    }}
                    placeholder="Enter first name"
                  />
                </div>
                
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#2c3e50' }}>
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={createForm.lastName}
                    onChange={(e) => setCreateForm({...createForm, lastName: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e9ecef',
                      borderRadius: 8,
                      fontSize: 16
                    }}
                    placeholder="Enter last name"
                  />
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#2c3e50' }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({...createForm, email: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e9ecef',
                    borderRadius: 8,
                    fontSize: 16
                  }}
                  placeholder="Enter email address"
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#2c3e50' }}>
                  Role *
                </label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({...createForm, role: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e9ecef',
                    borderRadius: 8,
                    fontSize: 16
                  }}
                >
                  <option value={ADMIN_ROLES.SUB_TEACHER}>Sub-Teacher</option>
                  <option value={ADMIN_ROLES.TEACHER}>Teacher</option>
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#2c3e50' }}>
                  Password *
                </label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({...createForm, password: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e9ecef',
                    borderRadius: 8,
                    fontSize: 16
                  }}
                  placeholder="Enter password (min 6 characters)"
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#2c3e50' }}>
                  Confirm Password *
                </label>
                <input
                  type="password"
                  value={createForm.confirmPassword}
                  onChange={(e) => setCreateForm({...createForm, confirmPassword: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e9ecef',
                    borderRadius: 8,
                    fontSize: 16
                  }}
                  placeholder="Confirm password"
                />
              </div>
            </div>
            
            <div style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end',
              marginTop: 24
            }}>
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAdmin}
                className="admin-btn admin-btn--primary"
                style={{ opacity: createLoading ? 0.7 : 1, cursor: createLoading ? 'not-allowed' : 'pointer' }}
                disabled={createLoading}
              >
                {createLoading ? 'Creating...' : 'Create Admin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Admin Confirmation Modal */}
      {showDeleteModal && selectedAdmin && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: 16,
            padding: 32,
            maxWidth: 480,
            width: '90%',
            textAlign: 'center'
          }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: '#dc3545',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 32,
              margin: '0 auto 24px auto'
            }}>
              ⚠️
            </div>
            
            <h3 style={{
              fontSize: 24,
              fontWeight: 700,
              color: '#dc3545',
              margin: '0 0 16px 0'
            }}>
              Delete Admin Account
            </h3>
            
            <p style={{
              fontSize: 16,
              color: '#6c757d',
              margin: '0 0 24px 0',
              lineHeight: 1.5
            }}>
              Are you sure you want to delete <strong>{selectedAdmin.firstName} {selectedAdmin.lastName}</strong>? 
              This action cannot be undone and the admin will lose access to the system.
            </p>
            
            <div style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'center'
            }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAdmin}
                className="admin-btn admin-btn--delete"
              >
                Delete Admin
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Edit Admin Modal */}
      {showEditModal && selectedAdmin && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: 16,
            padding: 32,
            maxWidth: 500,
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2 style={{
              fontSize: 24,
              fontWeight: 700,
              color: '#2c3e50',
              margin: '0 0 24px 0',
              textAlign: 'center'
            }}>
            Edit Account
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#2c3e50' }}>
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({...editForm, firstName: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e9ecef',
                      borderRadius: 8,
                      fontSize: 16
                    }}
                    placeholder="Enter first name"
                  />
                </div>
                
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#2c3e50' }}>
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({...editForm, lastName: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e9ecef',
                      borderRadius: 8,
                      fontSize: 16
                    }}
                    placeholder="Enter last name"
                  />
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#2c3e50' }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e9ecef',
                    borderRadius: 8,
                    fontSize: 16
                  }}
                  placeholder="Enter email address"
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#2c3e50' }}>
                  Role *
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e9ecef',
                    borderRadius: 8,
                    fontSize: 16
                  }}
                >
                  <option value={ADMIN_ROLES.SUB_TEACHER}>Sub-Teacher</option>
                  <option value={ADMIN_ROLES.TEACHER}>Teacher</option>
                </select>
              </div>
            </div>
            
            <div style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end',
              marginTop: 24
            }}>
              <button
                onClick={() => setShowEditModal(false)}
                style={{
                  background: '#f8f9fa',
                  color: '#6c757d',
                  border: '1px solid #e9ecef',
                  borderRadius: 8,
                  padding: '12px 24px',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = '#e9ecef'}
                onMouseOut={(e) => e.target.style.background = '#f8f9fa'}
              >
                Cancel
              </button>
              <button
                onClick={handleEditAdmin}
                style={{
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 24px',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.background = '#218838'}
                onMouseOut={(e) => e.target.style.background = '#28a745'}
              >
                Update Admin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to get permission descriptions
function getPermissionDescription(permission) {
  const descriptions = {
    canManageStudents: 'Create, edit, and delete student records',
    canManageQuizzes: 'Create, edit, and assign quizzes to students',
    canViewAssessments: 'View student assessment results and progress',
    canAccessArchive: 'Access deleted students and quizzes in archive',
    canManageOwnProfile: 'Update personal profile information',
    canViewReports: 'Access system reports and analytics'
  };
  return descriptions[permission] || 'System permission';
}