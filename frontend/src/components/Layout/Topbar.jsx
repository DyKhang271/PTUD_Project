import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getStudent, getNotifications } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Topbar.module.css';

const PAGE_TITLES = {
  '/dashboard': 'Trang chủ',
  '/profile': 'Hồ sơ sinh viên',
  '/grades': 'Bảng điểm',
  '/curriculum': 'Chương trình khung',
};

export default function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isParent, logout } = useAuth();
  const [student, setStudent] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dateTime, setDateTime] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    getStudent()
      .then((res) => setStudent(res.data))
      .catch(() => {});

    getNotifications()
      .then((res) => {
        const unread = res.data.filter((n) => !n.da_doc).length;
        setUnreadCount(unread);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      };
      setDateTime(now.toLocaleDateString('vi-VN', options));
    };
    updateTime();
    const timer = setInterval(updateTime, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    return parts[parts.length - 1]?.[0] || '?';
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    setDropdownOpen(false);
  };

  const pageTitle = PAGE_TITLES[location.pathname] || 'Student Portal';

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <h1 className={styles.pageTitle}>{pageTitle}</h1>
        <span className={styles.dateTime}>{dateTime}</span>
      </div>

      <div className={styles.right}>
        {isParent && (
          <span className={styles.parentBadge}>👨‍👩‍👧 Phụ huynh</span>
        )}

        {/* Notification */}
        <button className={styles.notifBtn} title="Thông báo">
          🔔
          {unreadCount > 0 && (
            <span className={styles.badge}>{unreadCount}</span>
          )}
        </button>

        {/* User menu */}
        <div className={styles.userMenu} ref={dropdownRef}>
          <button
            className={styles.userBtn}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <div className={styles.userAvatar}>
              {student ? getInitials(student.ho_ten) : '?'}
            </div>
            <span className={styles.userName}>
              {student?.ho_ten || 'Sinh viên'}
            </span>
            <span
              className={`${styles.userArrow} ${
                dropdownOpen ? styles.userArrowOpen : ''
              }`}
            >
              ▼
            </span>
          </button>

          {dropdownOpen && (
            <div className={styles.dropdown}>
              <button
                className={styles.dropdownItem}
                onClick={() => {
                  navigate('/profile');
                  setDropdownOpen(false);
                }}
              >
                👤 Xem hồ sơ
              </button>
              <div className={styles.dropdownDivider} />
              <button
                className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                onClick={handleLogout}
              >
                🚪 Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
