import { db, collection, addDoc, setDoc, doc, getDocs, getDoc, query, where, updateDoc, deleteDoc, onSnapshot, adminsCollection, teachersCollection, activityLogsCollection } from './firebase';

// Admin roles and their default permissions
export const ADMIN_ROLES = {
  SUB_TEACHER: 'sub_teacher',
  TEACHER: 'teacher',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin'
};

// Default permissions for each role
export const DEFAULT_PERMISSIONS = {
  [ADMIN_ROLES.SUB_TEACHER]: {
    canManageStudents: false,       // Read-only student access
    canViewStudents: true,           // Can view student records
    canManageQuizzes: false,        // Cannot create/edit quizzes
    canViewQuizzes: true,           // Can view quizzes section
    canAssignQuizzes: true,         // Can assign quizzes to students
    canLockUnlockQuizzes: true,     // Can lock/unlock quizzes
    canViewAssessments: true,       // Can view student progress
    canAccessArchive: false,        // Cannot access archive
    canManageOwnProfile: true,      // Can edit own profile
    canViewReports: false,          // Cannot view detailed reports
    canManageOtherUsers: false,     // Cannot manage other users
    canAccessSystemSettings: false, // Cannot access system settings
    canManageRoles: false           // Cannot change user roles
  },
  [ADMIN_ROLES.TEACHER]: {
    canManageStudents: true,        // Full student management access
    canViewStudents: true,          // Can view student records
    canManageQuizzes: true,         // Full quiz management
    canViewQuizzes: true,           // Can view quizzes section
    canAssignQuizzes: true,         // Can assign quizzes to students
    canLockUnlockQuizzes: true,     // Can lock/unlock quizzes
    canViewAssessments: true,       // View all assessments
    canAccessArchive: true,         // Full archive access
    canManageOwnProfile: true,      // Edit own profile
    canViewReports: true,           // Can view detailed reports
    canManageOtherUsers: false,     // Cannot manage other users
    canAccessSystemSettings: false, // Cannot access system settings
    canManageRoles: false           // Cannot change user roles
  },
  [ADMIN_ROLES.ADMIN]: {
    canManageStudents: true,        // Full student management
    canViewStudents: true,           // Can view student records
    canManageQuizzes: true,         // Full quiz management
    canViewQuizzes: true,           // Can view quizzes section
    canAssignQuizzes: true,         // Can assign quizzes to students
    canLockUnlockQuizzes: true,     // Can lock/unlock quizzes
    canViewAssessments: true,       // View all assessments
    canAccessArchive: true,         // Full archive access
    canManageOwnProfile: true,      // Edit own profile
    canViewReports: true,           // View all reports
    canManageOtherUsers: true,      // Can manage other users
    canAccessSystemSettings: true,  // Can access system settings
    canManageRoles: true            // Can change user roles
  },
  [ADMIN_ROLES.SUPER_ADMIN]: {
    canManageStudents: true,
    canViewStudents: true,
    canManageQuizzes: true,
    canViewQuizzes: true,
    canAssignQuizzes: true,
    canLockUnlockQuizzes: true,
    canViewAssessments: true,
    canAccessArchive: true,
    canManageOwnProfile: true,
    canViewReports: true,
    canManageOtherUsers: true,
    canAccessSystemSettings: true,
    canManageRoles: true
  }
};

// Function to check if admin already exists
export const getAdminByEmail = async (email) => {
  try {
    const q = query(adminsCollection(), where('email', '==', email));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error checking admin existence:', error);
    return null;
  }
};

// Function to update last login time
export const updateLastLogin = async (email) => {
  try {
    const q = query(adminsCollection(), where('email', '==', email));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const adminDoc = querySnapshot.docs[0];
      await updateDoc(adminDoc.ref, {
        lastLogin: new Date().toISOString()
      });
      console.log('Last login updated for:', email);
    }
  } catch (error) {
    console.error('Error updating last login:', error);
  }
};

