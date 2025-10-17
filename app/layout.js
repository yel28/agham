// app/layout.jsx
import './globals.css';
import { Fredoka } from 'next/font/google';
import { TeacherProvider } from './lib/Teacher-SPCC'; // ✅ import the context
import { LoadingProvider } from './lib/LoadingContext';
import { GlobalLoadingIndicator } from './components/LoadingComponents';
import { NotificationProvider } from './components/NotificationToast';
import OfflinePage from './components/OfflinePage';

const fredoka = Fredoka({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '700'],
});

export const metadata = {
  title: 'AGHAM - Grade 6 Science E-Learning',
  description: 'Mobile E-Learning for Grade 6 Science with interactive AR models',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AGHAM',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'AGHAM',
    title: 'AGHAM - Grade 6 Science E-Learning',
    description: 'Mobile E-Learning for Grade 6 Science with interactive AR models',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#4fa37e',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={fredoka.className}>
      <link
        href="https://cdn.jsdelivr.net/npm/remixicon@2.5.0/fonts/remixicon.css"
        rel="stylesheet"
        precedence="default"
      />
      <body>
        <NotificationProvider>
          <LoadingProvider>
            <TeacherProvider>
              {children}
              <GlobalLoadingIndicator />
              <OfflinePage />
            </TeacherProvider>
          </LoadingProvider>
        </NotificationProvider>
      </body>
    </html>
  );
}
