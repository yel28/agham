'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

export default function StartPage() {
  const router = useRouter();

  const handleEnter = () => {
    router.push('/homepage/login');
  };

  return (
    <div
      onClick={handleEnter}
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #4fa37e 0%, #3d8b6f 100%)',
        cursor: 'pointer',
        userSelect: 'none'
      }}
      title="Enter"
    >
      <div style={{
        textAlign: 'center',
        color: 'white',
        padding: 32
      }}>
        <div style={{
          fontSize: 64,
          fontWeight: 800,
          letterSpacing: '-1px',
          marginBottom: 8
        }}>
          AGHAM
        </div>
        <div style={{
          fontSize: 18,
          opacity: 0.9
        }}>
          Grade 6 Science E‑Learning
        </div>
        <div style={{
          marginTop: 28,
          background: 'rgba(255,255,255,0.15)',
          borderRadius: 999,
          padding: '10px 18px',
          fontSize: 14,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'white', display: 'inline-block' }}></span>
          Tap anywhere to continue
        </div>
      </div>
    </div>
  );
}


