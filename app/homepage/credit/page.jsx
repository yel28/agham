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
      {/* Floating Elements - Scattered All Around */}
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
        <div className={styles.floatingElement}>🌍</div>
        <div className={styles.floatingElement}>🔥</div>
        <div className={styles.floatingElement}>💧</div>
        <div className={styles.floatingElement}>🌪️</div>
        <div className={styles.floatingElement}>⚡</div>
        <div className={styles.floatingElement}>🌊</div>
        <div className={styles.floatingElement}>❄️</div>
        <div className={styles.floatingElement}>🌈</div>
        <div className={styles.floatingElement}>🌋</div>
        <div className={styles.floatingElement}>🌌</div>
        <div className={styles.floatingElement}>🌱</div>
        <div className={styles.floatingElement}>🦠</div>
        <div className={styles.floatingElement}>🌿</div>
        <div className={styles.floatingElement}>🦋</div>
        <div className={styles.floatingElement}>🐛</div>
        <div className={styles.floatingElement}>🦎</div>
        <div className={styles.floatingElement}>🦜</div>
        <div className={styles.floatingElement}>🦅</div>
        <div className={styles.floatingElement}>🦉</div>
        <div className={styles.floatingElement}>🦇</div>
        <div className={styles.floatingElement}>🦆</div>
        <div className={styles.floatingElement}>🔋</div>
        <div className={styles.floatingElement}>📡</div>
        <div className={styles.floatingElement}>🎯</div>
        <div className={styles.floatingElement}>🔮</div>
        <div className={styles.floatingElement}>🌠</div>
        <div className={styles.floatingElement}>🪐</div>
        <div className={styles.floatingElement}>🌺</div>
        <div className={styles.floatingElement}>🌻</div>
        <div className={styles.floatingElement}>🌼</div>
        <div className={styles.floatingElement}>🌷</div>
        <div className={styles.floatingElement}>🌵</div>
        <div className={styles.floatingElement}>🌾</div>
        <div className={styles.floatingElement}>🌰</div>
        <div className={styles.floatingElement}>🍄</div>
        <div className={styles.floatingElement}>🌲</div>
        <div className={styles.floatingElement}>🌳</div>
        <div className={styles.floatingElement}>🌴</div>
        <div className={styles.floatingElement}>🌶️</div>
        <div className={styles.floatingElement}>🌽</div>
        <div className={styles.floatingElement}>🍀</div>
        <div className={styles.floatingElement}>🍁</div>
        <div className={styles.floatingElement}>🍂</div>
        <div className={styles.floatingElement}>🍃</div>
        <div className={styles.floatingElement}>🦗</div>
        <div className={styles.floatingElement}>🕷️</div>
        <div className={styles.floatingElement}>🕸️</div>
        <div className={styles.floatingElement}>🦂</div>
        <div className={styles.floatingElement}>🐝</div>
        <div className={styles.floatingElement}>🐞</div>
        <div className={styles.floatingElement}>🐜</div>
        <div className={styles.floatingElement}>🦟</div>
        <div className={styles.floatingElement}>🦠</div>
        <div className={styles.floatingElement}>🧫</div>
        <div className={styles.floatingElement}>🧪</div>
        <div className={styles.floatingElement}>🔬</div>
        <div className={styles.floatingElement}>⚗️</div>
        <div className={styles.floatingElement}>🧬</div>
        <div className={styles.floatingElement}>⚛️</div>
        <div className={styles.floatingElement}>🔭</div>
        <div className={styles.floatingElement}>💡</div>
        <div className={styles.floatingElement}>⭐</div>
      </div>

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
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>Project Credits</h1>
          
          <div className={styles.creditsContent}>
            <div className={styles.projectDescription}>
              <p className={styles.descriptionText}>
                <strong>AGHAM</strong> is a capstone project developed by dedicated students from <span className={styles.highlight}>STI College Caloocan</span> as part of their final
                requirement in the field of <span className={styles.highlight}>Information Technology</span>. This project was created with the goal of enhancing science
                education for Grade 6 learners through the power of <span className={styles.highlight}>Augmented Reality (AR)</span>.
              </p>
            </div>

            <div className={styles.creditsGrid}>
              <div className={styles.creditCard}>
                <div className={styles.creditHeader}>
                  <div className={styles.creditIcon}>👨‍💻</div>
                  <h3>Developers</h3>
                </div>
                <div className={styles.creditList}>
                  <div className={styles.creditItem}>Alarcon, Miguella Regine C.</div>
                  <div className={styles.creditItem}>Fegi, Lovely B.</div>
                  <div className={styles.creditItem}>Marquez, John Ariel E.</div>
                  <div className={styles.creditItem}>Radin, Rocel Kyla C.</div>
                </div>
              </div>

              <div className={styles.creditCard}>
                <div className={styles.creditHeader}>
                  <div className={styles.creditIcon}>🎨</div>
                  <h3>UI/UX Designers</h3>
                </div>
                <div className={styles.creditList}>
                  <div className={styles.creditItem}>Alarcon, Miguella Regine C.</div>
                  <div className={styles.creditItem}>Fegi, Lovely B.</div>
                  <div className={styles.creditItem}>Radin, Rocel Kyla C.</div>
                </div>
              </div>

              <div className={styles.creditCard}>
                <div className={styles.creditHeader}>
                  <div className={styles.creditIcon}>🔬</div>
                  <h3>AR Integration</h3>
                </div>
                <div className={styles.creditList}>
                  <div className={styles.creditItem}>Marquez, John Ariel E.</div>
                  <div className={styles.creditItem}>Alarcon, Miguella Regine C.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
