'use client';


//-----------------Firebase tools, auth, router, and teacher context ------------------//

import Link from 'next/link';
import Image from 'next/image';
import styles from './login.module.css';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { db, collection, getDocs, query, where, teachersCollection, adminsCollection } from '../../lib/firebase';
import { auth, signInWithEmailAndPassword } from '../../lib/firebase';
import { useRouter } from 'next/navigation';
import { useTeacher } from '../../lib/Teacher-SPCC';
import { updateLastLogin, DEFAULT_PERMISSIONS, ADMIN_ROLES } from '../../lib/adminUtils'; 

//----------------- Client-only form component to prevent hydration issues ------------------//
function LoginForm({ 
  email, 
  setEmail, 
  password, 
  setPassword, 
  handleLogin, 
  loading, 
  error, 
  showLogin, 
  setShowLogin 
}) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className={`${styles.formContainer} max-w-sm w-full mx-auto md:mx-0`}>
        <div className={`${styles.loginCard} ${styles.formCard}`}>
          <h2>Login</h2>
          <div style={{ height: '44px', background: '#f0f0f0', borderRadius: '8px', marginBottom: '16px' }}></div>
          <div style={{ height: '44px', background: '#f0f0f0', borderRadius: '8px', marginBottom: '16px' }}></div>
          <div style={{ height: '44px', background: '#f0f0f0', borderRadius: '8px' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.formContainer} max-w-sm w-full mx-auto md:mx-0`}>
      {showLogin ? (
        <div className={`${styles.loginCard} ${styles.formCard}`}>
          <h2>Login</h2>
          <input 
            placeholder="User ID" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            suppressHydrationWarning={true}
            autoComplete="username"
          />

          <input 
            type="password" 
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            suppressHydrationWarning={true}
            autoComplete="current-password"
          />

          <button 
            className={`${styles.formButton} min-h-[44px] text-base`} 
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
          {error && <p style={{ color: 'yellow' }}>{error}</p>}
        </div>
      ) : (
        <div className={`${styles.createCard} ${styles.formCard}`}>
          <h2>Create Account</h2>
          <input placeholder="User ID" />
          <input placeholder="First Name" />
          <input placeholder="Last Name" />
          <input type="password" placeholder="Password" />
          <button className={styles.formButton}>Create Account</button>
          <p>Already have an account? <a onClick={() => setShowLogin(true)}>Login</a></p>
        </div>
      )}
    </div>
  );
}

//----------------- Handle login, save user info, and show errors ------------------//
export default function LoginPage() {
  const [showLogin, setShowLogin] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const drawerRef = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const router = useRouter();
  const { setTeacherEmail } = useTeacher();

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    setShowLoadingScreen(true);
  
    try {
      // First, try to authenticate as an admin from teacher_credentials
      try {
        console.log('Attempting admin authentication for:', email);
        
        const adminQuery = query(teachersCollection(), where('email', '==', email));
        const adminSnapshot = await getDocs(adminQuery);
        
        if (!adminSnapshot.empty) {
          const adminData = adminSnapshot.docs[0].data();
          console.log('Admin account found:', adminData.email, 'Role:', adminData.role);
          
          // Check if admin is active
          if (adminData.isActive !== true) {
            throw new Error('Account is deactivated');
          }
          
          // Verify password
          if (adminData.password === password) {
            console.log('Admin authentication successful');
            
            // Always use default permissions for the role (ignore database permissions)
            const defaultPermissions = DEFAULT_PERMISSIONS[adminData.role] || DEFAULT_PERMISSIONS[ADMIN_ROLES.SUB_TEACHER];
            
            // Admin authentication successful with default permissions
            localStorage.setItem('teacherLoggedIn', 'true');
            localStorage.setItem('teacherEmail', adminData.email);
            localStorage.setItem('teacherRole', adminData.role);
            localStorage.setItem('teacherPermissions', JSON.stringify(defaultPermissions));
            setTeacherEmail(adminData.email);
            
            // Update last login time
            await updateLastLogin(adminData.email);
            
            setLoading(false);
            router.push('/dashboard');
            return;
          } else {
            console.log('Admin password mismatch');
            throw new Error('Invalid password');
          }
        } else {
          console.log('No admin account found, trying Firebase auth');
        }
      } catch (adminError) {
        console.log('Admin auth failed:', adminError.message);
        // If admin account exists but is deactivated, don't try Firebase auth
        if (adminError.message.includes('Account is deactivated')) {
          throw adminError; // Re-throw the deactivation error
        }
        // Continue to Firebase auth for other admin errors
      }

      // Regular Firebase authentication
      console.log('Attempting Firebase authentication for:', email);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('Firebase authentication successful');
      
      // Set super admin role and permissions for Firebase auth users
      const superAdminPermissions = {
        canManageStudents: true,
        canManageQuizzes: true,
        canViewAssessments: true,
        canAccessArchive: true,
        canManageOwnProfile: true,
        canViewReports: true,
        canManageOtherUsers: true,
        canAccessSystemSettings: true,
        canManageRoles: true
      };
      
      console.log('Setting super admin permissions:', superAdminPermissions);
      
      localStorage.setItem('teacherLoggedIn', 'true');
      localStorage.setItem('teacherEmail', user.email);
      localStorage.setItem('teacherRole', 'super_admin');
      localStorage.setItem('teacherPermissions', JSON.stringify(superAdminPermissions));
      setTeacherEmail(user.email);

      setLoading(false);
      router.push('/dashboard');
    } catch (error) {
      setLoading(false);
      setShowLoadingScreen(false);
      console.error('Login error:', error);
      
      // More specific error messages
      console.log('Error message:', error.message); // Debug log
      if (error.message.includes('Invalid password')) {
        setError('Invalid password. Please try again.');
      } else if (error.message.includes('Account is deactivated')) {
        setError('This account has been deactivated. Please contact your administrator.');
      } else if (error.message.includes('Account is not active')) {
        setError('This account has been deactivated. Please contact your administrator.');
      } else if (error.message.includes('user-not-found')) {
        setError('Account not found. Please check your email.');
      } else if (error.message.includes('wrong-password')) {
        setError('Invalid password. Please try again.');
      } else {
        setError('Login failed. Please check your credentials and try again.');
      }
    }
  };

//----------------- HTML ------------------//

  return (
    <div className={styles.page}>
      {/* NAVBAR */}
      <nav className={`${styles.navbar} md:flex md:items-center md:justify-between`}>
        <Link href="/homepage" className={styles.logo}>
          <Image src="/logo2.png" alt="AGHAM Logo" width={40} height={40} />
          <h1>AGHAM</h1>
        </Link>
        {/* Mobile hamburger */}
        <button
          className="md:hidden text-white text-2xl p-2 rounded focus:outline-none"
          aria-label="Open menu"
          onClick={() => setIsMenuOpen(true)}
        >
          ☰
        </button>
        {/* Desktop links */}
        <ul className={`${styles.navLinks} hidden md:flex`}>
          <li><Link href="/homepage">Home</Link></li>
          <li className={styles.active}><Link href="/homepage/login">Login</Link></li>
          <li><Link href="/homepage/about">About</Link></li>
          <li><Link href="/homepage/credit">Credits</Link></li>
        </ul>
      </nav>

      {/* Mobile drawer menu */}
      {isMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsMenuOpen(false)} />
          <div ref={drawerRef} className="absolute right-0 top-0 h-full w-72 bg-[#3f5d54] text-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Image src="/logo2.png" alt="AGHAM Logo" width={32} height={32} />
                <span className="font-semibold text-lg">AGHAM</span>
              </div>
              <button className="text-2xl p-2" aria-label="Close menu" onClick={() => setIsMenuOpen(false)}>×</button>
            </div>
            <ul className="space-y-4 text-base">
              <li><Link href="/homepage" onClick={() => setIsMenuOpen(false)}>Home</Link></li>
              <li><Link href="/homepage/login" onClick={() => setIsMenuOpen(false)}>Login</Link></li>
              <li><Link href="/homepage/about" onClick={() => setIsMenuOpen(false)}>About</Link></li>
              <li><Link href="/homepage/credit" onClick={() => setIsMenuOpen(false)}>Credits</Link></li>
            </ul>
          </div>
        </div>
      )}

      {/* MAIN SECTION */}
      <div className={`${styles.mainSection} px-4 py-8 md:px-0 md:py-0`}>
        {/* LEFT TEXT */}
        <div className={`${styles.left} max-md:text-center`}>
          <h1 className="text-2xl md:text-4xl font-bold">Welcome Teacher!</h1>
          <p className="text-base md:text-lg">
            Log in to manage your students, track their quiz scores, and guide them through engaging lessons
            with interactive AR models in Grade 6 Science.
          </p>
        </div>

        {/* RIGHT FORM */}
        <LoginForm 
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          handleLogin={handleLogin}
          loading={loading}
          error={error}
          showLogin={showLogin}
          setShowLogin={setShowLogin}
        />
      </div>

      {/* Login Loading Screen */}
      {showLoadingScreen && (
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
              borderTop: '4px solid #3f5d54',
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
              Logging In...
            </h3>
            
            <p style={{
              margin: 0,
              fontSize: 16,
              color: '#6c757d',
              lineHeight: 1.5
            }}>
              Please wait while we authenticate your account
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
