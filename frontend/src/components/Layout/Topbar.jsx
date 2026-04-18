import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getNotifications, getStudent } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Topbar.module.css';

const PAGE_TITLES = {
  '/dashboard': 'Trang chủ',
  '/profile': 'Hồ sơ sinh viên',
  '/grades': 'Bảng điểm',
  '/curriculum': 'Chương trình khung',
};

export default function Topbar({ onToggleSidebar, isDesktopCollapsed, isDarkTheme, toggleTheme }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isParent, logout, user } = useAuth();
  const [student, setStudent] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dateTime, setDateTime] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [studyNotifs, setStudyNotifs] = useState([]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!user?.mssv) return;

    getStudent(user.mssv)
      .then((res) => setStudent(res.data))
      .catch(() => {});

    getNotifications()
      .then((res) => {
        const studyNotifsData = res.data.filter((n) => {
          const lowered = n.tieu_de.toLowerCase();
          return lowered.includes('gpa') || lowered.includes('điểm') || lowered.includes('học vụ');
        });
        setStudyNotifs(studyNotifsData);
        setUnreadCount(studyNotifsData.filter((n) => !n.da_doc).length);
      })
      .catch(() => {});
  }, [user?.mssv]);

  useEffect(() => {
    const handleRead = () => {
      // It's still good to decrement if read happens elsewhere
      setUnreadCount((prev) => Math.max(0, prev - 1));
    };
    document.addEventListener('notificationRead', handleRead);
    return () => document.removeEventListener('notificationRead', handleRead);
  }, []);

  const handleNotifClick = (notif) => {
    // If not read, mark it read
    if (!notif.da_doc) {
      setStudyNotifs((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, da_doc: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      // Option: could open detail modal, but user screenshot just shows a list that they read from
    }
  };

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
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
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
    <>
      <header className={`${styles.topbar} ${isDesktopCollapsed ? styles.topbarCollapsed : ''}`}>
        <div className={styles.left}>
        <button 
          className={styles.desktopToggle} 
          onClick={onToggleSidebar}
          aria-label="Toggle menu"
        >
          ☰
        </button>
        <div className={styles.titleWrapper}>
          <h1 className={styles.pageTitle}>{pageTitle}</h1>
          <span className={styles.dateTime}>{dateTime}</span>
        </div>
      </div>

      <div className={styles.right}>
        {isParent && <span className={styles.parentBadge}>👨‍👩‍👧 Phụ huynh</span>}

        <button 
          className={styles.themeToggleBtn} 
          title="Đổi giao diện Sáng/Tối"
          onClick={toggleTheme}
        >
          {isDarkTheme ? '☀️' : '🌙'}
        </button>

        <button 
          className={styles.notifBtn} 
          title="Thông báo"
          onClick={() => setShowNotifModal(true)}
        >
          🔔
          {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
        </button>

        <div className={styles.userMenu} ref={dropdownRef}>
          <button
            className={styles.userBtn}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <div className={styles.userAvatar}>
              {student ? getInitials(student.ho_ten) : '?'}
            </div>
            <span className={styles.userName}>{student?.ho_ten || 'Sinh viên'}</span>
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
      
      {/* Topbar Notification Modal */}
      {showNotifModal && (
        <div className={styles.notifModalOverlay} onClick={() => setShowNotifModal(false)}>
          <div className={styles.notifModalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.notifModalHeader}>
              <h3 className={styles.notifModalTitle}>🔔 Thông báo điểm học tập</h3>
              <button className={styles.notifModalClose} onClick={() => setShowNotifModal(false)}>✕</button>
            </div>
            <div className={styles.notifModalList}>
              {studyNotifs.length > 0 ? studyNotifs.map((notif) => (
                <div 
                  key={notif.id}
                  className={`${styles.notifItem} ${notif.da_doc ? '' : styles.notifUnread}`}
                  onClick={() => handleNotifClick(notif)}
                >
                  <div className={styles.notifIcon}>{notif.loai}</div>
                  <div className={styles.notifContentWrapper}>
                    <div className={styles.notifTitle}>
                      {notif.tieu_de} {!notif.da_doc && <span className={styles.badgeNew}>Mới</span>}
                    </div>
                    <div className={styles.notifBody}>{notif.noi_dung}</div>
                    <div className={styles.notifTime}>{new Date(notif.thoi_gian).toLocaleDateString('vi-VN')}</div>
                  </div>
                </div>
              )) : (
                <div className={styles.emptyNotif}>Không có thông báo mới.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
