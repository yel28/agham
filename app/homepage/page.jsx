  'use client';

  import { useEffect, useRef, useState } from 'react';
  import { usePathname } from 'next/navigation';
  import Link from 'next/link';
  import Image from 'next/image';
  import styles from './homepage.module.css';

  export default function HomePage() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
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

    return (
      <div className={`${styles.page} overflow-x-hidden`}>
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
        <div className={`${styles.mainSection} max-w-screen-xl px-4 md:px-8 py-8 md:py-16 mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center`}>
          {/* LEFT CONTENT */}
          <div className={`${styles.left} max-md:static max-md:transform-none max-md:w-full max-md:max-w-none max-md:text-center md:col-span-8`}>
            {pathname === '/homepage' && (
              <>
                <h1 className="balance break-words text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight tracking-tight text-center mx-auto max-w-[26ch] md:text-left md:max-w-none md:mx-0 mb-4 md:mb-6">
                  Mobile E‑Learning for <br /><span>Grade 6 Science</span>
                </h1>
                      <p className="text-[0.95rem] md:text-lg leading-relaxed md:leading-loose text-left opacity-90 mt-3 md:mt-4 mx-auto max-w-[36ch] md:text-left md:mx-0 md:max-w-none">
                  Explore science like never before! AGHAM is a fun and interactive mobile app made especially for Grade 6 students. Learn about mixtures, circulatory system, gravity, and more through exciting 3D models and with the power of Augmented Reality. Science has never been this cool!
                </p>
                <a 
                  href="https://onedrive.live.com/?redeem=aHR0cHM6Ly8xZHJ2Lm1zL3UvYy9hNjQ3Zjc3NDJjMzg4MDdkL0Vaal8zV2hNdk5oQm1pT1ctNjNPTFBVQlJrRkZDdVhsQVNrQ1pJR01nUlpCYlE%5FZT0wS1ZtOUU&cid=A647F7742C38807D&id=A647F7742C38807D%21s68ddff98bc4c41d89a2396fbadce2cf5&parId=root&o=OneUp" 
                  download="AGHAM-App.apk"
                  className={`${styles.downloadBtn} mt-6 inline-flex items-center justify-center h-11 px-5 rounded-xl bg-[var(--color-brand-600)] hover:bg-[var(--color-brand-700)] text-white font-semibold shadow-[var(--shadow-card)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-600)] min-h-[44px] text-base hover:scale-[1.02] active:scale-[0.98]`}
                >
                  <i className="ri-download-line" style={{ marginRight: '8px', fontSize: '18px' }}></i>
                  Download APK
                </a>

                {/* Illustrations removed per requirements */}
              </>
            )}
          </div>

          

        </div>
      </div>
    );
  }
