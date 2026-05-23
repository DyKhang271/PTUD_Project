import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getStudent } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Sidebar.module.css';

const STUDENT_MENU = [
  { path: '/dashboard', label: 'Trang chủ' },
  { path: '/profile', label: 'Hồ sơ' },
  { path: '/grades', label: 'Bảng điểm' },
  { path: '/curriculum', label: 'Chương trình khung' },
];

const PARENT_MENU = [
  { path: '/dashboard', label: 'Trang chủ' },
  { path: '/profile', label: 'Hồ sơ sinh viên' },
  { path: '/grades', label: 'Bảng điểm' },
];

export default function Sidebar({ isOpen, onToggle, isDesktopCollapsed }) {
  const [student, setStudent] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { isParent, logout, user } = useAuth();

  const menuItems = isParent ? PARENT_MENU : STUDENT_MENU;

  useEffect(() => {
    if (!user?.mssv) return;

    getStudent(user.mssv)
      .then((res) => setStudent(res.data))
      .catch(() => {});
  }, [user?.mssv]);

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    return parts[parts.length - 1]?.[0] || '?';
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <button
        className={styles.mobileToggle}
        onClick={onToggle}
        aria-label="Toggle menu"
      >
        ☰
      </button>

      {isOpen && <div className={styles.overlay} onClick={onToggle} />}

      <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''} ${isDesktopCollapsed ? styles.sidebarCollapsed : ''}`}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>🎓</div>
          <div className={styles.logoText}>
            <span className={styles.logoTitle}>IUH</span>
            <span className={styles.logoSubtitle}>Student Portal</span>
          </div>
        </div>

        {isParent && (
          <div className={styles.roleBadge}>👨‍👩‍👧 Chế độ phụ huynh</div>
        )}

        {student && (
          <div
            className={styles.studentCard}
            onClick={() => {
              navigate('/profile');
              if (window.innerWidth <= 768) onToggle();
            }}
            role="button"
            tabIndex={0}
            title="Xem hồ sơ sinh viên"
          >
            <div className={styles.studentAvatar}>{getInitials(student.ho_ten)}</div>
            <div className={styles.studentInfo}>
              <div className={styles.studentName}>{student.ho_ten}</div>
              <div className={styles.studentMssv}>{student.mssv}</div>
            </div>
            <span className={styles.studentLink}>→</span>
          </div>
        )}

        <nav className={styles.nav}>
          <div className={styles.navLabel}>Menu chính</div>
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={`${styles.navItem} ${
                location.pathname === item.path ? styles.navItemActive : ''
              }`}
              onClick={() => {
                if (window.innerWidth <= 768) onToggle();
              }}
            >
              <span className={styles.navText}>{item.label}</span>
            </NavLink>
          ))}

          {!isParent && (
            <>
              <div className={styles.navLabel}>Hỗ trợ</div>
              <NavLink
                to="/chat"
                className={`${styles.navItem} ${
                  location.pathname === '/chat' ? styles.navItemActive : ''
                }`}
                onClick={() => {
                  if (window.innerWidth <= 768) onToggle();
                }}
              >
                <span className={styles.navText}>Tư vấn AI</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className={styles.bottomSection}>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            🚪 Đăng xuất
          </button>
          <div className={styles.version}>Student Portal v1.0</div>
        </div>
      </aside>
    </>
  );
}
