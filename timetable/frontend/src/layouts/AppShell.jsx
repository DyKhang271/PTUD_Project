import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function SidebarLink({ to, label }) {
  return (
    <NavLink to={to} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}>
      {label}
    </NavLink>
  );
}

export default function AppShell({ title, links }) {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-brand">
          <span className="sidebar-eyebrow">🎓 IUH Portal</span>
          <h1>{title}</h1>
        </div>
        <nav className="sidebar-nav">
          {links.map((link) => (
            <SidebarLink key={link.to} to={link.to} label={link.label} />
          ))}
        </nav>
      </aside>
      <div className={`content-shell ${isCollapsed ? "collapsed" : ""}`}>
        <header className="topbar">
          <div className="topbar-left">
            <button className="sidebar-toggle-btn" onClick={() => setIsCollapsed(!isCollapsed)} title={isCollapsed ? "Mở rộng menu" : "Thu gọn menu"}>
              {isCollapsed ? "☰" : "✕"}
            </button>
            <button className="theme-toggle-btn" onClick={toggleTheme} title={theme === "light" ? "Chuyển sang chế độ tối" : "Chuyển sang chế độ sáng"}>
              {theme === "light" ? "🌙" : "☀️"}
            </button>
            <div>
              <div className="topbar-title">{user?.full_name || "Người dùng"}</div>
              <div className="topbar-subtitle">
                {user?.role === "student" ? "Sinh viên" : user?.role === "teacher" ? "Giảng viên" : user?.role === "admin" ? "Quản trị viên" : user?.role}
              </div>
            </div>
          </div>
          <button className="secondary-button" onClick={logout}>
            Đăng xuất
          </button>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
