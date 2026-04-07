import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getGradesSummary, getNotifications, getStudent } from '../../services/api';
import styles from './Dashboard.module.css';

function formatRelativeTime(timeStr) {
  const date = new Date(timeStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hôm nay';
  if (diffDays === 1) return 'Hôm qua';
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return date.toLocaleDateString('vi-VN');
}

function splitTermLabel(termLabel) {
  if (!termLabel) {
    return { semester: '--', academicYear: 'Chưa có dữ liệu' };
  }

  const [semester, academicYearRaw] = termLabel.split(' (');
  return {
    semester: semester || '--',
    academicYear: academicYearRaw ? academicYearRaw.replace(')', '') : 'Chưa có dữ liệu',
  };
}

function getBarColor(gpa4) {
  if (gpa4 >= 3.6) return '#16a34a';
  if (gpa4 >= 3.0) return '#2563eb';
  if (gpa4 >= 2.0) return '#f59e0b';
  return '#ef4444';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isParent } = useAuth();
  const [student, setStudent] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAllNotifs, setShowAllNotifs] = useState(false);

  useEffect(() => {
    if (!user?.mssv) return;

    setLoading(true);
    Promise.all([
      getStudent(user.mssv),
      getNotifications(),
      getGradesSummary(user.mssv),
    ])
      .then(([studentRes, notificationRes, summaryRes]) => {
        setStudent(studentRes.data);
        setNotifications(notificationRes.data);
        setSummary(summaryRes.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Không thể tải dữ liệu. Vui lòng thử lại.');
        setLoading(false);
      });
  }, [user?.mssv]);

  const displayedNotifs = showAllNotifs ? notifications : notifications.slice(0, 5);
  const remainingCredits = summary?.tc_con_lai ?? 0;
  const currentTerm = splitTermLabel(summary?.current_term);

  const previousTermChart = summary?.previous_term_chart;
  const chartCourses = useMemo(
    () => previousTermChart?.courses || [],
    [previousTermChart],
  );

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

  return (
    <div className={styles.dashboard}>
      <div className={styles.welcomeBanner}>
        <div className={styles.welcomeText}>
          <h2 className={styles.welcomeTitle}>
            Xin chào,{' '}
            <span
              className={styles.welcomeName}
              onClick={() => navigate('/profile')}
              role="button"
              tabIndex={0}
            >
              {student?.ho_ten}
            </span>
            !
          </h2>
          <p className={styles.welcomeSub}>
            {student?.program_name} • {student?.lop}
          </p>
        </div>
      </div>

      <div className={styles.statsRow}>
        <div
          className={`${styles.statCard} ${styles.statCardGpa}`}
          onClick={() => navigate('/grades')}
          role="button"
          tabIndex={0}
        >
          <div className={`${styles.statIcon} ${styles.statIconGpa}`}>📈</div>
          <div className={styles.statValue}>{summary?.gpa_tich_luy?.toFixed(2)}</div>
          <div className={styles.statSubvalue}>/ 4.0</div>
          <div className={styles.statLabel}>GPA tích lũy</div>
        </div>

        <div
          className={`${styles.statCard} ${styles.statCardTcDone}`}
          onClick={() => navigate(isParent ? '/profile' : '/curriculum')}
          role="button"
          tabIndex={0}
        >
          <div className={`${styles.statIcon} ${styles.statIconTcDone}`}>✅</div>
          <div className={styles.statValue}>{summary?.tc_dat}</div>
          <div className={styles.statSubvalue}>/ {summary?.tc_tong} TC</div>
          <div className={styles.statLabel}>TC hoàn thành</div>
        </div>

        <div
          className={`${styles.statCard} ${styles.statCardTcLeft}`}
          onClick={() => navigate(isParent ? '/profile' : '/curriculum')}
          role="button"
          tabIndex={0}
        >
          <div className={`${styles.statIcon} ${styles.statIconTcLeft}`}>📝</div>
          <div className={styles.statValue}>{remainingCredits}</div>
          <div className={styles.statSubvalue}>TC</div>
          <div className={styles.statLabel}>TC còn lại</div>
        </div>

        <div className={`${styles.statCard} ${styles.statCardSemester}`}>
          <div className={`${styles.statIcon} ${styles.statIconSemester}`}>📅</div>
          <div className={styles.statValue}>{currentTerm.semester}</div>
          <div className={styles.statSubvalue}>{currentTerm.academicYear}</div>
          <div className={styles.statLabel}>Học kỳ hiện tại</div>
        </div>
      </div>

      <div className={styles.contentRow}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>📊 GPA các môn ở kỳ trước</h2>
            {previousTermChart?.term && (
              <span className={styles.chartMeta}>{previousTermChart.term}</span>
            )}
          </div>
          <div className={styles.cardBody}>
            {chartCourses.length > 0 ? (
              <>
                <div className={styles.chartSummaryRow}>
                  <div>
                    <div className={styles.chartSummaryValue}>
                      {previousTermChart?.gpa_hoc_ky?.toFixed(2)}
                    </div>
                    <div className={styles.chartSummaryLabel}>GPA học kỳ trước</div>
                  </div>
                  <div className={styles.chartSummaryNote}>
                    Biểu đồ dùng thang điểm 4.0 cho các môn đã có kết quả.
                  </div>
                </div>

                <div className={styles.chartArea}>
                  <div className={styles.chartAxis}>
                    {[4, 3, 2, 1, 0].map((tick) => (
                      <span key={tick}>{tick.toFixed(1)}</span>
                    ))}
                  </div>
                  <div className={styles.chartBars}>
                    {chartCourses.map((course) => (
                      <div className={styles.chartBarItem} key={`${course.course_code}-${course.course_name}`}>
                        <div className={styles.chartBarValue}>{course.gpa4.toFixed(1)}</div>
                        <div className={styles.chartBarTrack}>
                          <div
                            className={styles.chartBarFill}
                            style={{
                              height: `${(course.gpa4 / 4) * 100}%`,
                              background: `linear-gradient(180deg, ${getBarColor(course.gpa4)} 0%, rgba(255,255,255,0.2) 140%)`,
                            }}
                          />
                        </div>
                        <div className={styles.chartBarLabel} title={course.course_name}>
                          {course.course_name}
                        </div>
                        <div className={styles.chartBarMeta}>
                          {course.course_code} • {course.letter || '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.emptyState}>
                Chưa có đủ dữ liệu GPA để hiển thị biểu đồ.
              </div>
            )}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>🔔 Thông báo mới</h2>
            <span className={styles.notifCount}>
              {notifications.filter((notification) => !notification.da_doc).length} chưa đọc
            </span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.notifList}>
              {displayedNotifs.map((notification) => (
                <div className={styles.notifItem} key={notification.id}>
                  <div className={styles.notifIcon}>{notification.loai}</div>
                  <div className={styles.notifContent}>
                    <div className={styles.notifTitle}>
                      {notification.tieu_de}
                      {!notification.da_doc && (
                        <span className={styles.notifBadge}>Mới</span>
                      )}
                    </div>
                    {showAllNotifs && (
                      <div className={styles.notifBody}>{notification.noi_dung}</div>
                    )}
                    <div className={styles.notifTime}>
                      {formatRelativeTime(notification.thoi_gian)}
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
