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

  return (
    <div className="app-shell">
      <aside className="sidebar">
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
      <div className="content-shell">
        <header className="topbar">
          <div>
            <div className="topbar-title">{user?.full_name || "Người dùng"}</div>
            <div className="topbar-subtitle">{user?.role}</div>
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
