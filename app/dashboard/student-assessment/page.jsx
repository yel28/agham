'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTeacher } from '../../lib/Teacher-SPCC';
import './studentAssessment.css';
import { db, collection, onSnapshot, studentsCollection, sectionsCollection, quizzesCollection, query, where, orderBy, getDocs, doc, getDoc } from '../../lib/firebase';

const rowColors = ['#f9efc3', '#e6d1b3', '#e6b3b3', '#b3e6c7'];

// Mock data removed - now using real-time database for all users

function ProgressCircle({ percent, color, text }) {
  const radius = 28; // Increased size for better visibility
  const stroke = 6; // Thicker stroke for better visibility
  const normalizedRadius = radius - stroke * 0.5;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percent / 100) * circumference;
  
  // Enhanced color with better opacity
  const backgroundColor = color + '15'; // Very light background
  const progressColor = color; // Full color for progress
  
  return (
    <div style={{ 
      position: 'relative', 
      width: radius * 2, 
      height: radius * 2, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' // Add subtle shadow
    }}>
      <svg 
        height={radius * 2} 
        width={radius * 2} 
        style={{ 
          display: 'block', 
          position: 'absolute', 
          top: 0, 
          left: 0,
          transform: 'rotate(-90deg)' // Start from top
        }}
      >
        {/* Background circle with gradient */}
        <defs>
          <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={backgroundColor} />
            <stop offset="100%" stopColor={backgroundColor} />
          </linearGradient>
          <linearGradient id={`progress-${color.replace('#', '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={progressColor} />
            <stop offset="100%" stopColor={progressColor} />
          </linearGradient>
        </defs>
        
        {/* Background circle */}
        <circle
          stroke="#f0f0f0"
          fill={backgroundColor}
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.05))' }}
        />
        
        {/* Progress circle */}
        <circle
          stroke={`url(#progress-${color.replace('#', '')})`}
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          strokeLinecap="round" // Rounded ends for modern look
          style={{ 
            strokeDashoffset, 
            transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'
          }}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      
      {/* Percentage text with better styling */}
      <span style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: radius * 2,
        height: radius * 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: 12,
        color: '#2c3e50',
        fontFamily: 'inherit',
        textShadow: '0 1px 2px rgba(255,255,255,0.8)',
        letterSpacing: '-0.5px'
      }}>{text}</span>
    </div>
  );
}

