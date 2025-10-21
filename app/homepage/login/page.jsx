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
  setShowLogin,
  showSuccess,
  setShowSuccess,
  countdown,
  setCountdown
}) {
  const [isClient, setIsClient] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Form validation
  const validateForm = () => {
    const errors = {};
    
    if (!email.trim()) {
      errors.email = 'User ID is required';
    } else if (email.length < 3) {
      errors.email = 'User ID must be at least 3 characters';
    }
    
    if (!password.trim()) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Enhanced form submission
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    setValidationErrors({});
    
    try {
      const result = await handleLogin(e);
      // After successful login, show success modal
      if (result && result.success) {
        setShowSuccess(true);
        setCountdown(4);
        
        // Countdown effect
        const countdownInterval = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(countdownInterval);
              setShowSuccess(false);
              // Use setTimeout to defer the navigation to avoid setState during render
              setTimeout(() => {
                router.push('/dashboard');
              }, 0);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
      
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <form className={`${styles.loginCard} ${styles.formCard}`} onSubmit={handleFormSubmit}>
          <h2>Login</h2>
          
          <div className={styles.inputGroup}>
            <div className={styles.inputWrapper}>
              <input 
                placeholder="User ID" 
                value={email} 
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (validationErrors.email) {
                    setValidationErrors(prev => ({ ...prev, email: '' }));
                  }
                }}
                suppressHydrationWarning={true}
                autoComplete="username"
                className={validationErrors.email ? styles.inputError : ''}
              />
              <span className={styles.inputIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
            </div>
            {validationErrors.email && (
              <div className={styles.errorMessage}>
                <span className={styles.errorIcon}>⚠️</span>
                {validationErrors.email}
              </div>
            )}
          </div>

          <div className={styles.inputGroup}>
            <div className={styles.inputWrapper}>
              <input 
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (validationErrors.password) {
                    setValidationErrors(prev => ({ ...prev, password: '' }));
                  }
                }}
                suppressHydrationWarning={true}
                autoComplete="current-password"
                className={validationErrors.password ? styles.inputError : ''}
              />
              <span className={styles.inputIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <button 
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
            {validationErrors.password && (
              <div className={styles.errorMessage}>
                <span className={styles.errorIcon}>⚠️</span>
                {validationErrors.password}
              </div>
            )}
          </div>

          <button 
            type="submit"
            className={`${styles.formButton} ${isSubmitting ? styles.buttonLoading : ''}`}
            disabled={loading || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className={styles.spinner}></span>
                Logging in...
              </>
            ) : (
              'Login'
            )}
          </button>

          
          {error && (
            <div className={styles.errorMessageMain}>
              <span className={styles.errorIcon}>❌</span>
              {error}
            </div>
          )}

          {showSuccess && (
            <div className={styles.successMessage}>
              <span className={styles.successIcon}>✅</span>
              <div className={styles.successContent}>
                <div className={styles.successTitle}>Login Successful!</div>
                <div className={styles.successSubtitle}>
                  Redirecting to dashboard in {countdown} seconds...
                </div>
              </div>
            </div>
          )}
        </form>
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
  const [showSuccess, setShowSuccess] = useState(false);
  const [countdown, setCountdown] = useState(0);
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
            setShowLoadingScreen(false);
            return { success: true }; // Return success instead of redirecting
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
      setShowLoadingScreen(false);
      return { success: true }; // Return success instead of redirecting
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
      {/* Rotating Molecular Structures */}
      <div className={styles.moleculeGroup1}>
        <svg className={styles.molecule} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="8" stroke="rgba(0,0,0,0.8)" strokeWidth="4" fill="none"/>
          <circle cx="30" cy="30" r="6" stroke="rgba(0,0,0,0.8)" strokeWidth="3" fill="none"/>
          <circle cx="70" cy="30" r="6" stroke="rgba(0,0,0,0.8)" strokeWidth="3" fill="none"/>
          <circle cx="30" cy="70" r="6" stroke="rgba(0,0,0,0.8)" strokeWidth="3" fill="none"/>
          <circle cx="70" cy="70" r="6" stroke="rgba(0,0,0,0.8)" strokeWidth="3" fill="none"/>
          <circle cx="20" cy="50" r="4" stroke="rgba(0,0,0,0.7)" strokeWidth="2" fill="none"/>
          <circle cx="80" cy="50" r="4" stroke="rgba(0,0,0,0.7)" strokeWidth="2" fill="none"/>
          <line x1="50" y1="50" x2="30" y2="30" stroke="rgba(0,0,0,0.7)" strokeWidth="3"/>
          <line x1="50" y1="50" x2="70" y2="30" stroke="rgba(0,0,0,0.7)" strokeWidth="3"/>
          <line x1="50" y1="50" x2="30" y2="70" stroke="rgba(0,0,0,0.7)" strokeWidth="3"/>
          <line x1="50" y1="50" x2="70" y2="70" stroke="rgba(0,0,0,0.7)" strokeWidth="3"/>
          <line x1="50" y1="50" x2="20" y2="50" stroke="rgba(0,0,0,0.6)" strokeWidth="2"/>
          <line x1="50" y1="50" x2="80" y2="50" stroke="rgba(0,0,0,0.6)" strokeWidth="2"/>
        </svg>
      </div>

      <div className={styles.moleculeGroup2}>
        <svg className={styles.molecule} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="8" stroke="rgba(0,0,0,0.8)" strokeWidth="4" fill="none"/>
          <circle cx="30" cy="30" r="6" stroke="rgba(0,0,0,0.8)" strokeWidth="3" fill="none"/>
          <circle cx="70" cy="30" r="6" stroke="rgba(0,0,0,0.8)" strokeWidth="3" fill="none"/>
          <circle cx="30" cy="70" r="6" stroke="rgba(0,0,0,0.8)" strokeWidth="3" fill="none"/>
          <circle cx="70" cy="70" r="6" stroke="rgba(0,0,0,0.8)" strokeWidth="3" fill="none"/>
          <circle cx="20" cy="50" r="4" stroke="rgba(0,0,0,0.7)" strokeWidth="2" fill="none"/>
          <circle cx="80" cy="50" r="4" stroke="rgba(0,0,0,0.7)" strokeWidth="2" fill="none"/>
          <line x1="50" y1="50" x2="30" y2="30" stroke="rgba(0,0,0,0.7)" strokeWidth="3"/>
          <line x1="50" y1="50" x2="70" y2="30" stroke="rgba(0,0,0,0.7)" strokeWidth="3"/>
          <line x1="50" y1="50" x2="30" y2="70" stroke="rgba(0,0,0,0.7)" strokeWidth="3"/>
          <line x1="50" y1="50" x2="70" y2="70" stroke="rgba(0,0,0,0.7)" strokeWidth="3"/>
          <line x1="50" y1="50" x2="20" y2="50" stroke="rgba(0,0,0,0.6)" strokeWidth="2"/>
          <line x1="50" y1="50" x2="80" y2="50" stroke="rgba(0,0,0,0.6)" strokeWidth="2"/>
        </svg>
      </div>

      <div className={styles.moleculeGroup3}>
        <svg className={styles.molecule} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="8" stroke="rgba(0,0,0,0.8)" strokeWidth="4" fill="none"/>
          <circle cx="30" cy="30" r="6" stroke="rgba(0,0,0,0.8)" strokeWidth="3" fill="none"/>
          <circle cx="70" cy="30" r="6" stroke="rgba(0,0,0,0.8)" strokeWidth="3" fill="none"/>
          <circle cx="30" cy="70" r="6" stroke="rgba(0,0,0,0.8)" strokeWidth="3" fill="none"/>
          <circle cx="70" cy="70" r="6" stroke="rgba(0,0,0,0.8)" strokeWidth="3" fill="none"/>
          <circle cx="20" cy="50" r="4" stroke="rgba(0,0,0,0.7)" strokeWidth="2" fill="none"/>
          <circle cx="80" cy="50" r="4" stroke="rgba(0,0,0,0.7)" strokeWidth="2" fill="none"/>
          <line x1="50" y1="50" x2="30" y2="30" stroke="rgba(0,0,0,0.7)" strokeWidth="3"/>
          <line x1="50" y1="50" x2="70" y2="30" stroke="rgba(0,0,0,0.7)" strokeWidth="3"/>
          <line x1="50" y1="50" x2="30" y2="70" stroke="rgba(0,0,0,0.7)" strokeWidth="3"/>
          <line x1="50" y1="50" x2="70" y2="70" stroke="rgba(0,0,0,0.7)" strokeWidth="3"/>
          <line x1="50" y1="50" x2="20" y2="50" stroke="rgba(0,0,0,0.6)" strokeWidth="2"/>
          <line x1="50" y1="50" x2="80" y2="50" stroke="rgba(0,0,0,0.6)" strokeWidth="2"/>
        </svg>
      </div>

      {/* Clean Floating Science Elements */}
      <div className={styles.floatingElements}>
        <div className={styles.floatingElement}>🧪</div>
        <div className={styles.floatingElement}>🔬</div>
        <div className={styles.floatingElement}>⚗️</div>
        <div className={styles.floatingElement}>🧬</div>
        <div className={styles.floatingElement}>⚛️</div>
        <div className={styles.floatingElement}>🔭</div>
        <div className={styles.floatingElement}>💡</div>
        <div className={styles.floatingElement}>⭐</div>
        <div className={styles.floatingElement}>🌙</div>
        <div className={styles.floatingElement}>☀️</div>
      </div>

      

      {/* Corner student illustration */}
      <img src="/Boy student.png" alt="Student" className={styles.cornerBoy} />
      {/* Corner teacher illustration */}
      <img src="/Teacher.png" alt="Teacher" className={styles.cornerTeacher} />

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
      <div className={styles.mainSection}>
        <div className={styles.loginContainer}>
          {/* LEFT CONTENT - WELCOME SECTION */}
          <div className={styles.leftContent}>
            <div className={styles.welcomeSection}>
              <h1 className={styles.welcomeTitle}>
                Welcome Teacher!
              </h1>
              <p className={styles.welcomeText}>
                Log in to manage your students, track their quiz scores, and guide them through engaging lessons
                in Grade 6 Science.
              </p>
              <div className={styles.featuresList}>
                <div className={styles.feature}>
                  <span className={styles.featureIcon}>👥</span>
                  <span>Student Management</span>
                </div>
                <div className={styles.feature}>
                  <span className={styles.featureIcon}>📊</span>
                  <span>Progress Tracking</span>
                </div>
                <div className={styles.feature}>
                  <span className={styles.featureIcon}>📝</span>
                  <span>Quiz Management</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT CONTENT - LOGIN FORM */}
          <div className={styles.rightContent}>
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
              showSuccess={showSuccess}
              setShowSuccess={setShowSuccess}
              countdown={countdown}
              setCountdown={setCountdown}
            />
          </div>
        </div>
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
            {/* Success Icon or Loading Spinner */}
            {showSuccess ? (
              <div style={{
                fontSize: 60,
                margin: '0 auto 20px auto',
                animation: 'bounce 0.8s ease-in-out'
              }}>
                ✅
              </div>
            ) : (
              <div style={{
                width: 60,
                height: 60,
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #3f5d54',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 20px auto'
              }}></div>
            )}
            
            {/* Success or Loading Text */}
            <h3 style={{
              margin: '0 0 10px 0',
              fontSize: 24,
              fontWeight: 700,
              color: showSuccess ? '#22c55e' : '#2c3e50'
            }}>
              {showSuccess ? 'Login Successful!' : 'Logging In...'}
            </h3>
            
            <p style={{
              margin: 0,
              fontSize: 16,
              color: '#6c757d',
              lineHeight: 1.5
            }}>
              {showSuccess ? `Welcome back! Redirecting to dashboard in ${countdown} seconds...` : 'Please wait while we authenticate your account'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
