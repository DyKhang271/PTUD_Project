import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStudent, getSchedule, getNotifications, getGradesSummary } from '../../services/api';
import styles from './Dashboard.module.css';

const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

const PERIOD_TIMES = {
  1: '6:30 - 7:20',
  2: '7:20 - 8:10',
  3: '8:10 - 9:00',
  4: '9:10 - 10:00',
  5: '10:00 - 10:50',
  6: '10:50 - 11:40',
  7: '12:30 - 13:20',
  8: '13:20 - 14:10',
  9: '14:10 - 15:00',
  10: '15:10 - 16:00',
  11: '16:00 - 16:50',
  12: '16:50 - 17:40',
  13: '18:00 - 18:50',
  14: '18:50 - 19:40',
  15: '19:50 - 20:40',
  16: '20:40 - 21:30',
};

const SESSIONS = [
  { label: 'BUỔI SÁNG', periods: [1, 2, 3, 4, 5, 6] },
  { label: 'BUỔI CHIỀU', periods: [7, 8, 9, 10, 11, 12] },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAllNotifs, setShowAllNotifs] = useState(false);

  useEffect(() => {
    Promise.all([
      getStudent(),
      getSchedule(),
      getNotifications(),
      getGradesSummary(),
    ])
      .then(([stuRes, schRes, notifRes, sumRes]) => {
        setStudent(stuRes.data);
        setSchedule(schRes.data);
        setNotifications(notifRes.data);
        setSummary(sumRes.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Không thể tải dữ liệu. Vui lòng thử lại.');
        setLoading(false);
      });
  }, []);

  const isFirstPeriod = (dayIndex, period) => {
    const thu = dayIndex + 2;
    return schedule.find((s) => s.thu === thu && s.tiet_bat_dau === period);
  };

  const getRowSpan = (item) => item.tiet_ket_thuc - item.tiet_bat_dau + 1;

  const shouldRenderCell = (dayIndex, period) => {
    const thu = dayIndex + 2;
    const item = schedule.find(
      (s) => s.thu === thu && period > s.tiet_bat_dau && period <= s.tiet_ket_thuc
    );
    return !item;
  };

  const formatTime = (timeStr) => {
    const d = new Date(timeStr);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hôm nay';
    if (diffDays === 1) return 'Hôm qua';
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return d.toLocaleDateString('vi-VN');
  };

  if (loading) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.loadingCenter}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.dashboard}>
        <div className="errorMessage">⚠️ {error}</div>
      </div>
    );
  }

  const tcConLai = summary ? summary.tc_tong - summary.tc_dat : 0;
  const displayedNotifs = showAllNotifs ? notifications : notifications.slice(0, 5);

  return (
    <div className={styles.dashboard}>
      {/* Welcome banner */}
      <div className={styles.welcomeBanner}>
        <div className={styles.welcomeText}>
          <h2 className={styles.welcomeTitle}>
            Xin chào, <span className={styles.welcomeName} onClick={() => navigate('/profile')} role="button" tabIndex={0}>{student?.ho_ten}</span>! 👋
          </h2>
          <p className={styles.welcomeSub}>Chúc bạn một ngày học tập hiệu quả</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className={styles.statsRow}>
        <div className={`${styles.statCard} ${styles.statCardGpa}`} onClick={() => navigate('/grades')} role="button" tabIndex={0}>
          <div className={`${styles.statIcon} ${styles.statIconGpa}`}>📈</div>
          <div className={styles.statValue}>{summary?.gpa_tich_luy?.toFixed(2)}</div>
          <div className={styles.statSubvalue}>/ 4.0</div>
          <div className={styles.statLabel}>GPA Tích lũy</div>
        </div>
        <div className={`${styles.statCard} ${styles.statCardTcDone}`} onClick={() => navigate('/curriculum')} role="button" tabIndex={0}>
          <div className={`${styles.statIcon} ${styles.statIconTcDone}`}>✅</div>
          <div className={styles.statValue}>{summary?.tc_dat}</div>
          <div className={styles.statSubvalue}>/ {summary?.tc_tong} TC</div>
          <div className={styles.statLabel}>TC Hoàn thành</div>
        </div>
        <div className={`${styles.statCard} ${styles.statCardTcLeft}`} onClick={() => navigate('/curriculum')} role="button" tabIndex={0}>
          <div className={`${styles.statIcon} ${styles.statIconTcLeft}`}>📝</div>
          <div className={styles.statValue}>{tcConLai}</div>
          <div className={styles.statSubvalue}>TC</div>
          <div className={styles.statLabel}>TC Còn lại</div>
        </div>
        <div className={`${styles.statCard} ${styles.statCardSemester}`}>
          <div className={`${styles.statIcon} ${styles.statIconSemester}`}>📅</div>
          <div className={styles.statValue}>HK2</div>
          <div className={styles.statSubvalue}>2024-2025</div>
          <div className={styles.statLabel}>Học kỳ hiện tại</div>
        </div>
      </div>

      {/* Content row */}
      <div className={styles.contentRow}>
        {/* Schedule */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>📋 Lịch học tuần</h2>
          </div>
          <div className={styles.cardBody} style={{ padding: '12px' }}>
            {SESSIONS.map((session) => {
              // Check if any class exists in this session
              const hasClasses = session.periods.some((p) =>
                DAYS.some((_, di) => isFirstPeriod(di, p))
              );
              if (!hasClasses) return null;

              return (
                <div key={session.label} className={styles.sessionBlock}>
                  <div className={styles.sessionLabel}>{session.label}</div>
                  <table className={styles.scheduleGrid}>
                    <thead>
                      <tr>
                        <th style={{ width: '100px' }}>Tiết / Giờ</th>
                        {DAYS.map((d) => (
                          <th key={d}>{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {session.periods.map((p) => (
                        <tr key={p}>
                          <td className={styles.periodCell}>
                            <div className={styles.periodNum}>Tiết {p}</div>
                            <div className={styles.periodTime}>{PERIOD_TIMES[p]}</div>
                          </td>
                          {DAYS.map((_, di) => {
                            const firstItem = isFirstPeriod(di, p);
                            if (firstItem) {
                              const startTime = PERIOD_TIMES[firstItem.tiet_bat_dau]?.split(' - ')[0];
                              const endTime = PERIOD_TIMES[firstItem.tiet_ket_thuc]?.split(' - ')[1];
                              return (
                                <td key={di} rowSpan={getRowSpan(firstItem)}>
                                  <div
                                    className={styles.scheduleCell}
                                    style={{ background: firstItem.mau }}
                                  >
                                    <div className={styles.scheduleCellName}>{firstItem.mon}</div>
                                    <div className={styles.scheduleCellCode}>{firstItem.ma_mon} - 01</div>
                                    <div className={styles.scheduleCellDetail}>
                                      Giờ: {startTime} - {endTime}
                                    </div>
                                    <div className={styles.scheduleCellDetail}>
                                      Phòng: {firstItem.phong}
                                    </div>
                                    <div className={styles.scheduleCellTeacher}>
                                      GV: {firstItem.giang_vien}
                                    </div>
                                  </div>
                                </td>
                              );
                            }
                            if (!shouldRenderCell(di, p)) return null;
                            return <td key={di}></td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </div>

        {/* Notifications */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>🔔 Thông báo mới</h2>
            <span className={styles.notifCount}>{notifications.filter(n => !n.da_doc).length} chưa đọc</span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.notifList}>
              {displayedNotifs.map((n) => (
                <div className={styles.notifItem} key={n.id}>
                  <div className={styles.notifIcon}>{n.loai}</div>
                  <div className={styles.notifContent}>
                    <div className={styles.notifTitle}>
                      {n.tieu_de}
                      {!n.da_doc && (
                        <span className={styles.notifBadge}>Mới</span>
                      )}
                    </div>
                    {showAllNotifs && (
                      <div className={styles.notifBody}>{n.noi_dung}</div>
                    )}
                    <div className={styles.notifTime}>
                      {formatTime(n.thoi_gian)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button
            className={styles.viewAllBtn}
            onClick={() => setShowAllNotifs(!showAllNotifs)}
          >
            {showAllNotifs ? '← Thu gọn' : `Xem tất cả (${notifications.length}) →`}
          </button>
        </div>
      </div>
    </div>
  );
}
