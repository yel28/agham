
'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const TeacherContext = createContext();

export const TeacherProvider = ({ children }) => {
  const [teacherEmail, setTeacherEmail] = useState('');

  useEffect(() => {
    const storedEmail = localStorage.getItem('teacherEmail');
    if (storedEmail) {
      setTeacherEmail(storedEmail);
    }
  }, []);

  return (
    <TeacherContext.Provider value={{ teacherEmail, setTeacherEmail }}>
      {children}
    </TeacherContext.Provider>
  );
};

export const useTeacher = () => useContext(TeacherContext);
