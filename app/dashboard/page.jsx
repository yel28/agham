"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTeacher } from '../lib/Teacher-SPCC';
import './style.css';
import { db, collection, getDocs, onSnapshot, query, where, doc, collectionGroup, studentsCollection, quizzesCollection, sectionsCollection, setLeaderboardForSection } from '../lib/firebase';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// Professional Progress Circle Component
const ProgressCircle = ({ percent, color, text }) => {
  const radius = 35; // Larger for dashboard
  const stroke = 8; // Thicker for dashboard
  const normalizedRadius = radius - stroke * 0.5;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percent / 100) * circumference;
  
  // Enhanced colors
  const backgroundColor = color + '20'; // Light background
  const progressColor = color; // Full color for progress
  
  return (
    <div style={{ 
      position: 'relative', 
      width: radius * 2, 
      height: radius * 2, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.15))' // Stronger shadow for dashboard
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
        {/* Background circle */}
        <circle
          stroke="#f5f5f5"
          fill={backgroundColor}
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
        />
        
        {/* Progress circle */}
        <circle
          stroke={progressColor}
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          strokeLinecap="round" // Rounded ends
          style={{ 
            strokeDashoffset, 
            transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
          }}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      
      {/* Percentage text */}
      <span style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: radius * 2,
        height: radius * 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: 18,
        color: '#2c3e50',
        fontFamily: 'inherit',
        textShadow: '0 1px 3px rgba(255,255,255,0.9)',
        letterSpacing: '-0.5px'
      }}>{text}</span>
    </div>
  );
};

