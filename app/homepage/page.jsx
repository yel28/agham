  'use client';

  import { useEffect, useRef, useState } from 'react';
  import { usePathname } from 'next/navigation';
  import Link from 'next/link';
  import Image from 'next/image';
import styles from './homepage.module.css';

  export default function HomePage() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [apkMeta, setApkMeta] = useState({ sizeMB: '', updated: '' });
    const pathname = usePathname();
    const drawerRef = useRef(null);

    // Accessibility: prevent body scroll and close on ESC; basic focus handling
    useEffect(() => {
      if (isMenuOpen) {
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const handleKey = (e) => {
          if (e.key === 'Escape') setIsMenuOpen(false);
          if (e.key === 'Tab' && drawerRef.current) {
            const focusable = drawerRef.current.querySelectorAll('a, button');
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        };
        document.addEventListener('keydown', handleKey);
        // focus first link on open
        setTimeout(() => {
          const firstLink = drawerRef.current?.querySelector('a');
          firstLink?.focus?.();
        }, 0);
        return () => {
          document.body.style.overflow = previous;
          document.removeEventListener('keydown', handleKey);
        };
      }
    }, [isMenuOpen]);

    // Lightweight confetti burst on Download click
    useEffect(() => {
      const btn = document.getElementById('download-apk-btn');
      const canvas = document.getElementById('confetti-canvas');
      if (!btn || !canvas) return;
      
      const ctx = canvas.getContext('2d');
      let raf = null;
      let timeoutId = null;
      
      function burst() {
        const particles = Array.from({ length: 80 }).map(() => ({
          x: canvas.width / 2,
          y: canvas.height / 2,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.8) * 6 - 2,
          g: 0.12 + Math.random() * 0.08,
          s: 2 + Math.random() * 2,
          a: 1,
          c: ['#3b82f6','#10b981','#f59e0b','#ef4444'][Math.floor(Math.random()*4)]
        }));
        const start = performance.now();
        function step(t) {
          const dt = Math.min((t - start) / 1000, 3);
          ctx.clearRect(0,0,canvas.width,canvas.height);
          particles.forEach(p => {
            p.vy += p.g;
            p.x += p.vx;
            p.y += p.vy;
            p.a -= 0.01;
            ctx.globalAlpha = Math.max(p.a, 0);
            ctx.fillStyle = p.c;
            ctx.fillRect(p.x, p.y, p.s, p.s);
          });
          if (dt < 2) raf = requestAnimationFrame(step);
        }
        raf = requestAnimationFrame(step);
        timeoutId = setTimeout(() => {
          if (raf) cancelAnimationFrame(raf);
          raf = null;
        }, 2200);
      }
      
      function handleClick() {
        // Resize canvas to hero card box for correct origin
        const hero = document.querySelector(`.${styles.heroCard}`);
        const rect = hero ? hero.getBoundingClientRect() : document.body.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        canvas.style.left = '0px';
        canvas.style.top = '0px';
        burst();
      }
      
      btn.addEventListener('click', handleClick);
      
      return () => {
        btn.removeEventListener('click', handleClick);
        if (raf) cancelAnimationFrame(raf);
        if (timeoutId) clearTimeout(timeoutId);
      };
    }, []);

    // Try to fetch APK meta (size and last-modified) for the meta line
    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const res = await fetch('/api/download-apk', { method: 'HEAD' });
          const len = res.headers.get('content-length');
          const lm = res.headers.get('last-modified');
          let sizeMB = '';
          if (len) {
            const mb = (parseInt(len, 10) / (1024 * 1024));
            sizeMB = mb > 0 ? `${mb.toFixed(1)} MB` : '';
          }
          let updated = '';
          if (lm) {
            const d = new Date(lm);
            updated = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
          }
          if (!cancelled) setApkMeta({ sizeMB, updated });
        } catch (_) {}
      })();
      return () => { cancelled = true; };
    }, []);

  return (
    <div className={`${styles.page} overflow-x-hidden`}>
      {/* Corner boy student illustration */}
      <img src="/Boy student.png" alt="Student" className={styles.cornerBoy} />
      {/* Corner teacher illustration */}
      <img src="/Teacher.png" alt="Teacher" className={styles.cornerTeacher} />
      {/* Floating Science Elements */}
      <div className={styles.floatingElements}>
        <div className={styles.floatingElement}>🧪</div>
        <div className={styles.floatingElement}>⚗️</div>
        <div className={styles.floatingElement}>🌋</div>
        <div className={styles.floatingElement}>💫</div>
        <div className={styles.floatingElement}>🧬</div>
        <div className={styles.floatingElement}>⚛️</div>
        <div className={styles.floatingElement}>🌡️</div>
        <div className={styles.floatingElement}>🔭</div>
        <div className={styles.floatingElement}>🧲</div>
        <div className={styles.floatingElement}>⚡</div>
        <div className={styles.floatingElement}>🌊</div>
        <div className={styles.floatingElement}>🔥</div>
        <div className={styles.floatingElement}>❄️</div>
        <div className={styles.floatingElement}>🌍</div>
        <div className={styles.floatingElement}>🪐</div>
        <div className={styles.floatingElement}>⭐</div>
        <div className={styles.floatingElement}>🌙</div>
        <div className={styles.floatingElement}>☀️</div>
        <div className={styles.floatingElement}>🌱</div>
        <div className={styles.floatingElement}>🦠</div>
        <div className={styles.floatingElement}>🧫</div>
        <div className={styles.floatingElement}>🔋</div>
        <div className={styles.floatingElement}>🧮</div>
      </div>

      {/* Science Line Art Background Elements */}
      <div className={styles.scienceLineArt}>
        {/* Beakers and Flasks */}
        <div className={styles.beakerGroup}>
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

        {/* Volcano */}
        <div className={styles.volcanoGroup}>
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

        {/* Molecular Structure */}
        <div className={styles.moleculeGroup}>
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

      
      </div>

      {/* NAVBAR */}
        <nav className={`${styles.navbar} md:flex md:items-center md:justify-between`}>
          <Link href="/homepage" className={`${styles.logo} flex items-center gap-2 cursor-pointer`}>
            <Image src="/logo2.png" alt="AGHAM Logo" width={40} height={40} sizes="(max-width: 768px) 100vw, 700px" />
            <h1>AGHAM</h1>
          </Link>
          {/* Mobile hamburger (hidden on desktop) */}
          <button
            className="md:hidden text-white text-2xl p-2 rounded focus:outline-none"
            aria-label="Open menu"
            onClick={() => setIsMenuOpen(true)}
          >
            ☰
          </button>
          {/* Desktop links preserved exactly */}
          <ul className={`${styles.navLinks} hidden md:flex`}>
            <li className={pathname === '/homepage' ? styles.active : ''}><Link href="/homepage">Home</Link></li>
            <li className={pathname === '/login' ? styles.active : ''}><Link href="/homepage/login">Login</Link></li>
            <li className={pathname === '/about' ? styles.active : ''}><Link href="/homepage/about">About</Link></li>
            <li className={pathname === '/credit' ? styles.active : ''}><Link href="/homepage/credit">Credits</Link></li>
          </ul>
        </nav>

        {/* Mobile drawer menu (does not affect desktop) */}
        {isMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40" onClick={() => setIsMenuOpen(false)} />
            <div ref={drawerRef} className="absolute right-0 top-0 h-full w-72 bg-[#3f5d54] text-white p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Image src="/logo2.png" alt="AGHAM Logo" width={32} height={32} sizes="(max-width: 768px) 100vw, 700px" />
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
        <div className={`${styles.mainSection}`}>
          <div className={styles.hero}>
            <div className={styles.heroHeader}>
              <div className={styles.heroBadge}>
                <span>🔭</span>
                <span>AR Science Learning</span>
              </div>
            </div>
            <h1 className={styles.heroTitle}>
              Mobile E‑Learning for <br />
              <span className={styles.heroAccent}>Grade 6 Science</span>
            </h1>
            <p className={styles.heroText}>
            Explore science like never before! AGHAM is a fun and interactive mobile app made especially for Grade 6 students. Learn about mixtures, circulatory system, gravity, and more through exciting 3D models and with the power of Augmented Reality. Science has never been this cool!            </p>
            
            {/* Highlighted Download placed ABOVE topics */}
            <div className={styles.downloadSection}>
              <div className={styles.downloadGlow}></div>
              <div className={styles.downloadPanel}>
                <a
                  href="/api/download-apk"
                  download="AGHAM-App.apk"
                  id="download-apk-btn"
                  className={`${styles.primaryBtn} ${styles.downloadCTA} inline-flex items-center justify-center min-h-[48px]`}
                >
                  <i className="ri-download-line" style={{ marginRight: '10px', fontSize: '20px' }}></i>
                  Download
                </a>
                <div className={styles.downloadMeta}>
                  {apkMeta.sizeMB ? apkMeta.sizeMB : ''}
                  {apkMeta.updated ? ` • Updated ${apkMeta.updated}` : ''}
                </div>
              </div>
              <canvas className={styles.confettiCanvas} id="confetti-canvas"/>
            </div>

            {/* Science Concept Cards */}
            <div className={styles.scienceConcepts}>
              <div className={styles.conceptCard}>
                <span className={styles.conceptIcon}>🧪</span>
                <h3 className={styles.conceptTitle}>Mixtures</h3>
                <p className={styles.conceptDescription}>Learn about different types of mixtures and how to separate them</p>
              </div>
              <div className={styles.conceptCard}>
                <span className={styles.conceptIcon}>❤️</span>
                <h3 className={styles.conceptTitle}>Circulatory System</h3>
                <p className={styles.conceptDescription}>Explore how blood flows through your body and keeps you healthy</p>
              </div>
                <div className={styles.conceptCard}>
                  <span className={styles.conceptIcon}>🏀</span>
                  <h3 className={styles.conceptTitle}>Gravity & Friction</h3>
                  <p className={styles.conceptDescription}>Discover the forces that make things fall and slide</p>
                </div>
              <div className={styles.conceptCard}>
                <span className={styles.conceptIcon}>🌋</span>
                <h3 className={styles.conceptTitle}>Volcanoes</h3>
                <p className={styles.conceptDescription}>Witness the power of Earth's volcanic eruptions</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
