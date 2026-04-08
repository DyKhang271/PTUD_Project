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
    <div className="layout-wrapper" style={{ display: 'block', backgroundColor: '#f0f2f5' }}>
      <div style={{ background: '#fff', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        <h1 style={{ fontSize: '1.25rem', color: 'var(--primary)', fontWeight: 'bold' }}>🛡️ IUH Portal - Phân Quyền Quản Trị</h1>
        <button onClick={logout} style={{ padding: '8px 16px', background: 'var(--bg-hover)', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', fontWeight: 'bold', color: 'var(--text)' }}>
          Đăng xuất
        </button>
      </div>
      <main style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
        <Outlet />
      </main>
    </div>
  );
}

function AppRoutes() {
  const { isParent, isAdmin } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        {isAdmin ? (
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
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