// Function to create a new admin account
export const createAdmin = async (adminData, createdBySuperAdmin) => {
  try {
    // Validate required fields
    if (!adminData.email || !adminData.password || !adminData.firstName || !adminData.lastName) {
      throw new Error('Missing required fields');
    }

    // Check if admin already exists
    const existingAdmin = await getAdminByEmail(adminData.email);
    if (existingAdmin) {
      throw new Error('Admin with this email already exists');
    }

    // Create admin document data
    const adminDoc = {
      firstName: adminData.firstName,
      lastName: adminData.lastName,
      email: adminData.email,
      role: adminData.role || ADMIN_ROLES.SUB_TEACHER,
      status: 'active',
      permissions: DEFAULT_PERMISSIONS[adminData.role] || DEFAULT_PERMISSIONS[ADMIN_ROLES.SUB_TEACHER],
      createdAt: new Date().toISOString(),
      createdBy: createdBySuperAdmin,
      lastLogin: null,
      avatar: adminData.avatar || '/TeacherProfile.png'
    };

    // Create admin in admins collection
    const adminRef = await addDoc(adminsCollection(), adminDoc);

    // Create login credentials in authentication collection
    const loginCredentials = {
      email: adminData.email,
      password: adminData.password, // In production, this should be hashed
      role: adminData.role || ADMIN_ROLES.SUB_TEACHER,
      isActive: true,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      adminId: adminRef.id
    };

    // Store in authentication collection (you can rename this collection as needed)
    await addDoc(teachersCollection(), loginCredentials);

    // Create a notification for the super admin
    // await addNotification(createdBySuperAdmin, 'admin_created', `Admin ${adminData.firstName} ${adminData.lastName} created successfully`);

    return adminRef.id;
  } catch (error) {
    console.error('Error creating admin:', error);
    throw error;
  }
};

