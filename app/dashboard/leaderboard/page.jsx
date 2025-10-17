'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTeacher } from '../../lib/Teacher-SPCC';
import { db, collection, getDocs, studentsCollection, quizzesCollection } from '../../lib/firebase';
import './leaderboard.css';

export default function LeaderboardPage() {
  const { teacherEmail } = useTeacher();
  const router = useRouter();
  const [students, setStudents] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState('all');
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [sections, setSections] = useState([]);

  // Load data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch students
        const studentsSnapshot = await getDocs(studentsCollection());
        const studentsData = studentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setStudents(studentsData);

        // Fetch quizzes
        const quizzesSnapshot = await getDocs(quizzesCollection());
        const quizzesData = quizzesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setQuizzes(quizzesData);

        // Extract unique sections
        const uniqueSections = [...new Set(studentsData.map(s => s.sectionId).filter(Boolean))];
        setSections(uniqueSections);

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate leaderboard data
  useEffect(() => {
    if (!students.length) return;

    // Filter students by section
    let filteredStudents = students;
    if (selectedSection !== 'all') {
      filteredStudents = students.filter(s => s.sectionId === selectedSection);
    }

    // Calculate scores for each student (mock data for now)
    const studentsWithScores = filteredStudents.map(student => {
      const mockScore = Math.floor(Math.random() * 40) + 60; // 60-100 range
      const mockQuizzesCompleted = Math.floor(Math.random() * 10) + 1;
      
      return {
        ...student,
        totalScore: mockScore,
        quizzesCompleted: mockQuizzesCompleted,
        averageScore: mockScore,
        lastUpdated: new Date().toISOString()
      };
    });

    // Sort by total score (descending)
    const sortedStudents = studentsWithScores.sort((a, b) => b.totalScore - a.totalScore);

    // Add ranking
    const rankedStudents = sortedStudents.map((student, index) => ({
      ...student,
      rank: index + 1
    }));

    setLeaderboardData(rankedStudents);
  }, [students, selectedSection]);

  // Handle section change
  const handleSectionChange = (section) => {
    setSelectedSection(section);
  };

  if (loading) {
    return (
      <div className="leaderboard-container">
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
            Loading Leaderboard
          </h3>
          
          <p style={{
            fontSize: 14,
            color: '#6c757d',
            margin: 0,
            textAlign: 'center',
            lineHeight: 1.5,
            maxWidth: 200
          }}>
            Fetching student scores and rankings...
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
      </div>
    );
  }

  return (
    <div className="leaderboard-container">
      {/* Header */}
      <div className="leaderboard-header">
        <div className="header-content">
          <div className="header-icon">
            <i className="ri-trophy-fill"></i>
          </div>
          <div>
            <h1>🏆 Leaderboard 🏆</h1>
            <p>See who's doing amazing in class!</p>
          </div>
        </div>
      </div>

      {/* Section Filter */}
      <div className="filter-container">
        <div className="filter-group">
          <label>📚 Choose Section:</label>
          <select 
            value={selectedSection} 
            onChange={(e) => handleSectionChange(e.target.value)}
            className="section-selector"
          >
            <option value="all">🌟 All Sections ({students.length})</option>
            {sections.map(section => (
              <option key={section} value={section}>
                📖 Section {section} ({students.filter(s => s.sectionId === section).length})
              </option>
            ))}
            <option value="unassigned">
              ❓ Unassigned ({students.filter(s => !s.sectionId).length})
            </option>
          </select>
        </div>
      </div>

      {/* Podium Display for Top 3 */}
      {leaderboardData.length >= 3 && (
        <div className="podium-container">
          <h2 className="podium-title">🥇 Top 3 Champions! 🥇</h2>
          <div className="podium">
            {/* 2nd Place (Left) */}
            <div className="podium-place second-place">
              <div className="podium-avatar">
                <img 
                  src={leaderboardData[1]?.avatar || '/avatar3.png'} 
                  alt={leaderboardData[1]?.firstName}
                  onError={(e) => {
                    e.target.src = '/avatar3.png';
                  }}
                />
                <div className="crown-icon">
                  <i className="ri-crown-line"></i>
                </div>
              </div>
              <div className="podium-name">{leaderboardData[1]?.firstName}</div>
              <div className="podium-rank">2</div>
              <div className="podium-score">{leaderboardData[1]?.totalScore} points</div>
            </div>

            {/* 1st Place (Center) */}
            <div className="podium-place first-place">
              <div className="podium-avatar">
                <img 
                  src={leaderboardData[0]?.avatar || '/avatar3.png'} 
                  alt={leaderboardData[0]?.firstName}
                  onError={(e) => {
                    e.target.src = '/avatar3.png';
                  }}
                />
                <div className="crown-icon">
                  <i className="ri-crown-fill"></i>
                </div>
              </div>
              <div className="podium-name">{leaderboardData[0]?.firstName}</div>
              <div className="podium-rank">1</div>
              <div className="podium-score">{leaderboardData[0]?.totalScore} points</div>
            </div>

            {/* 3rd Place (Right) */}
            <div className="podium-place third-place">
              <div className="podium-avatar">
                <img 
                  src={leaderboardData[2]?.avatar || '/avatar3.png'} 
                  alt={leaderboardData[2]?.firstName}
                  onError={(e) => {
                    e.target.src = '/avatar3.png';
                  }}
                />
                <div className="crown-icon">
                  <i className="ri-crown-line"></i>
                </div>
              </div>
              <div className="podium-name">{leaderboardData[2]?.firstName}</div>
              <div className="podium-rank">3</div>
              <div className="podium-score">{leaderboardData[2]?.totalScore} points</div>
            </div>
          </div>
        </div>
      )}

      {/* Ranks 4-10 List */}
      {leaderboardData.length > 3 && (
        <div className="ranks-4-10-container">
          <h3 className="ranks-4-10-title">🌟 Great Job Everyone! 🌟</h3>
          <div className="ranks-4-10-list">
            {leaderboardData.slice(3, 10).map((student, index) => (
              <div 
                key={student.id} 
                className="rank-4-10-item"
                style={{
                  animationDelay: `${(index + 3) * 0.1}s`
                }}
              >
                <div className="rank-circle">
                  {student.rank}
                </div>
                <div className="student-avatar-small">
                  <img 
                    src={student.avatar || '/avatar3.png'} 
                    alt={student.firstName}
                    onError={(e) => {
                      e.target.src = '/avatar3.png';
                    }}
                  />
                </div>
                <div className="student-name">
                  {student.firstName} {student.lastName}
                </div>
                <div className="student-score">
                  {student.totalScore} points
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {leaderboardData.length === 0 && (
        <div className="empty-state">
          <i className="ri-trophy-line"></i>
          <h3>No students found</h3>
          <p>No students match the current filter criteria</p>
        </div>
      )}
    </div>
  );
}