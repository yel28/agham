'use client';

import { useEffect, useState, useMemo } from 'react';
import { getAllStudents, getAllSections, setStudentQuizUnlock, getModulePermissions, setModuleLockStatus, initializeModulePermissions, listenToModulePermissions } from '../../lib/firebase';
import { Spinner } from '../../components/LoadingComponents';
import { useNotifications } from '../../components/NotificationToast';
import { addNotification, NOTIFICATION_TYPES } from '../../lib/notificationUtils';
import { useTeacher } from '../../lib/Teacher-SPCC';

export default function LessonModulePage() {
  const { showSuccess, showError } = useNotifications();
  const { teacherEmail } = useTeacher();
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [progressCount, setProgressCount] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [modulePermissions, setModulePermissions] = useState({});
  const [quarter, setQuarter] = useState('quarter_1');
  
  // Map module keys to Firestore permission keys
  const moduleKeyMap = {
    'module_mixtures_unlocked': 'mixtures',
    'module_circulatory_unlocked': 'circulatory', 
    'module_gravity_force_unlocked': 'gravity',
    'module_volcanic_eruption_unlocked': 'volcano'
  };

  // Compute per-module status for the selected section
  const moduleStats = useMemo(() => {
    const stats = {};
    const secStudents = students.filter(s => s.sectionId === selectedSectionId);
    const keys = ['module_mixtures_unlocked','module_circulatory_unlocked','module_gravity_force_unlocked','module_volcanic_eruption_unlocked'];
    keys.forEach(k => {
      let unlocked = 0;
      secStudents.forEach(s => { if (s && s[k] === true) unlocked++; });
      stats[k] = { unlocked, total: secStudents.length };
    });
    return stats;
  }, [students, selectedSectionId]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingModule, setPendingModule] = useState(null); // { key, label, action }
  
  // Reusable styles to match app theme
  const cardStyle = useMemo(() => ({
    marginBottom: 24,
    background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
    border: '1px solid #e9ecef',
    borderRadius: 16,
    padding: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
  }), []);

  const baseBtn = {
    border: 'none',
    borderRadius: 12,
    padding: '12px 18px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
    transition: 'all 0.2s ease'
  };

  const makeBtn = (bg, color = 'white') => ({
    ...baseBtn,
    background: bg,
    color
  });

  // Palette matching student record section colors exactly
  const modules = [
    { key: 'module_mixtures_unlocked', label: 'Mixtures', gradient: ['#f9efc3', '#f9efc3'], text: '#2c3e50', icon: '🧪', description: 'Fundamentals of mixtures and solutions' },
    { key: 'module_circulatory_unlocked', label: 'Circulatory System', gradient: ['#e6d1b3', '#e6d1b3'], text: '#2c3e50', icon: '🫀', description: 'Human circulatory system and functions' },
    { key: 'module_gravity_force_unlocked', label: 'Gravity and Friction', gradient: ['#e6b3b3', '#e6b3b3'], text: '#2c3e50', icon: '🏀', description: 'Forces in motion, gravity and friction' },
    { key: 'module_volcanic_eruption_unlocked', label: 'Earthquakes and Volcanic Eruption', gradient: ['#b3e6c7', '#b3e6c7'], text: '#2c3e50', icon: '🌋', description: 'Earthquakes and eruption effects' }
  ];

  useEffect(() => {
    async function load() {
      try {
        const [sec, studs, permissions] = await Promise.all([
          getAllSections(), 
          getAllStudents(),
          getModulePermissions(quarter)
        ]);
        setSections(sec);
        setStudents(studs);
        setModulePermissions(permissions);
        if (sec.length > 0) setSelectedSectionId(sec[0].id);
      } catch (e) {
        console.error(e);
        // If permissions don't exist, initialize them
        if (e.message?.includes('permissions')) {
          try {
            await initializeModulePermissions(quarter);
            const permissions = await getModulePermissions(quarter);
            setModulePermissions(permissions);
          } catch (initError) {
            console.error('Failed to initialize permissions:', initError);
          }
        }
      } finally {
        setIsFetching(false);
      }
    }
    load();
  }, [quarter]);

  // Listen to module permissions changes
  useEffect(() => {
    const unsubscribe = listenToModulePermissions(quarter, (permissions) => {
      setModulePermissions(permissions);
    });
    return () => unsubscribe();
  }, [quarter]);

  const getStudentsInSelectedSection = () => students.filter(s => s.sectionId === selectedSectionId);

  const handleApplyModule = async (moduleKey, label, makeUnlocked) => {
    try {
      setUnlocking(true);
      setProgressCount(0);
      setProgressTotal(1);
      
      // Get the Firestore module name from the key
      const firestoreModuleName = moduleKeyMap[moduleKey];
      if (!firestoreModuleName) {
        throw new Error(`Unknown module key: ${moduleKey}`);
      }
      
      // Update the module lock status in Firestore
      await setModuleLockStatus(firestoreModuleName, !makeUnlocked, quarter);
      
      setProgressCount(1);
      
      // Also update student records for backward compatibility
      const sectionStudents = getStudentsInSelectedSection();
      if (sectionStudents.length > 0) {
        setProgressTotal(sectionStudents.length + 1);
        for (const s of sectionStudents) {
          if (!s?.id) continue;
          await setStudentQuizUnlock(s.id, moduleKey, makeUnlocked === true);
          setProgressCount((c) => c + 1);
        }
        // Optimistically update local copy so status reflects immediately
        setStudents(prev => prev.map(st => st.sectionId === selectedSectionId ? { ...st, [moduleKey]: makeUnlocked === true } : st));
      }
      
      showSuccess(`${label} ${makeUnlocked ? 'unlocked' : 'locked'} globally`);
      
      // Add persistent notification to bell
      if (teacherEmail) {
        const sectionName = sections.find(s => s.id === selectedSectionId)?.name || 'Unknown Section';
        const action = makeUnlocked ? 'unlocked' : 'locked';
        const message = `${label} module has been ${action} for ${sectionName}`;
        
        await addNotification(
          teacherEmail,
          makeUnlocked ? NOTIFICATION_TYPES.MODULE_UNLOCKED : NOTIFICATION_TYPES.MODULE_LOCKED,
          message,
          {
            moduleName: label,
            sectionName,
            action,
            timestamp: new Date().toISOString()
          }
        );
      }
    } catch (e) {
      console.error(e);
      showError(`Failed to ${makeUnlocked ? 'unlock' : 'lock'} ${label}.`);
    } finally {
      setTimeout(() => setUnlocking(false), 250);
      setConfirmOpen(false);
      setPendingModule(null);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Professional Loading Screen */}
      {isFetching ? (
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
            Loading Lesson Modules
          </h3>
          
          <p style={{
            fontSize: 14,
            color: '#6c757d',
            margin: 0,
            textAlign: 'center',
            lineHeight: 1.5,
            maxWidth: 200
          }}>
            Fetching module permissions and student data...
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
        <>
          {/* Unlock Loading Modal (matches site style) */}
      {unlocking && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 32, width: '90%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '1px solid rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 84, height: 84, borderRadius: '50%', background: pendingModule ? `linear-gradient(135deg, ${pendingModule.gradient[0]} 0%, ${pendingModule.gradient[1]} 100%)` : '#4fa37e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38 }}>
                {pendingModule?.icon || '🔓'}
              </div>
              <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#2c3e50', textAlign: 'center' }}>
                {pendingModule?.action === 'lock' ? 'Locking' : 'Unlocking'} {pendingModule?.label || 'Module'}
              </h2>
              <div style={{ color: '#6c757d', fontSize: 14, textAlign: 'center' }}>
                {sections.find(s => s.id === selectedSectionId)?.name || ''}
              </div>
              {/* Progress bar */}
              <div style={{ width: '100%', marginTop: 8 }}>
                <div style={{ height: 10, borderRadius: 8, background: '#edf0f2', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progressTotal > 0 ? Math.round((progressCount / progressTotal) * 100) : 0}%`, background: pendingModule ? `linear-gradient(90deg, ${pendingModule.gradient[0]} 0%, ${pendingModule.gradient[1]} 100%)` : '#4fa37e', transition: 'width 200ms ease' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div style={cardStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#2c3e50', letterSpacing: '-0.3px' }}>Lesson Module</h1>
          <div style={{ color: '#6c757d', marginTop: 6, fontSize: 14 }}>Unlock modules for a selected section</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <select
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            style={{
              background: 'rgba(255, 255, 255, 0.8)',
              border: '2px solid rgba(233, 236, 239, 0.8)',
              borderRadius: 16,
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 500,
              color: '#2c3e50',
              cursor: 'pointer',
              minWidth: 180,
              outline: 'none',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              backdropFilter: 'blur(10px)'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(79, 163, 126, 0.4)';
              e.target.style.background = 'rgba(255, 255, 255, 1)';
              e.target.style.boxShadow = '0 4px 12px rgba(79, 163, 126, 0.15)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(233, 236, 239, 0.8)';
              e.target.style.background = 'rgba(255, 255, 255, 0.8)';
              e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
            }}
          >
            {sections.map(section => (
              <option key={section.id} value={section.id}>{section.name}</option>
            ))}
          </select>
          
          {/* Quarter dropdown removed per request */}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20 }}>
        {modules.map((m) => {
          const firestoreModuleName = moduleKeyMap[m.key];
          const isLocked = modulePermissions[firestoreModuleName]?.locked ?? true;
          const stat = moduleStats[m.key] || { unlocked: 0, total: 0 };
          const badgeBg = !isLocked ? '#d4edda' : '#e9ecef';
          const badgeColor = !isLocked ? '#155724' : '#6c757d';
          return (
          <button
            key={m.key}
            disabled={unlocking}
            onClick={() => { setPendingModule({ ...m, action: isLocked ? 'unlock' : 'lock' }); setConfirmOpen(true); }}
            style={{ 
              ...makeBtn(`linear-gradient(135deg, ${m.gradient[0]} 0%, ${m.gradient[1]} 100%)`, m.text || 'white'), 
              textAlign: 'left', 
              opacity: unlocking ? 0.7 : 1,
              padding: '16px 20px',
              position: 'relative',
              filter: !isLocked ? 'none' : 'saturate(0.9)',
              minHeight: '100px'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 18px rgba(0,0,0,0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                {m.icon}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{m.label}</div>
                <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>{m.description}</div>
              </div>
            </div>
            {/* Lock/Unlock badge */}
            <div style={{ position: 'absolute', right: 12, top: 12, background: badgeBg, color: badgeColor, borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span>{!isLocked ? '🔓' : '🔒'}</span>
              <span>{!isLocked ? 'Unlocked' : 'Locked'}</span>
            </div>
          </button>
        )})}
      </div>

      {/* Removed per request: section student count */}

      {/* Confirmation Modal */}
      {confirmOpen && pendingModule && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, width: 420, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '1px solid #e9ecef' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${pendingModule.gradient[0]} 0%, ${pendingModule.gradient[1]} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: pendingModule.text || 'white' }}>
                {pendingModule.icon}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#2c3e50' }}>{pendingModule.action === 'lock' ? 'Lock' : 'Unlock'} {pendingModule.label}?</div>
                <div style={{ fontSize: 13, color: '#6c757d' }}>This will {pendingModule.action === 'lock' ? 'lock' : 'unlock'} for all students in the selected section.</div>
              </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#6c757d' }}>
              Section: <strong>{(sections.find(s => s.id === selectedSectionId) || {}).name || '—'}</strong><br/>
              Affected students: <strong>{getStudentsInSelectedSection().length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={() => { setConfirmOpen(false); setPendingModule(null); }} style={{ ...makeBtn('#6c757d'), padding: '10px 14px' }}>Cancel</button>
              <button onClick={() => handleApplyModule(pendingModule.key, pendingModule.label, pendingModule.action !== 'lock')} disabled={unlocking} style={{ ...makeBtn(pendingModule?.action === 'lock' ? '#dc3545' : '#4fa37e'), padding: '10px 14px', opacity: unlocking ? 0.7 : 1 }}>{pendingModule?.action === 'lock' ? 'Lock' : 'Unlock'}</button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}