// Function to get all admins
export const getAllAdmins = async () => {
  try {
    const querySnapshot = await getDocs(adminsCollection());
    const admins = [];
    querySnapshot.forEach((doc) => {
      admins.push({ id: doc.id, ...doc.data() });
    });
    return admins.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (error) {
    console.error('Error fetching admins:', error);
    throw new Error('Failed to fetch admin list');
  }
};

// Function to update admin permissions
export const updateAdminPermissions = async (adminId, newPermissions, updatedBySuperAdmin) => {
  try {
    await updateDoc(doc(adminsCollection(), adminId), {
      permissions: newPermissions,
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBySuperAdmin
    });

    // Log permission update activity
    await addDoc(activityLogsCollection(), {
      adminId: updatedBySuperAdmin,
      action: 'permissions_updated',
      details: {
        targetAdminId: adminId,
        newPermissions: newPermissions
      },
      timestamp: new Date().toISOString()
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating admin permissions:', error);
    throw new Error('Failed to update admin permissions');
  }
};

// Helper function to get admin email by ID
const getAdminEmailById = async (adminId) => {
  try {
    const adminDoc = await getDoc(doc(adminsCollection(), adminId));
    if (adminDoc.exists()) {
      return adminDoc.data().email;
    }
    return null;
  } catch (error) {
    console.error('Error getting admin email by ID:', error);
    return null;
  }
};

// Function to deactivate/reactivate admin
export const toggleAdminStatus = async (adminId, newStatus, updatedBySuperAdmin) => {
  try {
    // Update admins collection
    await updateDoc(doc(adminsCollection(), adminId), {
      status: newStatus,
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBySuperAdmin
    });

    // Also update teachers collection (used by login)
    const adminEmail = await getAdminEmailById(adminId);
    
    if (adminEmail) {
      // Find the corresponding teacher credential record
      const teacherQuery = query(teachersCollection(), where('email', '==', adminEmail));
      const teacherSnapshot = await getDocs(teacherQuery);
      
      if (!teacherSnapshot.empty) {
        const isActiveValue = newStatus === 'active';
        
        // Update ALL teacher credential records for this email
        const updatePromises = teacherSnapshot.docs.map(async (teacherDoc) => {
          await updateDoc(doc(teachersCollection(), teacherDoc.id), {
            isActive: isActiveValue,
            updatedAt: new Date().toISOString()
          });
        });
        
        // Wait for all updates to complete
        await Promise.all(updatePromises);
      }
    }

    // Log status change activity
    await addDoc(activityLogsCollection(), {
      adminId: updatedBySuperAdmin,
      action: 'admin_status_changed',
      details: {
        targetAdminId: adminId,
        newStatus: newStatus
      },
      timestamp: new Date().toISOString()
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating admin status:', error);
    throw new Error('Failed to update admin status');
  }
};

// Function to delete admin (soft delete)
export const deleteAdmin = async (adminId, deletedBySuperAdmin) => {
  try {
    // Fetch the admin document so we can archive it before deletion
    const adminRef = doc(adminsCollection(), adminId);
    const adminSnap = await getDoc(adminRef);

    if (adminSnap.exists()) {
      const adminData = adminSnap.data();

      // Write to deleted_admins archive collection
      await addDoc(collection(db, 'deleted_admins'), {
        originalId: adminId,
        originalData: adminData,
        deletedAt: new Date().toISOString(),
        deletedBy: deletedBySuperAdmin
      });
    }

    // Delete from main collection
    await deleteDoc(adminRef);

    // Log deletion activity
    await addDoc(activityLogsCollection(), {
      adminId: deletedBySuperAdmin,
      action: 'admin_deleted',
      details: {
        deletedAdminId: adminId,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });

    return { success: true };
  } catch (error) {
    console.error('Error deleting admin:', error);
    throw new Error('Failed to delete admin account');
  }
};

// Function to check if user is super admin
export const isSuperAdmin = (userEmail) => {
  // First honor persisted role if available
  try {
    const storedRole = typeof window !== 'undefined' ? localStorage.getItem('teacherRole') : null;
    if (storedRole === ADMIN_ROLES.SUPER_ADMIN) return true;
  } catch (_) {}

  // Fallback to email allowlist
  const superAdminEmails = [
    'principal@school.com', 
    'superadmin@school.com',
    'tester@tester.com'
  ];
  const isSuper = superAdminEmails.includes(userEmail);
  console.log('isSuperAdmin check:', { userEmail, superAdminEmails, isSuper });
  return isSuper;
};

// Function to validate admin permissions
export const hasPermission = (adminPermissions, permission) => {
  if (!adminPermissions) return false;
  return adminPermissions[permission] === true;
};

// Add a comprehensive permission checker for the entire app
export const checkUserPermissions = (userRole, userPermissions, action) => {
  // Super admin has all permissions
  if (userRole === ADMIN_ROLES.SUPER_ADMIN) {
    return true;
  }
  
  // If no permissions object, deny access
  if (!userPermissions) {
    return false;
  }
  
  // Map actions to permissions
  const actionPermissionMap = {
    // Student management
    'add_student': 'canManageStudents',
    'edit_student': 'canManageStudents', 
    'delete_student': 'canManageStudents',
    'import_students': 'canManageStudents',
    'view_students': 'canViewStudents',
    'manage_sections': 'canManageStudents',
    
    // Quiz management
    'create_quiz': 'canManageQuizzes',
    'edit_quiz': 'canManageQuizzes',
    'delete_quiz': 'canManageQuizzes',
    'assign_quiz': 'canAssignQuizzes',
    'lock_unlock_quiz': 'canLockUnlockQuizzes',
    'view_quizzes': 'canViewQuizzes',
    
    // Assessment and reports
    'view_assessments': 'canViewAssessments',
    'view_reports': 'canViewReports',
    'view_progress': 'canViewAssessments',
    
    // Archive access
    'access_archive': 'canAccessArchive',
    'restore_item': 'canAccessArchive',
    'permanently_delete': 'canAccessArchive',
    'view_archive_quizzes': 'canAccessArchive',
    'view_archive_students': 'canManageStudents',
    'view_archive_sections': 'canManageStudents',
    'view_archive_admins': 'canManageOtherUsers',
    
    // User management
    'manage_users': 'canManageOtherUsers',
    'change_roles': 'canManageRoles',
    'admin_access': 'canManageOtherUsers',
    
    // System settings
    'access_settings': 'canAccessSystemSettings',
    
    // Profile management (always allowed)
    'manage_profile': 'canManageOwnProfile'
  };
  
  const requiredPermission = actionPermissionMap[action];
  if (!requiredPermission) {
    return false;
  }
  
  const hasPermission = userPermissions[requiredPermission] === true;
  return hasPermission;
};

// Function to get admin activity log
export const getAdminActivityLog = async (limit = 50) => {
  try {
    const querySnapshot = await getDocs(activityLogsCollection());
    const activities = [];
    querySnapshot.forEach((doc) => {
      activities.push({ id: doc.id, ...doc.data() });
    });
    return activities
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching admin activity:', error);
    throw new Error('Failed to fetch activity log');
  }
};