export default function DashboardPage() {
  const { teacherEmail } = useTeacher();
  const router = useRouter();
  const [totalStudents, setTotalStudents] = useState(0);
  const [classScore, setClassScore] = useState(0);
  const [highPerformersCount, setHighPerformersCount] = useState(0);
  const [lowPerformersCount, setLowPerformersCount] = useState(0);
  
  const [showLowPerformers, setShowLowPerformers] = useState(false);
  const [lowPerformers, setLowPerformers] = useState([]);
  const [showHighPerformers, setShowHighPerformers] = useState(false);
  const [highPerformers, setHighPerformers] = useState([]);
  const [showQuizOverview, setShowQuizOverview] = useState(false);
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [quizPerformance, setQuizPerformance] = useState([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [showTotalStudents, setShowTotalStudents] = useState(false);
  const [allStudents, setAllStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showClassScore, setShowClassScore] = useState(false);
  const [quarterlyData, setQuarterlyData] = useState([]);
  const [quarterlyViewMode, setQuarterlyViewMode] = useState({}); // Track view mode for each quarter
  const unsubscribeQuarterlyRef = useRef(null);
  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [sectionStudents, setSectionStudents] = useState([]);

  // Fast batch fetch for all student quiz results
  const batchFetchStudentQuizResults = async (students) => {
    const allResults = {};
    
    // Create all promises at once
    const promises = students.map(async (student) => {
      try {
        const resultsCol = collection(db, 'users', 'students', 'students', student.id, 'quizResults');
        const resultsSnapshot = await getDocs(resultsCol);
        const studentResults = resultsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        allResults[student.id] = studentResults;
      } catch (error) {
        console.error(`Error fetching results for student ${student.id}:`, error);
        allResults[student.id] = [];
      }
    });
    
    // Wait for all to complete
    await Promise.all(promises);
    return allResults;
  };

  // Fast calculation using cached quiz results
  const calculatePerformersFromCache = (students, allQuizResults) => {
    let highPerformersList = [];
    let lowPerformersList = [];
    let totalClassScore = 0;
    let validStudents = 0;

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

    students.forEach((student, index) => {
      const studentResults = allQuizResults[student.id] || [];
      let totalScore = 0;
      let maxPossibleScore = 0;
      let completedCount = 0;

      // Process each quiz
      quizzes.forEach(quiz => {
        const topic = getTopicFromTitle(quiz.title);
        if (!topic) return;
        
        // Find results for this topic
        const docs = studentResults.filter(d => d.id && d.id.startsWith(topic));
        
        if (docs.length > 0) {
          let totalQuizScore = 0;
          let totalQuestions = 0;
          
          docs.forEach(doc => {
            const answersArray = Array.isArray(doc.answers) ? doc.answers : [];
            
            let attemptScore = 0;
            answersArray.forEach(answer => {
              if (answer.isCorrect === true) {
                attemptScore++;
              }
            });
            
            totalQuizScore += attemptScore;
            totalQuestions += answersArray.length;
          });
          
          totalScore += totalQuizScore;
          maxPossibleScore += totalQuestions;
          completedCount++;
        }
      });

      // Calculate performance metrics
      const percentageScore = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
      const averageScore = completedCount > 0 ? Math.round(totalScore / completedCount) : 0;
      const isHighPerformer = percentageScore >= 60 && completedCount > 0;
      const isLowPerformer = percentageScore < 60 && completedCount > 0;

      // Add to class score calculation
      if (completedCount > 0) {
        totalClassScore += averageScore;
        validStudents++;
      }

      // Create student data for performers lists
      const studentNumber = (index + 1).toString().padStart(3, '0');
      const avatar = student.gender === 'Male' ? '/avatar4.png' : '/avatar3.png';
      
      const studentData = {
        id: student.id,
        name: `Student ${studentNumber}`,
        avatar: avatar,
        completed: `${completedCount}/${quizzes.length}`,
        avgScore: averageScore.toString(),
        percentageScore: Math.round(percentageScore).toString(),
        progress: quizzes.length > 0 ? Math.round((completedCount / quizzes.length) * 100) : 0,
        color: isHighPerformer ? '#d4edda' : isLowPerformer ? '#f8d7da' : '#e2e3e5',
        scoreColor: isHighPerformer ? '#28a745' : isLowPerformer ? '#dc3545' : '#6c757d',
        progressColor: isHighPerformer ? '#28a745' : isLowPerformer ? '#dc3545' : '#6c757d',
        totalScore: totalScore,
        maxPossibleScore: maxPossibleScore
      };

      if (isHighPerformer) {
        highPerformersList.push(studentData);
      } else if (isLowPerformer) {
        lowPerformersList.push(studentData);
      }
    });

    const classScore = validStudents > 0 ? Math.round(totalClassScore / validStudents) : 0;
    
    return { highPerformersList, lowPerformersList, classScore };
  };

  // Calculate student performance metrics
  const calculateStudentPerformance = async (student) => {
    if (!student) {
      return {
        averageScore: 0,
        completedQuizzes: 0,
        totalQuizzes: 0,
        progress: 0,
        isHighPerformer: false,
        isLowPerformer: false
      };
    }

    const totalQuizzes = quizzes.length;
    
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

    // Get real-time quiz results from Firestore
    let totalScore = 0;
    let maxPossibleScore = 0;
    let completedCount = 0;
    const quizScores = {}; // Store individual quiz scores
    const quizTotals = {}; // Store total questions per quiz (across attempts)
    
    try {
      // Get student's quiz results from Firestore path: /users/students/students/{studentId}/quizResults
      const resultsCol = collection(db, 'users', 'students', 'students', student.id, 'quizResults');
      const resultsSnapshot = await getDocs(resultsCol);
      
      // Process each quiz
      for (const quiz of quizzes) {
        const topic = getTopicFromTitle(quiz.title);
        if (!topic) continue;
        
        // Find the latest result doc for this topic
        const docs = resultsSnapshot.docs
          .map(d => ({ id: d.id, ...(d.data() || {}) }))
          .filter(d => d.id && d.id.startsWith(topic));

        if (docs.length > 0) {
          // Add all scores from multiple attempts (additive scoring)
          let totalQuizScore = 0;
          let totalQuestions = 0;
          
          docs.forEach(doc => {
            const answersArray = Array.isArray(doc.answers) ? doc.answers : [];
            
            // Count correct answers for this attempt
            let attemptScore = 0;
            answersArray.forEach(answer => {
              if (answer.isCorrect === true) {
                attemptScore++;
              }
            });
            
            totalQuizScore += attemptScore;
            totalQuestions += answersArray.length;
          });
          
          // Store total quiz score (sum of all attempts)
          quizScores[quiz.title] = totalQuizScore;
          quizTotals[quiz.title] = totalQuestions;
          
          totalScore += totalQuizScore;
          maxPossibleScore += totalQuestions; // Use total questions from all attempts
          completedCount++;
        } else {
          // No quiz result found, set score to 0
          quizScores[quiz.title] = 0;
        }
      }
    } catch (error) {
      console.error(`Error fetching quiz results for student ${student.id}:`, error);
    }
    
    // Calculate percentage score across all quizzes
    const percentageScore = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
    const averageScore = completedCount > 0 ? Math.round(totalScore / completedCount) : 0;
    const progress = totalQuizzes > 0 ? Math.round((completedCount / totalQuizzes) * 100) : 0;
    
    // NEW LOGIC: High/Low performers based on overall percentage
    // High Performer: ≥ 50% overall score across all quizzes
    // Low Performer: < 50% overall score across all quizzes
    const isHighPerformer = percentageScore >= 60 && completedCount > 0;
    const isLowPerformer = percentageScore < 60 && completedCount > 0;
    
    return {
      averageScore,
      percentageScore: Math.round(percentageScore),
      completedQuizzes: completedCount,
      totalQuizzes,
      progress,
      isHighPerformer,
      isLowPerformer,
      totalScore,
      maxPossibleScore,
      quizScores, // Individual quiz scores
      quizTotals  // Total questions per quiz
    };
  };

  // Calculate real-time performers
  const calculatePerformers = async () => {
    const currentStudents = sectionStudents;
    let highPerformersList = [];
    let lowPerformersList = [];
    
    // Process all students asynchronously
    const performancePromises = currentStudents.map(async (student, index) => {
      const performance = await calculateStudentPerformance(student);
      const studentNumber = (index + 1).toString().padStart(3, '0');
      const avatar = student.gender === 'Male' ? '/avatar4.png' : '/avatar3.png';
      
      const studentData = {
        id: student.id,
        name: `Student ${studentNumber}`,
        avatar: avatar,
        completed: `${performance.completedQuizzes}/${performance.totalQuizzes}`,
        avgScore: performance.averageScore.toString(),
        percentageScore: performance.percentageScore.toString(),
        progress: performance.progress,
        color: performance.isHighPerformer ? '#d4edda' : performance.isLowPerformer ? '#f8d7da' : '#e2e3e5',
        scoreColor: performance.isHighPerformer ? '#28a745' : performance.isLowPerformer ? '#dc3545' : '#6c757d',
        progressColor: performance.isHighPerformer ? '#28a745' : performance.isLowPerformer ? '#dc3545' : '#6c757d',
        performance: performance,
        totalScore: performance.totalScore,
        maxPossibleScore: performance.maxPossibleScore,
        quizScores: performance.quizScores // Add individual quiz scores
      };
      
      return { studentData, performance };
    });
    
    // Wait for all performance calculations to complete
    const results = await Promise.all(performancePromises);
    
    // Categorize students based on performance
    results.forEach(({ studentData, performance }) => {
      if (performance.isHighPerformer) {
        highPerformersList.push(studentData);
      } else if (performance.isLowPerformer) {
        lowPerformersList.push(studentData);
      }
    });
    
    return { highPerformersList, lowPerformersList };
  };

  // Dashboard Loading Performance Optimization
  useEffect(() => {
    // Set loading to true when starting to fetch data
    setDashboardLoading(true);
    
    // Track which data has been loaded
    const loadedData = {
      students: false,
      sections: false,
      quizzes: false
    };
    
    const checkAllDataLoaded = () => {
      if (loadedData.students && loadedData.sections && loadedData.quizzes) {
        // Add a small delay to ensure smooth transition
        setTimeout(() => {
          setDashboardLoading(false);
        }, 500);
      }
    };
    
    // Real-time data subscriptions
    const unsubscribeStudents = onSnapshot(studentsCollection(), (snapshot) => {
      const studentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllStudents(studentsData);
      setTotalStudents(snapshot.size);
      loadedData.students = true;
      checkAllDataLoaded();
    });

    // Load sections
    const unsubscribeSections = onSnapshot(sectionsCollection(), (snapshot) => {
      const sectionsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setSections(sectionsList);
      loadedData.sections = true;
      checkAllDataLoaded();
      
      // Auto-select first section if none is selected and sections are available
      if (!selectedSectionId && sectionsList.length > 0) {
        setSelectedSectionId(sectionsList[0].id);
      }
    });

    // Real-time quiz updates
    const unsubscribeQuizzes = onSnapshot(quizzesCollection(), (snapshot) => {
      const quizzesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort quizzes by quiz number (Quiz 1, Quiz 2, Quiz 3, etc.)
      const sortedQuizzes = quizzesData.sort((a, b) => {
        // Extract quiz number from title (e.g., "Quiz 1: Mixtures" -> 1)
        const getQuizNumber = (title) => {
          const match = title?.match(/Quiz (\d+)/);
          return match ? parseInt(match[1], 10) : 999;
        };
        
        const numA = getQuizNumber(a.title);
        const numB = getQuizNumber(b.title);
        return numA - numB;
      });
      
      setQuizzes(sortedQuizzes);
      loadedData.quizzes = true;
      checkAllDataLoaded();
    });

    return () => {
      unsubscribeStudents();
      unsubscribeSections();
      unsubscribeQuizzes();
    };
  }, []);


  // Filter students by section
  useEffect(() => {
    if (!selectedSectionId) {
      setSectionStudents([]);
    } else {
      const filtered = allStudents.filter(student => student.sectionId === selectedSectionId);
      setSectionStudents(filtered);
    }
  }, [allStudents, selectedSectionId]);

  // Real-time performer updates when modals are open
  useEffect(() => {
    const updatePerformers = async () => {
      if (showHighPerformers || showLowPerformers) {
        const { highPerformersList, lowPerformersList } = await calculatePerformers();
        
        if (showHighPerformers) {
          setHighPerformers(highPerformersList);
        }
        
        if (showLowPerformers) {
          setLowPerformers(lowPerformersList);
        }
      }
    };
    
    updatePerformers();
  }, [sectionStudents, quizzes, showHighPerformers, showLowPerformers]);

  // Auto-save leaderboard whenever students or quizzes change (no need to click modal)
  useEffect(() => {
    const autoSaveLeaderboard = async () => {
      if (sectionStudents.length > 0 && quizzes.length > 0) {
        try {
          const { highPerformersList } = await calculatePerformers();
          
          const top10 = highPerformersList
            .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
            .slice(0, 10)
            .map((s, idx) => ({
              studentId: s.id,
              name: s.name,
              avatar: s.avatar,
              rank: idx + 1,
              totalScore: s.totalScore || 0,
              percentageScore: Number(s.percentageScore) || 0,
              averageScore: Number(s.avgScore) || 0,
              completed: s.completed,
              sectionId: selectedSectionId || 'all'
            }));
          
          console.log('🏆 Auto-saving leaderboard to Firebase:', {
            sectionId: selectedSectionId || 'all',
            top10Count: top10.length,
            top10: top10
          });
          
          await setLeaderboardForSection(selectedSectionId || 'all', top10);
          console.log('✅ Leaderboard auto-saved successfully to Firebase!');
        } catch (err) {
          console.error('❌ Failed to auto-save leaderboard:', err);
        }
      }
    };
    
    autoSaveLeaderboard();
  }, [sectionStudents, quizzes, selectedSectionId]);

  // Real-time quarterly data updates when class score modal is open
  useEffect(() => {
    const updateQuarterlyData = async () => {
      if (showClassScore) {
        const realTimeQuarterlyData = await calculateRealTimeQuarterlyData();
        setQuarterlyData(realTimeQuarterlyData);
      }
    };
    
    updateQuarterlyData();
  }, [sectionStudents, quizzes, showClassScore]);

  // Calculate class score and performance metrics based on selected section
  useEffect(() => {
    const updateMetrics = async () => {
      const currentStudents = sectionStudents;
      const studentCount = currentStudents.length;
      
      // Show basic student count immediately
      setTotalStudents(studentCount);
      
      if (studentCount > 0) {
        // Show initial values immediately
        setClassScore(0);
        setHighPerformersCount(0);
        setLowPerformersCount(0);
        
        // Use a faster approach - batch fetch all quiz results
        try {
          // Batch fetch all student quiz results at once
          const allQuizResults = await batchFetchStudentQuizResults(currentStudents);
          
          // Calculate performers using cached data
          const { highPerformersList, lowPerformersList, classScore } = calculatePerformersFromCache(currentStudents, allQuizResults);
          
          // Update with real data
          setClassScore(classScore);
          setHighPerformersCount(highPerformersList.length);
          setLowPerformersCount(lowPerformersList.length);

          // Persist Top 10 high performers whenever metrics recalc (even if modal closed)
          try {
            const top10 = highPerformersList
              .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
              .slice(0, 10)
              .map((s, idx) => ({
                studentId: s.id,
                name: s.name,
                avatar: s.avatar,
                rank: idx + 1,
                totalScore: s.totalScore || 0,
                percentageScore: Number(s.percentageScore) || 0,
                averageScore: Number(s.avgScore) || 0,
                completed: s.completed,
                sectionId: selectedSectionId || 'all'
              }));
            
            console.log('🏆 Writing leaderboard during metrics update:', {
              sectionId: selectedSectionId || 'all',
              top10Count: top10.length,
              top10: top10
            });
            
            await setLeaderboardForSection(selectedSectionId || 'all', top10);
            console.log('✅ Leaderboard saved successfully during metrics update!');
          } catch (lbErr) {
            console.error('❌ Failed to write leaderboard during metrics:', lbErr);
          }
        } catch (error) {
          console.error('Error calculating metrics:', error);
        }
      } else {
        setClassScore(0);
        setHighPerformersCount(0);
        setLowPerformersCount(0);
      }
    };
    
    updateMetrics();
  }, [sectionStudents, selectedSectionId, allStudents, quizzes]);


  // Optimized Click Handlers with Error Handling
  const handleLowPerformersClick = async () => {
    setShowLowPerformers(true);
    setDashboardLoading(true);
    
    try {
      // Get real-time low performers data
      const { lowPerformersList } = await calculatePerformers();
      setLowPerformers(lowPerformersList);
    } catch (error) {
      console.error('Error loading low performers:', error);
    } finally {
      setDashboardLoading(false);
    }
  };

  const handleHighPerformersClick = async () => {
    setShowHighPerformers(true);
    setDashboardLoading(true);
    
    try {
      // Get real-time high performers data
      const { highPerformersList } = await calculatePerformers();
      setHighPerformers(highPerformersList);
    } catch (error) {
      console.error('Error loading high performers:', error);
    } finally {
      setDashboardLoading(false);
    }
  };

  const handleQuizOverviewClick = () => {
    setShowQuizOverview(true);
    setQuizLoading(true);
    if (quizzes.length > 0) {
      setSelectedQuiz(quizzes[0]);
      generateQuizPerformance(quizzes[0]);
    }
  };

  // Function to format student name as "Last Name, First Name Initial"
  const formatStudentName = (student) => {
    const firstName = student.firstName || '';
    const middleName = student.middleName || '';
    const lastName = student.lastName || '';
    
    // Get first initial of first name
    const firstInitial = firstName.charAt(0).toUpperCase();
    
    // Get first initial of middle name if it exists
    const middleInitial = middleName ? middleName.charAt(0).toUpperCase() + '.' : '';
    
    // Format as "Last Name, First Name Initial"
    return `${lastName}, ${firstName} ${middleInitial}`.trim();
  };

  // Function to sort students numerically by student ID
  const sortStudentsByID = (students) => {
    return students.sort((a, b) => {
      // Extract numeric part from student ID (e.g., "student001" -> 1, "student033" -> 33)
      const getNumericID = (id) => {
        if (!id) return 999; // Put students without ID at the end
        const match = id.match(/student(\d+)/);
        return match ? parseInt(match[1], 10) : 999;
      };
      
      const idA = getNumericID(a.id);
      const idB = getNumericID(b.id);
      
      // Primary sort: by student ID number (001, 002, 003... 033)
      if (idA !== idB) {
        return idA - idB;
      }
      
      // Secondary sort: if same ID (shouldn't happen), maintain original order
      return 0;
    });
  };

  // Function to filter students based on search term (prioritizes Student ID)
  const filterStudents = (students, searchTerm) => {
    if (!searchTerm.trim()) return students;
    
    const term = searchTerm.toLowerCase();
    return students.filter(student => {
      const studentId = (student.id || '').toLowerCase();
      const fullName = formatStudentName(student).toLowerCase();
      const firstName = (student.firstName || '').toLowerCase();
      const lastName = (student.lastName || '').toLowerCase();
      
      // Primary search: Student ID (student001, student002, etc.)
      if (studentId.includes(term)) {
        return true;
      }
      
      // Secondary search: names
      return fullName.includes(term) || 
             firstName.includes(term) || 
             lastName.includes(term);
    });
  };


  const handleTotalStudentsClick = async () => {
    setShowTotalStudents(true);
    setSearchTerm(''); // Reset search when opening modal
    // Fetch real student data from Firebase
    try {
      const studentsSnapshot = await getDocs(studentsCollection());
      const studentsData = studentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort students numerically by student ID
      const sortedStudents = sortStudentsByID(studentsData);
      setAllStudents(sortedStudents);
      setFilteredStudents(sortedStudents);
    } catch (error) {
      console.error('Error fetching students:', error);
      setAllStudents([]);
      setFilteredStudents([]);
    }
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    
    // Filter students based on search term
    const filtered = filterStudents(allStudents, term);
    setFilteredStudents(filtered);
  };

  // Calculate real-time quarterly performance data (OPTIMIZED)
  const calculateRealTimeQuarterlyData = async () => {
    const currentStudents = sectionStudents;
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    // Define quarters - use current year
    const quarters = [
      { quarter: 'Quarter 1', period: `Jan - Mar ${currentYear}`, startMonth: 0, endMonth: 2, color: '#4fa37e' },
      { quarter: 'Quarter 2', period: `Apr - Jun ${currentYear}`, startMonth: 3, endMonth: 5, color: '#28a745' },
      { quarter: 'Quarter 3', period: `Jul - Sep ${currentYear}`, startMonth: 6, endMonth: 8, color: '#ffc107' },
      { quarter: 'Quarter 4', period: `Oct - Dec ${currentYear}`, startMonth: 9, endMonth: 11, color: '#17a2b8' }
    ];
    
    // OPTIMIZATION: Fetch quiz results in parallel for all students
    console.log('Fetching quiz results for all students in parallel...');
    const allQuizResults = new Map(); // studentId -> quizResults[]
    
    // Create parallel promises for all students
    const fetchPromises = currentStudents.map(async (student) => {
      try {
        const resultsCol = collection(db, 'users', 'students', 'students', student.id, 'quizResults');
        const resultsSnapshot = await getDocs(resultsCol);
        const studentResults = resultsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        allQuizResults.set(student.id, studentResults);
      } catch (err) {
        console.error(`Error fetching results for ${student.id}:`, err);
        allQuizResults.set(student.id, []);
      }
    });
    
    // Wait for all fetches to complete
    await Promise.all(fetchPromises);
    console.log(`Fetched quiz results for ${allQuizResults.size} students`);
    
    return Promise.all(quarters.map(async q => {
      console.log(`\n=== Processing ${q.quarter} ===`);
      
      // Calculate quiz-based pass rate for this quarter
      let totalScore = 0;
      let validStudents = 0;
      let passedStudents = 0;
      let failedStudents = 0;
      let totalStudentsWithQuarterQuizzes = 0;
      
      // Map quiz topics to quarters
      const quizToQuarter = {
        'Mixtures': 1,           // Quarter 1
        'Circulatory': 2,        // Quarter 2  
        'GravityForce': 3,       // Quarter 3
        'EarthVolcano': 4        // Quarter 4
      };
      
      const currentQuarterNum = parseInt(q.quarter.split(' ')[1]);
      
      for (const student of currentStudents) {
        // Get quiz results from our pre-fetched data
        const studentQuizResults = allQuizResults.get(student.id) || [];
        
        let quarterCorrect = 0;
        let quarterTotal = 0;
        
        studentQuizResults.forEach((quizResult, index) => {
          const answersArray = Array.isArray(quizResult.answers) ? quizResult.answers : [];
          const docId = quizResult.id;
          
          // Determine which quarter this quiz belongs to
          let quizQuarter = 0;
          for (const [topic, quarter] of Object.entries(quizToQuarter)) {
            if (docId.includes(topic)) {
              quizQuarter = quarter;
              break;
            }
          }
          
          // Only count if this quiz belongs to the current quarter
          if (quizQuarter === currentQuarterNum) {
            answersArray.forEach(a => { if (a.isCorrect === true) quarterCorrect++; });
            quarterTotal += answersArray.length;
          }
        });

        if (quarterTotal > 0) {
          totalStudentsWithQuarterQuizzes++;
          const percentage = Math.round((quarterCorrect / quarterTotal) * 100);
          totalScore += percentage;
          validStudents++;
          // Updated criteria: 6+ correct answers = PASSED, 5 and below = FAILED
          if (quarterCorrect >= 6) passedStudents++; else failedStudents++;
        }
      }
      
      const averageScore = validStudents > 0 ? Math.round(totalScore / validStudents) : 0;
      
      // Get quiz scores for this quarter (simulate based on current performance)
      const quizScores = [];
      const quizTitles = [];
      
      if (quizzes.length > 0) {
        quizzes.slice(0, 5).forEach((quiz, index) => {
          const baseScore = averageScore > 0 ? averageScore : 75;
          const variation = (Math.random() - 0.5) * 20; // ±10 points variation
          const quizScore = Math.max(0, Math.min(100, Math.round(baseScore + variation)));
          quizScores.push(quizScore);
          quizTitles.push(`Quiz ${index + 1}: ${quiz.title || 'Assessment'}`);
        });
      }
      
      return {
        quarter: q.quarter,
        period: q.period,
        averageScore: averageScore,
        totalStudents: totalStudentsWithQuarterQuizzes,
        passedStudents: passedStudents,
        failedStudents: failedStudents,
        color: q.color,
        quizScores: quizScores,
        quizTitles: quizTitles
      };
    }));
  };

  const handleClassScoreClick = async () => {
    setShowClassScore(true);
    // Generate real-time quarterly performance data
    const realTimeQuarterlyData = await calculateRealTimeQuarterlyData();
    setQuarterlyData(realTimeQuarterlyData);

    // Subscribe to real-time updates of quizResults for the selected section
    try {
      if (unsubscribeQuarterlyRef.current) {
        unsubscribeQuarterlyRef.current();
      }
      const sectionStudentIds = sectionStudents.map(s => s.id);
      const colRefs = sectionStudentIds.map(id => collection(db, 'users', 'students', 'students', id, 'quizResults'));
      const unsubs = colRefs.map(colRef => onSnapshot(colRef, (snapshot) => {
        console.log('Quiz results updated, recalculating quarterly data...');
        calculateRealTimeQuarterlyData().then(data => {
          console.log('Updated quarterly data:', data);
          setQuarterlyData(data);
        }).catch(err => {
          console.error('Error updating quarterly data:', err);
        });
      }));
      unsubscribeQuarterlyRef.current = () => unsubs.forEach(u => u && u());
    } catch {}
    // Initialize view mode for each quarter (false = show average, true = show failed percentage)
    const initialViewMode = {};
    realTimeQuarterlyData.forEach(quarter => {
      initialViewMode[quarter.quarter] = false;
    });
    setQuarterlyViewMode(initialViewMode);
  };

  // Cleanup real-time subscription when modal closes
  useEffect(() => {
    if (!showClassScore && unsubscribeQuarterlyRef.current) {
      unsubscribeQuarterlyRef.current();
      unsubscribeQuarterlyRef.current = null;
    }
  }, [showClassScore]);

  const handleClassScoreClickOld = () => {
    setShowClassScore(true);
    // Generate quarterly performance data based on quiz data
    const mockQuarterlyData = [
      {
        quarter: 'Quarter 1',
        period: 'Jan - Mar 2024',
        averageScore: 78,
        totalStudents: totalStudents,
        passedStudents: Math.floor(totalStudents * 0.85),
        failedStudents: Math.floor(totalStudents * 0.15),
        color: '#4fa37e',
        quizScores: [75, 82, 78, 85, 72, 80, 76, 84, 79, 77], // Mock quiz scores for Quarter 1
        quizTitles: ['Quiz 1: Basic Concepts', 'Quiz 2: Advanced Topics', 'Quiz 3: Problem Solving', 'Quiz 4: Application', 'Quiz 5: Review']
      },
      {
        quarter: 'Quarter 2',
        period: 'Apr - Jun 2024',
        averageScore: 82,
        totalStudents: totalStudents,
        passedStudents: Math.floor(totalStudents * 0.88),
        failedStudents: Math.floor(totalStudents * 0.12),
        color: '#28a745',
        quizScores: [80, 85, 83, 88, 79, 84, 81, 86, 82, 87], // Mock quiz scores for Quarter 2
        quizTitles: ['Quiz 6: Mid-term Prep', 'Quiz 7: Critical Thinking', 'Quiz 8: Analysis', 'Quiz 9: Synthesis', 'Quiz 10: Evaluation']
      },
      {
        quarter: 'Quarter 3',
        period: 'Jul - Sep 2024',
        averageScore: 75,
        totalStudents: totalStudents,
        passedStudents: Math.floor(totalStudents * 0.80),
        failedStudents: Math.floor(totalStudents * 0.20),
        color: '#ffc107',
        quizScores: [72, 78, 74, 80, 71, 76, 73, 79, 75, 77], // Mock quiz scores for Quarter 3
        quizTitles: ['Quiz 11: Summer Review', 'Quiz 12: New Concepts', 'Quiz 13: Practice', 'Quiz 14: Assessment', 'Quiz 15: Progress']
      },
      {
        quarter: 'Quarter 4',
        period: 'Oct - Dec 2024',
        averageScore: 85,
        totalStudents: totalStudents,
        passedStudents: Math.floor(totalStudents * 0.92),
        failedStudents: Math.floor(totalStudents * 0.08),
        color: '#17a2b8',
        quizScores: [83, 87, 85, 90, 82, 88, 84, 89, 86, 91], // Mock quiz scores for Quarter 4
        quizTitles: ['Quiz 16: Final Prep', 'Quiz 17: Comprehensive', 'Quiz 18: Mastery', 'Quiz 19: Excellence', 'Quiz 20: Achievement']
      }
    ];
    setQuarterlyData(mockQuarterlyData);
    // Initialize view mode for each quarter (false = show average, true = show failed percentage)
    const initialViewMode = {};
    mockQuarterlyData.forEach(quarter => {
      initialViewMode[quarter.quarter] = false;
    });
    setQuarterlyViewMode(initialViewMode);
  };

  // Chart data functions
  const getQuarterlyBarChartData = () => {
    return {
      labels: quarterlyData.map(q => q.quarter),
      datasets: [
        {
          label: 'Average Score %',
          data: quarterlyData.map(q => q.averageScore),
          backgroundColor: quarterlyData.map(q => q.color + '80'),
          borderColor: quarterlyData.map(q => q.color),
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false,
        }
      ]
    };
  };


  const getPerformanceDistributionData = () => {
    const totalPassed = quarterlyData.reduce((sum, q) => sum + q.passedStudents, 0);
    const totalFailed = quarterlyData.reduce((sum, q) => sum + q.failedStudents, 0);
    
    return {
      labels: ['Passed Students', 'Failed Students'],
      datasets: [{
        data: [totalPassed, totalFailed],
        backgroundColor: ['#4fa37e', '#dc3545'],
        borderColor: ['#3d8b6f', '#c82333'],
        borderWidth: 2,
        hoverOffset: 4
      }]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12,
            weight: '600'
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#4fa37e',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          font: {
            size: 11,
            weight: '500'
          }
        }
      },
      x: {
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          font: {
            size: 11,
            weight: '500'
          }
        }
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12,
            weight: '600'
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#4fa37e',
        borderWidth: 1,
        cornerRadius: 8
      }
    }
  };

  const handleQuizSelect = (quiz) => {
    setSelectedQuiz(quiz);
    setQuizLoading(true);
    generateQuizPerformance(quiz);
  };

  const generateQuizPerformance = async (quiz) => {
    if (!quiz || !quiz.questions) return;
    
    setQuizLoading(true);
    
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

    const topic = getTopicFromTitle(quiz.title);
    if (!topic) return;

    // Calculate real performance data from student responses in Firestore
    const performance = await Promise.all(quiz.questions.map(async (question, index) => {
      let correctAnswers = 0;
      let incorrectAnswers = 0;
      let totalStudents = 0;
      
      // Count responses from all students using Firestore quizResults
      for (const student of allStudents) {
        try {
          // Get student's quiz results from Firestore path: /users/students/students/{studentId}/quizResults
          const resultsCol = collection(db, 'users', 'students', 'students', student.id, 'quizResults');
          const resultsSnapshot = await getDocs(resultsCol);
          
          // Find the latest result doc for this topic
          const docs = resultsSnapshot.docs
            .map(d => ({ id: d.id, ...(d.data() || {}) }))
            .filter(d => d.id && d.id.startsWith(topic));

          if (docs.length > 0) {
            const latest = docs.sort((a, b) => (a.id > b.id ? -1 : 1))[0];
            const answersArray = Array.isArray(latest.answers) ? latest.answers : [];
            
            if (answersArray[index]) {
              totalStudents++;
              const answer = answersArray[index];
              if (answer.isCorrect === true) {
                correctAnswers++;
              } else if (answer.isCorrect === false) {
                incorrectAnswers++;
              }
            }
          }
        } catch (error) {
          console.error(`Error fetching quiz results for student ${student.id}:`, error);
        }
      }
      
      return {
        questionNumber: index + 1,
        correctAnswers,
        incorrectAnswers,
        totalStudents: totalStudents || allStudents.length, // Fallback to total students if no responses
        questionText: question.question
      };
    }));
    
    setQuizPerformance(performance);
    setQuizLoading(false);
  };

  // Quiz colors matching the assessment page
  const getQuizColor = (quizIndex) => {
    const colors = ['#d4edda', '#f8d7da', '#f9efc3', '#e6d1b3'];
    return colors[quizIndex % colors.length];
  };

  // Toggle quarterly view mode (average vs failed percentage)
  const toggleQuarterlyView = (quarter) => {
    setQuarterlyViewMode(prev => ({
      ...prev,
      [quarter]: !prev[quarter]
    }));
  };

  // Handle section filter change
  const handleSectionChange = (sectionId) => {
    setSelectedSectionId(sectionId);
  };


  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
          {/* Professional Loading Indicator */}
          {dashboardLoading && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
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
              zIndex: 1000,
              minWidth: 280
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
                Loading Dashboard
              </h3>
              
              <p style={{
                fontSize: 14,
                color: '#6c757d',
                margin: 0,
                textAlign: 'center',
                lineHeight: 1.5,
                maxWidth: 200
              }}>
                Fetching your latest data and analytics...
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
          )}

          {/* Professional Header Section */}
          <div style={{ 
            marginBottom: 32, 
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
                Dashboard
              </h1>
              <p style={{ 
                fontSize: 16, 
                color: '#6c757d', 
                margin: 0,
                fontWeight: 400,
                lineHeight: 1.4
              }}>
                Overview of your class performance and key metrics
              </p>
            </div>

            {/* Section Filter */}
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
                    {section.name} ({allStudents.filter(s => s.sectionId === section.id).length})
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="cards">
            <div className="card card-1" onClick={handleClassScoreClick} style={{ cursor: 'pointer' }}>
              <div className="card--data">
                <div className="card--content">
                  <h5 className="card--title">Class Score</h5>
              
                </div>
                <i className="ri-trophy-line card--icon--lg"></i>
              </div>
            </div>
            <div className="card card-2" onClick={handleTotalStudentsClick} style={{ cursor: 'pointer' }}>
              <div className="card--data">
                <div className="card--content">
                  <h5 className="card--title">Total Students</h5>
                  <h1>{totalStudents}</h1>
                </div>
                <i className="ri-user-line card--icon--lg"></i>
              </div>
            </div>
            <div className="card card-3" onClick={handleHighPerformersClick} style={{ cursor: 'pointer' }}>
              <div className="card--data">
                <div className="card--content">
                  <h5 className="card--title">High Performers</h5>
                  <h1>{highPerformersCount}</h1>
                </div>
                <i className="ri-line-chart-line card--icon--lg"></i>
              </div>
            </div>
            <div className="card card-4" onClick={handleLowPerformersClick} style={{ cursor: 'pointer' }}>
              <div className="card--data">
                <div className="card--content">
                  <h5 className="card--title">Low Performers</h5>
                  <h1>{lowPerformersCount}</h1>
                </div>
                <i className="ri-error-warning-line card--icon--lg"></i>
              </div>
            </div>
            <div className="card card-6" onClick={handleQuizOverviewClick} style={{ background: '#f3e8ff', color: '#a259e6', cursor: 'pointer' }}>
              <div className="card--data">
                <div className="card--content">
                  <h5 className="card--title">Quiz Overview</h5>
                </div>
                <i className="ri-file-list-3-line card--icon--lg"></i>
              </div>
            </div>
          </div>

          {/* Quiz Overview Modal */}
          {showQuizOverview && (
            <div style={{
              position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.15)', zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{ 
                background: '#f1fcf7', 
                borderRadius: 24, 
                padding: 32, 
                minWidth: 1200, 
                maxWidth: '95vw',
                maxHeight: '90vh',
                overflow: 'auto',
                position: 'relative'
              }}>
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
                    color: '#333'
                  }}
                  onClick={() => setShowQuizOverview(false)}
                  aria-label="Close"
                >
                  ×
                </button>
                
                <div style={{ background: '#f1fcf7', borderRadius: 24, padding: 24 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    marginBottom: 32
                  }}>
                    <div style={{
                      width: 60,
                      height: 60,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: 28,
                      fontWeight: 'bold'
                    }}>
                      📝
                    </div>
                    <div>
                      <h2 style={{
                        fontSize: 28,
                        fontWeight: 700,
                        color: '#2c3e50',
                        margin: '0 0 4px 0'
                      }}>
                        Quiz Overview
                      </h2>
                      <p style={{
                        fontSize: 16,
                        color: '#6c757d',
                        margin: 0
                      }}>
                        Analyze quiz performance and identify areas for improvement
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 24 }}>
                    {/* Quiz List */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        background: 'white',
                        borderRadius: 20,
                        padding: 24,
                        border: '2px solid rgba(111, 66, 193, 0.1)',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                      }}>
                        <h3 style={{ 
                          margin: '0 0 20px 0', 
                          fontSize: 20, 
                          fontWeight: 700, 
                          color: '#2c3e50',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        }}>
                          📋 Select Quiz
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {quizzes.map((quiz, index) => {
                          const quizColor = getQuizColor(index);
                          const isSelected = selectedQuiz?.id === quiz.id;
                          return (
                            <button
                              key={quiz.id}
                              onClick={() => handleQuizSelect(quiz)}
                              style={{
                                  background: isSelected ? quizColor : 'white',
                                border: isSelected ? `2px solid ${quizColor}` : '2px solid #e9ecef',
                                borderRadius: 16,
                                padding: '16px 20px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontSize: 16,
                                  fontWeight: 600,
                                  color: isSelected ? '#2c3e50' : '#6c757d',
                                  transition: 'all 0.3s ease',
                                  boxShadow: isSelected ? '0 4px 12px rgba(0, 0, 0, 0.15)' : '0 2px 4px rgba(0, 0, 0, 0.05)',
                                  transform: isSelected ? 'translateY(-2px)' : 'translateY(0)'
                                }}
                                onMouseOver={(e) => {
                                  if (!isSelected) {
                                    e.target.style.background = '#f8f9fa';
                                    e.target.style.borderColor = '#6f42c1';
                                    e.target.style.transform = 'translateY(-1px)';
                                    e.target.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
                                  }
                                }}
                                onMouseOut={(e) => {
                                  if (!isSelected) {
                                    e.target.style.background = 'white';
                                    e.target.style.borderColor = '#e9ecef';
                                    e.target.style.transform = 'translateY(0)';
                                    e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                                  }
                              }}
                            >
                              {quiz.title}
                            </button>
                          );
                        })}
                        </div>
                      </div>
                    </div>

                    {/* Quiz Performance Details */}
                    <div style={{ flex: 2 }}>
                      <div style={{
                        background: 'white',
                        borderRadius: 20,
                        padding: 24,
                        border: '2px solid rgba(111, 66, 193, 0.1)',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                        minHeight: 400
                      }}>
                        <h3 style={{ 
                          margin: '0 0 20px 0', 
                          fontSize: 20, 
                          fontWeight: 700, 
                          color: '#2c3e50',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        }}>
                          📊 {selectedQuiz?.title || 'Select a Quiz'}
                      </h3>
                        {quizLoading ? (
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 60,
                            minHeight: 300,
                            background: '#f8f9fa',
                            borderRadius: 16,
                            border: '2px dashed #dee2e6'
                          }}>
                            <div style={{
                              width: 60,
                              height: 60,
                              border: '4px solid #e9ecef',
                              borderTop: '4px solid #6f42c1',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite',
                              marginBottom: 20
                            }}></div>
                            <div style={{
                              fontSize: 18,
                              fontWeight: 600,
                              color: '#6c757d',
                              marginBottom: 8
                            }}>
                              Loading Quiz Data...
                            </div>
                            <div style={{
                              fontSize: 14,
                              color: '#999',
                              textAlign: 'center'
                            }}>
                              Fetching student answers from database
                            </div>
                          </div>
                        ) : selectedQuiz && quizPerformance.length > 0 ? (
                        <div style={{
                          background: getQuizColor(quizzes.findIndex(q => q.id === selectedQuiz.id)),
                          borderRadius: 16,
                          padding: 24,
                            minHeight: 300
                        }}>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr 1fr',
                            gap: '20px',
                            fontWeight: 700,
                            padding: '0 24px',
                              color: '#2c3e50',
                            alignItems: 'center',
                            minHeight: 60,
                            height: 60,
                            marginBottom: 12,
                            fontSize: 18,
                            background: 'white',
                              borderRadius: 12,
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>Question Number</div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>Correct Answers</div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>Incorrect Answers</div>
                          </div>
                          {quizPerformance.map((perf, index) => (
                            <div key={index} style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr 1fr',
                              gap: '20px',
                              alignItems: 'center',
                              background: 'white',
                              borderRadius: 12,
                              margin: '8px 0',
                              padding: '0 24px',
                              minHeight: 50,
                              height: 50,
                                border: '2px solid #e9ecef',
                                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseOver={(e) => {
                                e.target.style.transform = 'translateY(-1px)';
                                e.target.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
                              }}
                              onMouseOut={(e) => {
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                              }}
                              >
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center', 
                                  fontWeight: 600, 
                                  fontSize: 16,
                                  color: '#2c3e50'
                                }}>
                                  {perf.questionNumber}
                                </div>
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center', 
                                  fontWeight: 600, 
                                  fontSize: 16, 
                                  color: '#155724',
                                  background: 'rgba(21, 87, 36, 0.1)',
                                  borderRadius: 8,
                                  padding: '4px 8px'
                                }}>
                                  {perf.correctAnswers}
                                </div>
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center', 
                                  fontWeight: 600, 
                                  fontSize: 16, 
                                  color: '#721c24',
                                  background: 'rgba(114, 28, 36, 0.1)',
                                  borderRadius: 8,
                                  padding: '4px 8px'
                                }}>
                                  {perf.incorrectAnswers}
                                </div>
                            </div>
                          ))}
                        </div>
                        ) : (
                          <div style={{
                            textAlign: 'center',
                            padding: 60,
                            color: '#6c757d',
                            fontSize: 18
                          }}>
                            <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
                            <div>Select a quiz to view performance details</div>
                            <div style={{ fontSize: 14, marginTop: 8, color: '#999' }}>
                              Choose a quiz from the left panel to see question-by-question analysis
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

          {/* Low Performers Modal */}
          {showLowPerformers && (
            <div style={{
              position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.15)', zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{ 
                background: '#f1fcf7', 
                borderRadius: 24, 
                padding: 32, 
                minWidth: 1200, 
                maxWidth: '95vw',
                maxHeight: '90vh',
                overflow: 'auto',
                position: 'relative'
              }}>
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
                    color: '#333'
                  }}
                  onClick={() => setShowLowPerformers(false)}
                  aria-label="Close"
                >
                  ×
                </button>
                
                <div style={{ background: '#f1fcf7', borderRadius: 24, padding: 24 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    marginBottom: 32
                  }}>
                    <div style={{
                      width: 60,
                      height: 60,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: 28,
                      fontWeight: 'bold'
                    }}>
                      ⚠️
                    </div>
                    <div>
                      <h2 style={{
                        fontSize: 28,
                        fontWeight: 700,
                        color: '#2c3e50',
                        margin: '0 0 4px 0'
                      }}>
                        Low Performers ({lowPerformers.length})
                      </h2>
                      <p style={{
                        fontSize: 16,
                        color: '#6c757d',
                        margin: 0
                      }}>
                        Students who may need additional support and attention
                      </p>
                    </div>
                  </div>

                  {lowPerformers.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: 60,
                      color: '#6c757d',
                      fontSize: 18
                    }}>
                      <div style={{ fontSize: 48, marginBottom: 16 }}>📈</div>
                      <div>No low performers found</div>
                      <div style={{ fontSize: 14, marginTop: 8, color: '#999' }}>
                        All students are performing well
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Column Headers */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '2.5fr 1fr',
                    fontWeight: 700,
                    padding: '0px 24px',
                    color: 'rgb(68, 68, 68)',
                    alignItems: 'center',
                    minHeight: '60px',
                    height: '60px',
                    marginBottom: '12px',
                    fontSize: '18px',
                    background: 'rgba(255, 255, 255, 0.5)',
                    borderRadius: '12px',
                    border: '1px solid rgba(0, 0, 0, 0.1)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>Full Name</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>Total Points</div>
                  </div>  
                      
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16
                      }}>
                        {lowPerformers.map((student, index) => {
                          const cardColors = ['#e6b3b3', '#b3e6c7', '#f8d7da', '#d1ecf1'];
                          const cardColor = cardColors[index % cardColors.length];
                          
                          return (
                            <div
                              key={student.id}
                              style={{
                                background: cardColor,
                      borderRadius: 18,
                      padding: '0 24px',
                      minHeight: 90,
                                height: 90,
                                display: 'grid',
                                gridTemplateColumns: '2.5fr 1fr',
                                alignItems: 'center',
                                border: '2px solid rgba(255, 255, 255, 0.3)',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                              }}
                            >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                <img 
                                  src={student.avatar} 
                                  alt="avatar" 
                                  style={{ 
                                    width: 60, 
                                    height: 60, 
                                    borderRadius: '50%', 
                                    border: '4px solid #fff', 
                                    background: '#fff' 
                                  }} 
                                />
                                <span style={{ fontSize: 18, fontWeight: 600, color: '#2c3e50' }}>
                                  {student.name}
                                </span>
                      </div>
                              <div style={{ display: 'flex', alignItems: 'right ', justifyContent: 'center' }}>
                                <div style={{ textAlign: 'right', fontWeight: 600, fontSize: 18, color: '#2c3e50' }}>
                                  {student.totalScore || 0}
                                </div>
                              </div>
                    </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* High Performers Modal */}
          {showHighPerformers && (
            <div style={{
              position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.15)', zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{ 
                background: '#f1fcf7', 
                borderRadius: 24, 
                padding: 32, 
                minWidth: 1200, 
                maxWidth: '95vw',
                maxHeight: '90vh',
                overflow: 'auto',
                position: 'relative'
              }}>
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
                    color: '#333'
                  }}
                  onClick={() => setShowHighPerformers(false)}
                  aria-label="Close"
                >
                  ×
                </button>
                
                <div style={{ background: '#f1fcf7', borderRadius: 24, padding: 24 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    marginBottom: 32
                  }}>
                    <div style={{
                      width: 60,
                      height: 60,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: 28,
                      fontWeight: 'bold'
                    }}>
                      🏆
                    </div>
                    <div>
                      <h2 style={{
                        fontSize: 28,
                        fontWeight: 700,
                        color: '#2c3e50',
                        margin: '0 0 4px 0'
                      }}>
                        High Performers ({highPerformers.length})
                      </h2>
                      <p style={{
                        fontSize: 16,
                        color: '#6c757d',
                        margin: 0
                      }}>
                        Students who consistently excel in their academic performance
                      </p>
                    </div>
                  </div>

                  {highPerformers.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: 60,
                      color: '#6c757d',
                      fontSize: 18
                    }}>
                      <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
                      <div>No high performers found</div>
                      <div style={{ fontSize: 14, marginTop: 8, color: '#999' }}>
                        High performers will appear here based on their quiz scores
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Column Headers */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '2.5fr 1fr',
                    fontWeight: 700,
                    padding: '0 24px',
                    color: '#444',
                    alignItems: 'center',
                        minHeight: 60,
                        height: 60,
                    marginBottom: 12,
                        fontSize: 18,
                        background: 'rgba(255, 255, 255, 0.5)',
                        borderRadius: 12,
                        border: '1px solid rgba(0, 0, 0, 0.1)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>Full Name</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>Total Points</div>
                  </div>
                      
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16
                      }}>
                      {highPerformers.map((student, index) => {
                        const cardColors = ['#fff3cd', '#f4e4d6', '#d4edda', '#e2e3e5'];
                        const cardColor = cardColors[index % cardColors.length];
                        
                        return (
                          <div
                            key={student.id}
                            style={{
                              background: cardColor,
                      borderRadius: 18,
                      padding: '0 24px',
                      minHeight: 90,
                              height: 90,
                              display: 'grid',
                              gridTemplateColumns: '2.5fr 1fr',
                              alignItems: 'center',
                              border: '2px solid rgba(255, 255, 255, 0.3)',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                            }}
                          >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                              <img 
                                src={student.avatar} 
                                alt="avatar" 
                                style={{ 
                                  width: 60, 
                                  height: 60, 
                                  borderRadius: '50%', 
                                  border: '4px solid #fff', 
                                  background: '#fff' 
                                }} 
                              />
                              <span style={{ fontSize: 18, fontWeight: 600, color: '#2c3e50' }}>
                                {student.name}
                              </span>
                      </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <div style={{ textAlign: 'center', fontWeight: 600, fontSize: 18, color: '#2c3e50' }}>
                                {student.totalScore || 0}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
                      )}

          {/* Total Students Modal */}
          {showTotalStudents && (
            <div style={{
              position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.15)', zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{ 
                background: '#f1fcf7', 
                borderRadius: 24, 
                padding: 32, 
                minWidth: 1200, 
                maxWidth: '95vw',
                maxHeight: '90vh',
                overflow: 'auto',
                position: 'relative'
              }}>
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
                    color: '#333'
                  }}
                  onClick={() => setShowTotalStudents(false)}
                  aria-label="Close"
                >
                  ×
                </button>
                
                <div style={{ background: '#f1fcf7', borderRadius: 24, padding: 24 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 32
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16
                    }}>
                      <div style={{
                        width: 60,
                        height: 60,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #4fa37e 0%, #3d8b6f 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: 28,
                        fontWeight: 'bold'
                      }}>
                        👥
                      </div>
                      <div>
                        <h2 style={{
                          fontSize: 28,
                          fontWeight: 700,
                          color: '#2c3e50',
                          margin: '0 0 4px 0'
                        }}>
                          All Students ({filteredStudents.length})
                        </h2>
                        <p style={{
                          fontSize: 16,
                          color: '#6c757d',
                          margin: 0
                        }}>
                          Complete list of enrolled students
                        </p>
                      </div>
                    </div>

                    {/* Search Bar - Right Side */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: '#f8f9fa',
                      borderRadius: 8,
                      padding: '8px 12px',
                      border: '2px solid #e9ecef',
                      transition: 'border-color 0.2s ease',
                      minWidth: 250
                    }}>
                      <i className="ri-search-line" style={{
                        fontSize: 16,
                        color: '#6c757d'
                      }}></i>
                      <input
                        type="text"
                        placeholder="Search students..."
                        value={searchTerm}
                        onChange={handleSearchChange}
                        style={{
                          flex: 1,
                          border: 'none',
                          background: 'transparent',
                          fontSize: 14,
                          color: '#2c3e50',
                          outline: 'none',
                          fontFamily: 'inherit',
                          minWidth: 0
                        }}
                      />
                      {searchTerm && (
                        <button
                          onClick={() => {
                            setSearchTerm('');
                            setFilteredStudents(allStudents);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#6c757d',
                            cursor: 'pointer',
                            fontSize: 14,
                            padding: 2,
                            borderRadius: 4,
                            transition: 'color 0.2s ease'
                          }}
                          onMouseEnter={(e) => e.target.style.color = '#dc3545'}
                          onMouseLeave={(e) => e.target.style.color = '#6c757d'}
                        >
                          <i className="ri-close-line"></i>
                        </button>
                      )}
                    </div>
                  </div>

                  {allStudents.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: 60,
                      color: '#6c757d',
                      fontSize: 18
                    }}>
                      <div style={{ fontSize: 48, marginBottom: 16 }}>📚</div>
                      <div>No students found</div>
                      <div style={{ fontSize: 14, marginTop: 8, color: '#999' }}>
                        Students will appear here once they are added to the system
                      </div>
                    </div>
                  ) : filteredStudents.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: 60,
                      color: '#6c757d',
                      fontSize: 18
                    }}>
                      <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
                      <div>No students found matching "{searchTerm}"</div>
                      <div style={{ fontSize: 14, marginTop: 8, color: '#999' }}>
                        Try searching with a different term or clear the search
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                      gap: 20,
                      maxHeight: '60vh',
                      overflowY: 'auto',
                      padding: '0 8px'
                    }}>
                      {filteredStudents.map((student, index) => {
                        const cardColors = ['#f9efc3', '#e6d1b3', '#e6b3b3', '#b3e6c7', '#d4edda', '#f8d7da', '#e2e3e5'];
                        const cardColor = cardColors[index % cardColors.length];
                        
                        return (
                          <div
                            key={student.id || student.lrn}
                            style={{
                              background: cardColor,
                              borderRadius: 20,
                              padding: 24,
                              border: '2px solid rgba(255, 255, 255, 0.3)',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                              cursor: 'default'
                            }}
                          >
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 16,
                              marginBottom: 16
                            }}>
                              <img 
                                src={student.avatar || '/avatar3.png'} 
                                alt="Student Avatar" 
                                style={{ 
                                  width: 60, 
                                  height: 60, 
                                  borderRadius: '50%', 
                                  border: '4px solid #fff',
                                  objectFit: 'cover'
                                }} 
                              />
                              <div style={{ flex: 1 }}>
                                <h3 style={{
                                  fontSize: 18,
                                  fontWeight: 700,
                                  color: '#2c3e50',
                                  margin: '0 0 4px 0',
                                  lineHeight: 1.2,
                                  fontFamily: 'monospace'
                                }}>
                                  {student.id ? student.id.replace('student', 'Student') : 'N/A'}
                                </h3>
                                <div style={{
                                  fontSize: 14,
                                  color: '#6c757d',
                                  fontWeight: 500
                                }}>
                                  {formatStudentName(student)}
                                </div>
                              </div>
                            </div>
                            
                            <div style={{
                              background: 'rgba(255, 255, 255, 0.6)',
                              borderRadius: 12,
                              padding: 16,
                              border: '1px solid rgba(255, 255, 255, 0.4)'
                            }}>
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: 12,
                                fontSize: 14
                              }}>
                                <div>
                                  <div style={{
                                    fontWeight: 600,
                                    color: '#2c3e50',
                                    marginBottom: 4
                                  }}>
                                    LRN Number
                                  </div>
                                  <div style={{
                                    color: '#6c757d',
                                    fontFamily: 'monospace',
                                    fontSize: 13
                                  }}>
                                    {student.lrn || 'N/A'}
                                  </div>
                                </div>
                                <div>
                                  <div style={{
                                    fontWeight: 600,
                                    color: '#2c3e50',
                                    marginBottom: 4
                                  }}>
                                    Status
                                  </div>
                                  <div style={{
                                    color: '#6c757d',
                                    fontSize: 13
                                  }}>
                                    {student.currentStatus || 'Regular Student'}
                                  </div>
                                </div>
                                {student.gender && (
                                  <div>
                                    <div style={{
                                      fontWeight: 600,
                                      color: '#2c3e50',
                                      marginBottom: 4
                                    }}>
                                      Gender
                                    </div>
                                    <div style={{
                                      color: '#6c757d',
                                      fontSize: 13
                                    }}>
                                      {student.gender}
                                    </div>
                                  </div>
                                )}
                                {student.dateOfEnrollment && (
                                  <div>
                                    <div style={{
                                      fontWeight: 600,
                                      color: '#2c3e50',
                                      marginBottom: 4
                                    }}>
                                      Enrolled
                                    </div>
                                    <div style={{
                                      color: '#6c757d',
                                      fontSize: 13
                                    }}>
                                      {new Date(student.dateOfEnrollment).toLocaleDateString()}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {/* Quiz Scores removed to avoid redundancy with Student Assessment */}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Class Score Modal - Professional Chart.js Version */}
          {showClassScore && (
            <div style={{
              position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)'
            }}>
              <div style={{ 
                background: 'white', 
                borderRadius: 24, 
                padding: 32, 
                minWidth: 1400, 
                maxWidth: '95vw',
                maxHeight: '90vh',
                overflow: 'auto',
                position: 'relative',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
              }}>
                <button
                  style={{ 
                    position: 'absolute', 
                    top: 20, 
                    right: 20, 
                    background: 'rgba(0,0,0,0.1)', 
                    border: 'none', 
                    fontSize: 24, 
                    cursor: 'pointer', 
                    fontWeight: 'bold', 
                    color: '#333',
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => setShowClassScore(false)}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(220, 53, 69, 0.1)';
                    e.target.style.color = '#dc3545';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(0,0,0,0.1)';
                    e.target.style.color = '#333';
                  }}
                  aria-label="Close"
                >
                  ×
                </button>
                
                <div style={{ background: 'white', borderRadius: 24, padding: 24 }}>
                  {/* Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    marginBottom: 32
                  }}>
                    <div style={{
                      width: 60,
                      height: 60,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #4fa37e 0%, #3d8b6f 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: 28,
                      fontWeight: 'bold',
                      boxShadow: '0 4px 12px rgba(79, 163, 126, 0.3)'
                    }}>
                      📊
                    </div>
                    <div>
                      <h2 style={{
                        fontSize: 28,
                        fontWeight: 700,
                        color: '#2c3e50',
                        margin: '0 0 4px 0'
                      }}>
                        Quarterly Performance Analysis
                      </h2>
                      <p style={{
                        fontSize: 16,
                        color: '#6c757d',
                        margin: 0
                      }}>
                        Comprehensive analysis of quiz performance across all quarters to identify trends and areas for improvement
                      </p>
                    </div>
                  </div>

                  {/* Charts Grid (Quarterly Average Scores removed) */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
                    gap: 24,
                    marginBottom: 32
                  }}>
                    {/* Performance Distribution */}
                    <div style={{
                      background: 'white',
                      borderRadius: 16,
                      padding: 24,
                      border: '1px solid #e9ecef',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 20
                      }}>
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          background: 'linear-gradient(135deg, #ffc107 0%, #e0a800 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: 18
                        }}>
                          <i className="ri-pie-chart-line"></i>
                        </div>
                        <div>
                          <h3 style={{
                            margin: 0,
                            fontSize: 18,
                            fontWeight: 700,
                            color: '#2c3e50'
                          }}>
                            Overall Performance
                          </h3>
                        </div>
                      </div>
                      <div style={{ height: 300 }}>
                        <Doughnut data={getPerformanceDistributionData()} options={doughnutOptions} />
                      </div>
                    </div>

                  </div>

                  {/* Quarterly Cards */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: 20,
                    marginBottom: 32
                  }}>
                    {quarterlyData.map((quarter, index) => (
                      <div
                        key={quarter.quarter}
                        style={{
                          background: 'white',
                          borderRadius: 16,
                          padding: 24,
                          border: `2px solid ${quarter.color}20`,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          position: 'relative',
                          transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-4px)';
                          e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 20
                        }}>
                          <div>
                            <h3 style={{
                              fontSize: 20,
                              fontWeight: 700,
                              color: '#2c3e50',
                              margin: '0 0 4px 0'
                            }}>
                              {quarter.quarter}
                            </h3>
                            <p style={{
                              fontSize: 14,
                              color: '#6c757d',
                              margin: 0,
                              fontWeight: 500
                            }}>
                              {quarter.period}
                            </p>
                          </div>
                          {/* Percentage badge removed; percentage will show inside chart */}
                        </div>

                        {/* Mini Circular Chart (Average Score or Failed Percentage) */}
                        <div style={{ marginBottom: 20 }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <div 
                              style={{ 
                                width: 120, 
                                height: 120, 
                                position: 'relative',
                                cursor: 'pointer'
                              }}
                              onClick={() => toggleQuarterlyView(quarter.quarter)}
                            >
                              {/* Gray background circle */}
                              <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: 120,
                                height: 120,
                                borderRadius: '50%',
                                border: '2px solid #e9ecef',
                                zIndex: 0
                              }}></div>
                              <Doughnut
                                data={{
                                  labels: quarterlyViewMode[quarter.quarter] ? ['Failed', 'Remaining'] : ['Average', 'Remaining'],
                                  datasets: [{
                                    data: quarterlyViewMode[quarter.quarter] 
                                      ? [Math.round((quarter.failedStudents / (quarter.passedStudents + quarter.failedStudents)) * 100), Math.round((quarter.passedStudents / (quarter.passedStudents + quarter.failedStudents)) * 100)]
                                      : [quarter.averageScore, Math.max(0, 100 - quarter.averageScore)],
                                    backgroundColor: quarterlyViewMode[quarter.quarter]
                                      ? ['#dc3545', '#e9ecef']
                                      : [quarter.color, '#e9ecef'],
                                    borderColor: quarterlyViewMode[quarter.quarter]
                                      ? ['#ffffff', '#ffffff']
                                      : ['#ffffff', '#ffffff'],
                                    borderWidth: 2,
                                    hoverOffset: 0
                                  }]
                                }}
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  cutout: '70%',
                                  plugins: {
                                    legend: { display: false },
                                    tooltip: { enabled: false }
                                  },
                                  animation: false
                                }}
                              />
                              <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                fontWeight: 700,
                                fontSize: 20,
                                color: quarterlyViewMode[quarter.quarter] ? '#dc3545' : '#2c3e50'
                              }}>
                                {quarterlyViewMode[quarter.quarter]
                                  ? `${Math.round((quarter.failedStudents / (quarter.passedStudents + quarter.failedStudents)) * 100)}%`
                                  : `${quarter.averageScore}%`}
                              </div>
                            </div>
                          </div>
                          <div style={{
                            textAlign: 'center',
                            marginTop: 8,
                            fontSize: 12,
                            color: '#6c757d',
                            fontWeight: 500
                          }}>
                            {quarterlyViewMode[quarter.quarter] ? 'Failed %' : 'Average %'} • Click to toggle
                          </div>
                        </div>

                        {/* Statistics */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 12,
                          fontSize: 14
                        }}>
                          <div style={{
                            background: '#d4edda',
                            borderRadius: 8,
                            padding: 12,
                            textAlign: 'center'
                          }}>
                            <div style={{
                              fontWeight: 600,
                              color: '#155724',
                              marginBottom: 4
                            }}>
                              Passed
                            </div>
                            <div style={{
                              fontSize: 18,
                              fontWeight: 700,
                              color: '#155724'
                            }}>
                              {quarter.passedStudents}
                            </div>
                          </div>
                          <div style={{
                            background: '#f8d7da',
                            borderRadius: 8,
                            padding: 12,
                            textAlign: 'center'
                          }}>
                            <div style={{
                              fontWeight: 600,
                              color: '#721c24',
                              marginBottom: 4
                            }}>
                              Failed
                            </div>
                            <div style={{
                              fontSize: 18,
                              fontWeight: 700,
                              color: '#721c24'
                            }}>
                              {quarter.failedStudents}
                            </div>
                          </div>
                        </div>

                        {/* Removed Performance Level block as requested */}
                      </div>
                    ))}
                  </div>

                  {/* Performance Summary removed as requested */}
                </div>
              </div>
            </div>
          )}
    </div>
  );
}