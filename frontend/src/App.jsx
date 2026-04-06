import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/Layout/Sidebar';
import Topbar from './components/Layout/Topbar';
import Chatbot from './components/Chatbot/Chatbot';
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Profile from './pages/Profile/Profile';
import Grades from './pages/Grades/Grades';
import Curriculum from './pages/Curriculum/Curriculum';

function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isParent } = useAuth();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <div
        style={{
          flex: 1,
          marginLeft: 'var(--sidebar-width)',
          transition: 'margin-left 0.25s ease',
        }}
      >
        <Topbar />
        <main
          style={{
            marginTop: 'var(--topbar-height)',
            padding: '24px 28px',
            minHeight: 'calc(100vh - var(--topbar-height))',
          }}
        >
          <Outlet />
        </main>
      </div>
      {/* Chatbot only for students */}
      {!isParent && <Chatbot />}
    </div>
  );
}

function AppRoutes() {
  const { isParent } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/grades" element={<Grades />} />
          {/* Curriculum only for students */}
          {!isParent && (
            <Route path="/curriculum" element={<Curriculum />} />
          )}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
