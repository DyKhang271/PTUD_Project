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
import AdminDashboard from './pages/Admin/AdminDashboard';
import TeacherDashboard from './pages/Teacher/TeacherDashboard';

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
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const { isParent } = useAuth();

  return (
    <div className="layout-wrapper">
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        isDesktopCollapsed={desktopCollapsed}
      />
      <div className={`main-content ${desktopCollapsed ? 'collapsed' : ''}`}>
        <Topbar 
          onToggleSidebar={() => setDesktopCollapsed(!desktopCollapsed)} 
          isDesktopCollapsed={desktopCollapsed}
        />
        <main className="main-content-inner">
          <Outlet />
        </main>
      </div>
      {/* Chatbot only for students */}
      {!isParent && <Chatbot />}
    </div>
  );
}

function AdminLayout() {
  const { logout } = useAuth();
  return (
    <div className="layout-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f0f2f5' }}>
      <div style={{ background: '#fff', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', zIndex: 10 }}>
        <h1 style={{ fontSize: '1.25rem', color: 'var(--primary)', fontWeight: 'bold', margin: 0 }}>🛡️ IUH Portal - Phân Quyền Quản Trị</h1>
        <button onClick={logout} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 'bold', color: 'var(--text)' }}>
          Đăng xuất
        </button>
      </div>
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Outlet />
      </main>
    </div>
  );
}

function TeacherLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="layout-wrapper" style={{ display: 'block', background: 'linear-gradient(180deg, #f4f7fb 0%, #eef3f9 100%)' }}>
      <div style={{ background: '#fff', padding: '18px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', gap: 16 }}>
        <div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>IUH Portal</div>
          <h1 style={{ fontSize: '1.35rem', color: 'var(--primary)', fontWeight: 800 }}>Không gian giảng viên</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, color: 'var(--text)' }}>{user?.name || 'Giảng viên'}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{user?.department || 'Bộ môn'}</div>
          </div>
          <button onClick={logout} style={{ padding: '10px 16px', background: 'var(--accent)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700, color: 'var(--primary)' }}>
            Đăng xuất
          </button>
        </div>
      </div>
      <main style={{ padding: '32px', maxWidth: '1440px', margin: '0 auto' }}>
        <Outlet />
      </main>
    </div>
  );
}

function AppRoutes() {
  const { isParent, isAdmin, isTeacher } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        {isAdmin ? (
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        ) : isTeacher ? (
          <Route element={<TeacherLayout />}>
            <Route path="/teacher" element={<TeacherDashboard />} />
            <Route path="*" element={<Navigate to="/teacher" replace />} />
          </Route>
        ) : (
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
        )}
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