function StudentAssessmentPageContent() {
  const { teacherEmail } = useTeacher(); 
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [students, setStudents] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState([]);
  const [studentQuizData, setStudentQuizData] = useState({});
  const [studentDocUnsub, setStudentDocUnsub] = useState(null);


  // Helper: normalize keys for fuzzy matching
  const normalizeKey = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  // Helper: get score using preferred key and a list of aliases (with fuzzy and CI match)
  const getScoreFromScores = (scoresObj = {}, preferredKey = '', aliasKeys = []) => {
    if (!scoresObj || typeof scoresObj !== 'object') return 0;

    // 1) Direct preferred key match
    if (preferredKey && scoresObj[preferredKey] != null) return Number(scoresObj[preferredKey]) || 0;

    // 2) Direct alias key match (case sensitive)
    for (const alias of aliasKeys) {
      if (scoresObj[alias] != null) return Number(scoresObj[alias]) || 0;
    }

    // 3) Case-insensitive and fuzzy alias matching
    const normalizedAliases = [preferredKey, ...aliasKeys].map(normalizeKey).filter(Boolean);
    for (const [key, val] of Object.entries(scoresObj)) {
      const nk = normalizeKey(key);
      if (normalizedAliases.includes(nk)) return Number(val) || 0;
    }

    // 4) Partial includes matching (e.g., "mixture test" vs "mixtures")
    for (const [key, val] of Object.entries(scoresObj)) {
      const nk = normalizeKey(key);
      if (normalizedAliases.some(alias => nk.includes(alias) || alias.includes(nk))) {
        return Number(val) || 0;
      }
    }

    return 0;
  };

  // Calculate real-time score for selected student and quiz using database scores
  const calculateScore = (student, quiz) => {
    if (!student || !quiz) return { correct: 0, total: 10, percentage: 0 };
    
    // Get real scores from database
    const studentScores = student.rawData?.scores || {};
    
    // Debug logging
    // (debug logs removed)
    
    // Map quiz titles to database score keys
    let scoreKey = '';
    // (debug logs removed)
    
    if (quiz.title.toLowerCase().includes('mixtures') || quiz.title.includes('Quiz 1')) {
      scoreKey = 'Mixtures';
    } else if (quiz.title.toLowerCase().includes('circulatory') || quiz.title.includes('Quiz 2')) {
      scoreKey = 'Circulatory';
    } else if (quiz.title.toLowerCase().includes('gravity') || quiz.title.toLowerCase().includes('force') || quiz.title.includes('Quiz 3')) {
      scoreKey = 'GravityForce';
    } else if (quiz.title.toLowerCase().includes('volcano') || quiz.title.toLowerCase().includes('earth') || quiz.title.includes('Quiz 4')) {
      scoreKey = 'EarthVolcano';
    }
    
    // (debug logs removed)
    
    // Aliases observed in data (support older labels entered from other systems)
    const aliasMap = {
      Mixtures: ['Mixture', 'Mixtures Quiz', 'Mixture Quiz', 'Mixture Test', 'MIXTURE TEST', 'QUIZ 1', 'Quiz 1: Mixtures'],
      Circulatory: ['Circulatory System', 'CIRCULATORY EXAM', 'Circulatory Exam', 'QUIZ 2', 'Quiz 2: Circulatory System'],
      GravityForce: ['Gravity', 'Force', 'Gravity and Force', 'GRAVITY QUIZ', 'QUIZ 3', 'Quiz 3: Gravity and Force'],
      EarthVolcano: ['Volcanic Eruption', 'Volcano', 'Volcano Quiz', 'VOLCANIC ERUPTION', 'Earth Volcano', 'QUIZ 4', 'Quiz 4: Volcanic Eruption']
    };

    // Get the actual score from database (out of 10) with alias matching
    const correctAnswers = getScoreFromScores(studentScores, scoreKey, aliasMap[scoreKey] || []);

    // TEMP DEBUG: Only for Student 004 Mixtures to verify key mapping
    const isStudent004 = (student?.id && String(student.id).toLowerCase() === 'student004') || /student\s*004/i.test(String(student?.name || ''));
    if (isStudent004 && scoreKey === 'Mixtures') {
      try {
        // Minimal, focused log
        console.log('[Mixtures DEBUG][Student004]', {
          availableKeys: Object.keys(studentScores || {}),
          resolvedScore: correctAnswers,
          rawScores: studentScores
        });
      } catch (_) {}
    }
    const totalQuestions = 10; // Each quiz has 10 questions
    const percentage = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    
    // (debug logs removed)
    
    return { correct: correctAnswers, total: totalQuestions, percentage };
  };

  // Load sections
  useEffect(() => {
    const unsubSections = onSnapshot(sectionsCollection(), (snapshot) => {
      const sectionsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setSections(sectionsList);
      
      // Auto-select first section if none is selected and sections are available
      if (!selectedSectionId && sectionsList.length > 0) {
        setSelectedSectionId(sectionsList[0].id);
      }
    });
    return () => unsubSections();
  }, [selectedSectionId]);

  // Load quizzes with real-time updates
  useEffect(() => {
    const unsubQuizzes = onSnapshot(quizzesCollection(), (snapshot) => {
      const quizzesList = snapshot.docs.map(doc => {
        const data = doc.data();
        
        // Transform database quiz data to match expected format
        const transformedQuiz = {
          id: doc.id,
          title: data.title || data.quizType || data.mainQuiz || 'Untitled Quiz',
          color: data.color || '#b3e6c7', // Default color
          questions: data.questions ? data.questions.map(q => ({
            question: q.text || q.question || '',
            answer: q.answer || '',
            correctAnswer: q.choices ? q.choices[q.correct] : q.correctAnswer || '',
            isCorrect: q.isCorrect || null
          })) : [],
          createdAt: data.createdAt || new Date() // Add creation date for sorting
        };
        
        return transformedQuiz;
      });
      
      // Sort quizzes by quiz number (Quiz 1, Quiz 2, Quiz 3, etc.)
      const sortedQuizzes = quizzesList.sort((a, b) => {
        // Extract quiz number from title (e.g., "Quiz 1: Mixtures" -> 1)
        const getQuizNumber = (title) => {
          const match = title.match(/Quiz\s+(\d+)/i);
          return match ? parseInt(match[1]) : 999; // Put non-matching quizzes at the end
        };
        
        const numberA = getQuizNumber(a.title);
        const numberB = getQuizNumber(b.title);
        
        return numberA - numberB; // Ascending order (Quiz 1, Quiz 2, Quiz 3...)
      });
      
      setQuizzes(sortedQuizzes);
      
      // Debug: Log quiz count
      console.log(`📚 Loaded ${sortedQuizzes.length} quizzes:`, sortedQuizzes.map(q => q.title));
      console.log('Available quizzes for selection:', sortedQuizzes);
    });
    return () => unsubQuizzes();
  }, []);

  // Load students with real-time updates
  useEffect(() => {
    const unsub = onSnapshot(studentsCollection(), (snapshot) => {
      console.log('🔄 Real-time student data update received');
      const list = snapshot.docs.map((doc, idx) => {
        const data = doc.data();
        
    // (debug logs removed)
        
        const emailLower = (teacherEmail || '').toLowerCase();
        let roleLower = '';
        try { roleLower = (localStorage.getItem('teacherRole') || '').toLowerCase(); } catch (_) {}
        const isTester = (
          emailLower === 'tester@tester.com' ||
          emailLower === 'super_admin@spcc.edu.ph' ||
          roleLower === 'admin' ||
          roleLower === 'super_admin' ||
          roleLower === 'teacher' ||
          roleLower === 'sub_teacher'
        );
        // Prefer stable naming from data/id instead of array index
        const normalizedId = (doc.id || '').toString();
        const derivedFromId = normalizedId
          ? normalizedId.replace(/^student/i, 'Student ').replace(/(\d+)/, (m) => m.padStart(3, '0'))
          : '';
        const derivedFromUserName = (data.userName || '')
          ? String(data.userName).replace(/^student/i, 'Student ').replace(/(\d+)/, (m) => m.padStart(3, '0'))
          : '';
        const displayName = derivedFromUserName || derivedFromId || `Student ${(idx + 1).toString().padStart(3, '0')}`;
        
        // Set avatar based on student gender
        const avatar = data.gender === 'Male' ? '/avatar4.png' : '/avatar3.png';
        
        // Primary source: Firestore progress (0, 0.25, 0.5, 0.75, 1)
        const totalQuizzes = 4;
        let completedQuizzes = 0;
        if (typeof data.progress === 'number') {
          completedQuizzes = Math.round(Number(data.progress) * totalQuizzes);
        } else {
          // Fallbacks when progress is missing: infer from scores or quizzes[]
          const countCompletedFromScores = (scoresObj = {}) => {
            const topicKeys = ['Mixtures', 'Circulatory', 'GravityForce', 'EarthVolcano'];
            let count = 0;
            topicKeys.forEach(k => {
              const v = scoresObj && typeof scoresObj[k] !== 'undefined' ? Number(scoresObj[k]) : 0;
              if (!Number.isNaN(v) && v > 0) count += 1;
            });
            return count;
          };
          if (data && data.scores) completedQuizzes = countCompletedFromScores(data.scores);
          else completedQuizzes = (data.quizzes || []).length;
        }

        const completedRatio = `${completedQuizzes}/${totalQuizzes}`;

        // Progress circle percent from Firestore progressPercent (25,50,75,100)
        let progress = 0;
        if (typeof data.progressPercent === 'number') {
          progress = Math.max(0, Math.min(100, Math.round(Number(data.progressPercent))));
        } else {
          // Fallback compute from completed
          progress = Math.round((completedQuizzes / totalQuizzes) * 100);
        }
        
        // Debug logging (can be removed in production)
        if (completedQuizzes > 0) {
          console.log(`Student ${displayName}: ${completedQuizzes}/${totalQuizzes} completed`);
        }
        
        // Use real-time database quizzes for all users (including testers)
        const studentQuizzes = quizzes;
        
        return {
          id: doc.id,
          name: displayName,
          avatar: avatar,
          sectionId: data.sectionId || 'unassigned',
          sectionName: data.sectionName || 'Unassigned',
          // Real quiz completion data for all users
          completed: completedRatio,
          progress: progress,
          color: rowColors[idx % rowColors.length],
          progressColor: progress >= 100 ? '#28a745' : progress >= 75 ? '#20c997' : progress >= 50 ? '#ffc107' : progress >= 25 ? '#fd7e14' : '#dc3545',
          quizzes: studentQuizzes,
          // Store raw student data for real-time score calculation
          rawData: data
        };
      });
      setStudents(list);
      setLoading(false);
      
      // Update student quiz data for real-time scoring
      const quizData = {};
      list.forEach(student => {
        if (student.rawData && student.rawData.quizzes) {
          quizData[student.id] = student.rawData.quizzes;
        }
      });
      setStudentQuizData(quizData);
    });
    return () => unsub();
  }, [teacherEmail, quizzes]);

  // Update student data with real Firestore completed quiz counts
  useEffect(() => {
    const updateStudentData = async () => {
      if (students.length === 0) return;

      const updatedStudents = await Promise.all(students.map(async (student) => {
        try {
          // Helper to extract topic key from quiz title
          const getTopicFromTitle = (title) => {
            if (!title) return '';
            const parts = String(title).split(':');
            const raw = (parts[1] || parts[0] || '').trim();
            const map = {
              Mixtures: 'Mixtures',
              'Circulatory System': 'Circulatory',
              'Gravity and Force': 'GravityForce',
              'Volcanic Eruption': 'EarthVolcano'
            };
            return map[raw] || raw;
          };

          // Count completed quizzes from Firestore quizResults
          const resultsCol = collection(db, 'users', 'students', 'students', student.id, 'quizResults');
          const resultsSnapshot = await getDocs(resultsCol);
          
          let completedCount = 0;
          console.log(`📊 Processing student: ${student.name} (ID: ${student.id})`);
          console.log(`   Total quizResults docs found for ${student.name}: ${resultsSnapshot.docs.length}`);
          console.log(`   Available quizzes to check: ${quizzes.length}`, quizzes.map(q => q.title));

          for (const quiz of quizzes) {
            const topic = getTopicFromTitle(quiz.title);
            console.log(`   Checking quiz: ${quiz.title}, derived topic: ${topic}`);
            if (!topic) {
              console.log(`   Skipping quiz ${quiz.title}: topic could not be derived.`);
              continue;
            }
            
            const docs = resultsSnapshot.docs
              .map(d => ({ id: d.id, ...(d.data() || {}) }))
              .filter(d => d.id && d.id.startsWith(topic));

            console.log(`   Found ${docs.length} matching quizResults docs for topic '${topic}'.`);
            if (docs.length > 0) {
              completedCount++;
              console.log(`   ✅ Incremented completedCount for ${quiz.title}. Current count: ${completedCount}`);
            } else {
              console.log(`   ❌ No matching quizResults docs for topic '${topic}'.`);
            }
          }
          console.log(`🎯 Final completedCount for ${student.name}: ${completedCount}`);

          // Update the student's completed quiz count and progress
          return {
            ...student,
            completedQuizzes: completedCount,
            progress: Math.round((completedCount / quizzes.length) * 100),
            // Also update the old quizzes array for backward compatibility
            quizzes: student.quizzes || [] // Keep existing quizzes array
          };
        } catch (error) {
          console.error(`Error updating student data for ${student.id}:`, error);
          return student; // Return original student data if error
        }
      }));

      setStudents(updatedStudents);
    };

    updateStudentData();
  }, [quizzes]); // Re-run when quizzes change

  // Filter students by section
  useEffect(() => {
    if (!selectedSectionId) {
      setFilteredStudents([]);
    } else {
      // Ensure stable numeric ordering so new students (e.g., Student 034) go to the end
      const extractNumber = (s) => {
        // Prefer numeric from id, then name; fallback to Infinity to keep unknowns at the end
        const fromId = String(s?.id || '').match(/(\d+)/);
        const fromName = String(s?.name || '').match(/(\d+)/);
        const n = fromId ? Number(fromId[1]) : fromName ? Number(fromName[1]) : Number.POSITIVE_INFINITY;
        return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
      };

      const filtered = students
        .filter(student => student.sectionId === selectedSectionId)
        .slice()
        .sort((a, b) => extractNumber(a) - extractNumber(b));
      setFilteredStudents(filtered);
    }
  }, [students, selectedSectionId]);

  // Keep selected student in sync with latest real-time data (ensures fresh scores)
  useEffect(() => {
    if (!selectedStudent || !selectedStudent.id) return;
    const updated = students.find(s => s.id === selectedStudent.id);
    if (updated) {
      setSelectedStudent(updated);
    }
  }, [students, selectedStudent?.id]);



  const handleStudentClick = async (student) => {
    console.log('Student clicked:', student.name, {
      studentId: student.id,
      hasQuizzes: !!(student.quizzes && student.quizzes.length > 0),
      completedQuizzes: student.completedQuizzes,
      progress: student.progress
    });
    
    // Temporarily allow all students to be clicked for debugging
    // We'll check for quiz data inside the modal instead
    
    // (debug logs removed)
    // Hydrate with latest snapshot once before showing modal
    let hydrated = student;
    try {
      const refNow = doc(studentsCollection(), student.id);
      const snapNow = await getDoc(refNow);
      if (snapNow.exists()) {
        hydrated = { ...student, rawData: { ...(student.rawData || {}), ...snapNow.data() } };
        console.log('Student data hydrated:', hydrated.name, {
          hasRawData: !!hydrated.rawData,
          rawDataKeys: hydrated.rawData ? Object.keys(hydrated.rawData) : []
        });
      }
    } catch (error) {
      console.error('Error hydrating student data:', error);
    }
    setSelectedStudent(hydrated);
    console.log('Selected student set:', hydrated.name);

    // Subscribe to this student's doc for freshest scores while modal is open
    try {
      if (studentDocUnsub) {
        studentDocUnsub();
        setStudentDocUnsub(null);
      }
      const ref = doc(studentsCollection(), student.id);
      const unsub = onSnapshot(ref, (snap) => {
        const latest = snap.data() || {};
        setSelectedStudent((prev) => prev ? { ...prev, rawData: latest } : prev);
      });
      setStudentDocUnsub(() => unsub);
    } catch (_) {}
    // Set default quiz or first available quiz
    const defaultQuiz = hydrated.quizzes && hydrated.quizzes.length > 0 
      ? hydrated.quizzes[0] 
      : quizzes && quizzes.length > 0 
        ? quizzes[0] 
        : null;
    
    console.log('Setting selected quiz:', defaultQuiz?.title || 'No quiz available');
    setSelectedQuiz(defaultQuiz);
    setShowQuizModal(true);
  };

  // Helper to extract topic key from quiz title, e.g. "Quiz 1: Mixtures" -> "Mixtures"
  const getTopicFromTitle = (title) => {
    if (!title) return '';
    const parts = String(title).split(':');
    const raw = (parts[1] || parts[0] || '').trim();
    // Normalize known variants
    const map = {
      Mixtures: 'Mixtures',
      'Circulatory System': 'Circulatory',
      'Gravity and Force': 'GravityForce',
      'Volcanic Eruption': 'EarthVolcano'
    };
    return map[raw] || raw;
  };

  // Real-time listener for selected student's quizResults to populate Student Answer column from chosenAnswer
  useEffect(() => {
    if (!selectedStudent?.id || !selectedQuiz?.title) return;

    const topic = getTopicFromTitle(selectedQuiz.title);
    if (!topic) return;

    const resultsCol = collection(db, 'users', 'students', 'students', selectedStudent.id, 'quizResults');
    console.log('Setting up real-time listener for:', selectedStudent.name, 'topic:', topic);
    
    const unsub = onSnapshot(resultsCol, (snapshot) => {
      console.log('Real-time update received for', selectedStudent.name, 'topic:', topic, 'docs:', snapshot.docs.length);
      
      // Pick the latest result doc for this topic by ID suffix timestamp
      const docs = snapshot.docs
        .map(d => ({ id: d.id, ...(d.data() || {}) }))
        .filter(d => d.id && d.id.startsWith(topic));

      console.log('Filtered docs for topic', topic, ':', docs.length);

      if (docs.length === 0) {
        console.log('No docs found for topic:', topic);
        return; // nothing yet
      }

      const latest = docs.sort((a, b) => (a.id > b.id ? -1 : 1))[0];
      const answersArray = Array.isArray(latest.answers) ? latest.answers : [];
      
      console.log('Latest doc:', latest.id, 'answers:', answersArray.length);

      // Map Firestore schema -> UI expected schema
      const mappedQuestions = answersArray.map(a => ({
        answer: a?.chosenAnswer || '',
        isCorrect: !!a?.isCorrect
      }));

      console.log('Mapped questions:', mappedQuestions);

      // Merge into studentQuizData for the selected student/quiz
      setStudentQuizData((prev) => {
        const existing = prev[selectedStudent.id] || [];
        const idx = existing.findIndex(q => q.quizId === selectedQuiz.id);
        const updatedQuiz = { quizId: selectedQuiz.id, questions: mappedQuestions };
        let nextArray;
        if (idx >= 0) {
          nextArray = [...existing];
          nextArray[idx] = updatedQuiz;
        } else {
          nextArray = [...existing, updatedQuiz];
        }
        console.log('Updated studentQuizData for', selectedStudent.name, ':', nextArray);
        return { ...prev, [selectedStudent.id]: nextArray };
      });
    });

    return () => unsub();
  }, [selectedStudent?.id, selectedQuiz?.id, selectedQuiz?.title]);

  const handleQuizSelect = (quiz) => {
    console.log('Quiz selected:', quiz.title, 'for student:', selectedStudent?.name);
    setSelectedQuiz(quiz);
  };

  // Clean up student doc listener when modal closes
  useEffect(() => {
    if (!showQuizModal && studentDocUnsub) {
      try { studentDocUnsub(); } catch (_) {}
      setStudentDocUnsub(null);
    }
  }, [showQuizModal, studentDocUnsub]);

  // Handle section filter change
  const handleSectionChange = (sectionId) => {
    setSelectedSectionId(sectionId);
  };


  return (
    <>
          {/* Professional Header Section */}
          <div style={{ 
            marginBottom: 24, 
            borderBottom: '2px solid #f0f0f0',
            paddingBottom: 20,
            paddingTop: 20,
            paddingLeft: 24,
            paddingRight: 24,
            display: 'flex',
            alignItems: 'flex-start',
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
                Student Assessment
              </h1>
              <p style={{ 
                fontSize: 16, 
                color: '#6c757d', 
                margin: 0,
                fontWeight: 400,
                lineHeight: 1.4
              }}>
                Monitor student performance and quiz completion rates
              </p>
            </div>

            {/* Section Selector */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 12,
              marginTop: 8
            }}>
              <label style={{ 
                fontSize: 14, 
                fontWeight: 600, 
                color: '#2c3e50',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <i className="ri-filter-line" style={{ fontSize: 16 }}></i>
                Section:
              </label>
              <select
                value={selectedSectionId}
                onChange={(e) => handleSectionChange(e.target.value)}
                className="section-selector"
                style={{
                  background: 'white',
                  border: '2px solid #e9ecef',
                  borderRadius: 12,
                  padding: '10px 16px',
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#2c3e50',
                  cursor: 'pointer',
                  minWidth: 160,
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}
                onFocus={(e) => e.target.style.borderColor = '#4fa37e'}
                onBlur={(e) => e.target.style.borderColor = '#e9ecef'}
              >
                {sections.map(section => (
                  <option key={section.id} value={section.id}>
                    {section.name} ({students.filter(s => s.sectionId === section.id).length})
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="assessment-container">
            <div style={{ background: '#f1fcf7', borderRadius: 24, padding: 24, marginTop: 8 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1.9fr 1.2fr 1.2fr',
                fontWeight: 600,
                padding: '0 24px',
                color: '#444',
                alignItems: 'center',
                minHeight: 60,
                height: 60,
                marginBottom: 12,
                background: 'rgba(255,255,255,0.7)',
                borderRadius: 12,
                border: '1px solid rgba(0,0,0,0.05)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>Student No.</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', height: '100%', paddingLeft: '-300px' }}>Completed Quiz</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', height: '100%', paddingLeft: '25px' }}>
                  Progress
                </div>
              </div>
              
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
                  margin: '20px auto'
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
                    Loading Assessment Data
                  </h3>
                  
                  <p style={{
                    fontSize: 14,
                    color: '#6c757d',
                    margin: 0,
                    textAlign: 'center',
                    lineHeight: 1.5,
                    maxWidth: 200
                  }}>
                    Fetching student performance and quiz results...
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
              ) : filteredStudents.length === 0 ? (
                <div className="empty-state" style={{ 
                  textAlign: 'center', 
                  padding: 40, 
                  color: '#6c757d',
                  fontSize: 16,
                  background: 'rgba(79, 163, 126, 0.05)',
                  borderRadius: 16,
                  border: '2px dashed #cbd5e0'
                }}>
                  <div style={{ fontSize: 48, marginBottom: 16, color: '#a0aec0' }}>
                    <i className="ri-group-line"></i>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#4a5568' }}>
                    No Students Found
                  </div>
                  <div style={{ fontSize: 14, color: '#718096' }}>
                    {!selectedSectionId 
                      ? 'Please select a section to view students.'
                      : 'No students found in this section.'
                    }
                  </div>
                </div>
              ) : (
                filteredStudents.map((s, i) => {
                const hasMetrics = typeof s.progress === 'number';
                return (
                  <div 
                    key={s.id || i} 
                    className="student-card"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.8fr 1fr 1fr',
                      alignItems: 'center',
                      background: s.color,
                      borderRadius: 16,
                      margin: '8px 0',
                      padding: '0 24px',
                      minHeight: 90,
                      height: 90,
                      cursor: 'pointer', // Allow all students to be clickable, we'll check in handleStudentClick
                      opacity: 1,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => handleStudentClick(s)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <img src={s.avatar} alt="avatar" style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid #fff', background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 18, color: '#2c3e50', letterSpacing: '-0.3px' }}>{s.name}</div>
                        {selectedSectionId === 'all' && (
                          <div style={{ fontSize: 13, color: '#6c757d', marginTop: 2, fontWeight: 500 }}>
                            {s.sectionName}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ 
                      textAlign: 'left', 
                      fontWeight: 700, 
                      fontSize: '16px',
                      color: '#2c3e50',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      height: '100%',
                      margin: '0 8px',
                      paddingLeft: '12px'
                    }}>
                      {s.completedQuizzes !== undefined ? `${s.completedQuizzes}/${quizzes.length}` : s.completed}
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'flex-start',
                      height: '100%',
                      margin: '0 8px',
                      paddingLeft: '8px'
                    }}>
                      {hasMetrics ? (
                        <ProgressCircle percent={s.progress} color={s.progressColor} text={s.progress + '%'} />
                      ) : (
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(0,0,0,0.1)',
                          border: '3px solid rgba(0,0,0,0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#2c3e50',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                          0%
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
              )}
            </div>

            {/* Quiz Details Modal */}
            {showQuizModal && selectedStudent && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(0,0,0,0.5)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  background: 'white',
                  borderRadius: 28,
                  padding: 36,
                  width: '92%',
                  maxWidth: 1280,
                  minWidth: 1100,
                  maxHeight: '92vh',
                  overflow: 'auto',
                  position: 'relative',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
                }}>
                  {/* Professional Score Display - Upper Right */}
                  {(() => {
                    const score = calculateScore(selectedStudent, selectedQuiz);
                    return (
                      <div style={{
                        position: 'absolute',
                        top: 20,
                        right: 60,
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                        borderRadius: 16,
                        padding: '12px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.1)',
                        border: '1px solid rgba(79, 163, 126, 0.2)',
                        zIndex: 1001,
                        backdropFilter: 'blur(10px)',
                        minWidth: 120
                      }}>
                         <div style={{
                           width: 36,
                           height: 36,
                           borderRadius: '50%',
                           background: score.percentage >= 80 ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' : 
                                      score.percentage >= 60 ? 'linear-gradient(135deg, #ffc107 0%, #fd7e14 100%)' : 
                                      'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)',
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           color: 'white',
                           fontSize: 16,
                           fontWeight: 700,
                           boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                           border: '2px solid rgba(255, 255, 255, 0.8)'
                         }}>
                           {score.correct}
                         </div>
                         <div style={{ textAlign: 'left', flex: 1 }}>
                           <div style={{ 
                             fontSize: 11, 
                             color: '#6c757d', 
                             fontWeight: 600, 
                             marginBottom: 2,
                             textTransform: 'uppercase',
                             letterSpacing: '0.5px'
                           }}>
                             Quiz Score
                           </div>
                           <div style={{ 
                             fontSize: 18, 
                             fontWeight: 800, 
                             color: '#2c3e50',
                             lineHeight: 1.2
                           }}>
                             {score.correct}/{score.total}
                           </div>
                           <div style={{ 
                             fontSize: 12, 
                             color: score.percentage >= 80 ? '#28a745' : score.percentage >= 60 ? '#ffc107' : '#dc3545',
                             fontWeight: 600
                           }}>
                             {score.percentage}%
                           </div>
                         </div>
                      </div>
                    );
                  })()}

                  {/* Close Button */}
                  <button
                    style={{
                      position: 'absolute',
                      top: 20,
                      right: 20,
                      background: 'none',
                      border: 'none',
                      fontSize: 32,
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      color: '#333',
                      zIndex: 1001
                    }}
                    onClick={() => setShowQuizModal(false)}
                    aria-label="Close"
                  >
                    ×
                  </button>

                  {/* Student Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
                    <img 
                      src={selectedStudent.avatar} 
                      alt="avatar" 
                      style={{ 
                        width: 80, 
                        height: 80, 
                        borderRadius: '50%', 
                        border: '4px solid #fff', 
                        background: '#fff',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                      }} 
                    />
                     <div>
                       <h2 style={{ margin: 0, fontSize: 28, fontWeight: 600, color: '#333' }}>
                         {selectedStudent.name}
                       </h2>
                     </div>
                  </div>

                  {/* Quiz Selection and Details */}
                  <div style={{ display: 'flex', gap: 24 }}>
                    {/* Quiz Buttons */}
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: '0 0 16px 0', fontSize: 20, fontWeight: 600, color: '#333' }}>
                        Select Quiz:
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {(quizzes || []).map((quiz) => (
                          <button
                            key={quiz.id}
                            onClick={() => handleQuizSelect(quiz)}
                            style={{
                              background: selectedQuiz.id === quiz.id ? quiz.color : '#f8f9fa',
                              border: selectedQuiz.id === quiz.id ? `2px solid ${quiz.color}` : '2px solid #e9ecef',
                              borderRadius: 16,
                              padding: '16px 20px',
                              cursor: 'pointer',
                              textAlign: 'left',
                              fontSize: 16,
                              fontWeight: 500,
                              color: selectedQuiz.id === quiz.id ? '#333' : '#666',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {quiz.title}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quiz Details */}
                    <div style={{ flex: 2 }}>
                      <h3 style={{ margin: '0 0 16px 0', fontSize: 20, fontWeight: 600, color: '#333' }}>
                        Quiz Details:
                      </h3>
                      <div style={{
                        background: selectedQuiz?.color || '#f8f9fa',
                        borderRadius: 16,
                        padding: 24
                      }}>
                        <h4 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 600, color: '#333' }}>
                          {selectedQuiz?.title || 'No Quiz Selected'}
                        </h4>
                        {/* Column headers (outside scroll area for cleaner visuals) */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1.3fr 1fr 1fr',
                          gap: 16,
                          padding: '10px 16px',
                          borderRadius: 12,
                          marginBottom: 8,
                          background: 'rgba(255,255,255,0.7)',
                          border: '1px solid rgba(0,0,0,0.06)',
                          boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.06)'
                        }}>
                          <div style={{ fontWeight: 700, color: '#2c3e50' }}>Question</div>
                          <div style={{ fontWeight: 700, color: '#2c3e50' }}>Student Answer</div>
                          <div style={{ fontWeight: 700, color: '#2c3e50' }}>Correct Answer</div>
                        </div>
                        {/* Scrollable rows */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 560, overflowY: 'auto', paddingRight: 4 }}>
                          {selectedQuiz.questions && selectedQuiz.questions.length > 0 ? selectedQuiz.questions.map((q, index) => {
                            // Get real-time student answer data
                            const studentQuizzes = studentQuizData[selectedStudent.id] || [];
                            const studentQuiz = studentQuizzes.find(sq => sq.quizId === selectedQuiz.id);
                            const studentAnswer = studentQuiz && studentQuiz.questions ? studentQuiz.questions[index] : null;
                            
                            return (
                              <div
                                key={index}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '1.3fr 1fr 1fr',
                                  alignItems: 'center',
                                  gap: 16,
                                  padding: '12px 16px',
                                  background: 'white',
                                  borderRadius: 12,
                                  border: `2px solid ${studentAnswer && studentAnswer.isCorrect ? '#d4edda' : '#f8d7da'}`
                                }}
                              >
                                {/* Question */}
                                <div style={{ fontWeight: 700, color: '#2c3e50' }}>
                                  {index + 1}. {q.question}
                                </div>
                                 {/* Student Answer */}
                                 <div style={{
                                   background: studentAnswer && studentAnswer.answer ? '#f8f9fa' : '#f8f9fa',
                                   border: studentAnswer && studentAnswer.answer ? `1px solid ${studentAnswer.isCorrect ? '#cfeadc' : '#f1c0c7'}` : '1px solid #e9ecef',
                                   color: studentAnswer && studentAnswer.answer ? (studentAnswer.isCorrect ? '#0f5132' : '#b02a37') : '#6c757d',
                                   fontWeight: 600,
                                   borderRadius: 10,
                                   padding: '8px 12px',
                                   display: 'flex',
                                   alignItems: 'center',
                                   justifyContent: 'space-between'
                                 }}>
                                   <span>{studentAnswer && studentAnswer.answer ? studentAnswer.answer : 'Not answered yet'}</span>
                                   {studentAnswer && studentAnswer.answer && (
                                     <span style={{
                                       width: 22,
                                       height: 22,
                                       borderRadius: '50%',
                                       display: 'inline-flex',
                                       alignItems: 'center',
                                       justifyContent: 'center',
                                       background: studentAnswer.isCorrect ? '#d4edda' : '#f8d7da',
                                       color: studentAnswer.isCorrect ? '#155724' : '#721c24',
                                       fontSize: 12,
                                       marginLeft: 10
                                     }}>
                                       {studentAnswer.isCorrect ? '✓' : '✗'}
                                     </span>
                                   )}
                                 </div>
                                {/* Correct Answer */}
                                <div style={{
                                  background: '#f1f8f4',
                                  border: '1px solid #cfeadc',
                                  color: '#0f5132',
                                  fontWeight: 600,
                                  borderRadius: 10,
                                  padding: '8px 12px'
                                }}>
                                  {q.correctAnswer || '—'}
                                </div>
                                
                              </div>
                            );
                          }) : (
                            <div style={{
                              padding: '40px 20px',
                              textAlign: 'center',
                              color: '#6c757d',
                              background: '#f8f9fa',
                              borderRadius: 12,
                              border: '2px dashed #dee2e6'
                            }}>
                              <div style={{ fontSize: 48, marginBottom: 16, color: '#adb5bd' }}>
                                <i className="ri-question-line"></i>
                              </div>
                              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#495057' }}>
                                No Questions Available
                              </div>
                              <div style={{ fontSize: 14, color: '#6c757d' }}>
                                This quiz doesn't have any questions yet.
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
    </>
  );
}

export default function StudentAssessmentPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <StudentAssessmentPageContent />
    </Suspense>
  );
}
