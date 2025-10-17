'use client';

import dynamic from 'next/dynamic';
import { PageLoadingSkeleton } from './LoadingSkeleton';

// Dynamic imports for dashboard components with loading states
export const DynamicStudentRecord = dynamic(
  () => import('../dashboard/student-record/page'),
  {
    loading: () => <PageLoadingSkeleton pageType="studentList" />,
    ssr: false // Disable SSR for client-heavy components
  }
);

export const DynamicQuizzes = dynamic(
  () => import('../dashboard/quizzes/page'),
  {
    loading: () => <PageLoadingSkeleton pageType="quizList" />,
    ssr: false
  }
);

export const DynamicAdminManagement = dynamic(
  () => import('../dashboard/admin-management/page'),
  {
    loading: () => <PageLoadingSkeleton pageType="adminList" />,
    ssr: false
  }
);

export const DynamicStudentAssessment = dynamic(
  () => import('../dashboard/student-assessment/page'),
  {
    loading: () => <PageLoadingSkeleton pageType="studentList" />,
    ssr: false
  }
);

export const DynamicLeaderboard = dynamic(
  () => import('../dashboard/leaderboard/page'),
  {
    loading: () => <PageLoadingSkeleton pageType="default" />,
    ssr: false
  }
);

export const DynamicArchive = dynamic(
  () => import('../dashboard/archive/page'),
  {
    loading: () => <PageLoadingSkeleton pageType="default" />,
    ssr: false
  }
);

// Main dashboard component (keep this one as regular import since it's the entry point)
export const DynamicDashboard = dynamic(
  () => import('../dashboard/page'),
  {
    loading: () => <PageLoadingSkeleton pageType="default" />,
    ssr: true // Keep SSR for main dashboard
  }
);
