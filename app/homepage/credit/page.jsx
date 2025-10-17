'use client';
import { useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import styles from './credit.module.css';
import Link from 'next/link';
import Image from 'next/image';

export default function CreditPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const drawerRef = useRef(null);
  return (
    <div className={styles.page}>
      <nav className={`${styles.navbar} md:flex md:items-center md:justify-between`}>
        <Link href="/homepage" className={styles.logo}>
          <Image src="/logo2.png" alt="AGHAM Logo" width={40} height={40} />
          <h1>AGHAM</h1>
        </Link>
        <button
          className="md:hidden text-white text-2xl p-2 rounded focus:outline-none"
          aria-label="Open menu"
          onClick={() => setIsMenuOpen(true)}
        >
          ☰
        </button>
        <ul className={`${styles.navLinks} hidden md:flex`}>
          <li><Link href="/homepage">Home</Link></li>
          <li><Link href="/homepage/login">Login</Link></li>
          <li><Link href="/homepage/about">About</Link></li>
          <li className={styles.active}><Link href="/homepage/credit">Credits</Link></li>
        </ul>
      </nav>
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
        {/* LEFT TEXT */}
        <div className={styles.left}>
          <p className={styles.desktopText}>
          AGHAM is a capstone project developed by dedicated students from STI College Caloocan as part of their final 
          requirement in the field of Information Technology. This project was created with the goal of enhancing science 
          education for Grade 6 learners through the power of Augmented Reality (AR).
          </p>
          <p className={styles.mobileText}>
          AGHAM is developed by students from STI College Caloocan. 
          We are the creators and owners of this Grade 6 Science AR learning platform.
          </p>
        </div>

        {/* RIGHT FORM */}
        <div className={styles.container}>
          <img src="/names.svg" alt="Developer Names" />
          </div>
          </div>
    </div>
  );
}
