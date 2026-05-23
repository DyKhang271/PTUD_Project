import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getStudent, getGradesSummary, getGrades } from '../../services/api';
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

function getGradeColor(letter) {
  if (['A', 'A+'].includes(letter)) return '#16a34a';
  if (['B+', 'B'].includes(letter)) return '#2563eb';
  if (['C+', 'C'].includes(letter)) return '#f59e0b';
  return '#ef4444';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isParent } = useAuth();
  const [student, setStudent] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedChartTerm, setSelectedChartTerm] = useState('');
  const [chartTermData, setChartTermData] = useState(null);
  const [chartTermDropdownOpen, setChartTermDropdownOpen] = useState(false);
  const chartTermDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (chartTermDropdownRef.current && !chartTermDropdownRef.current.contains(event.target)) {
        setChartTermDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user?.mssv) return;

    setLoading(true);
    Promise.all([
      getStudent(user.mssv),
      getGradesSummary(user.mssv),
    ])
      .then(([studentRes, summaryRes]) => {
        setStudent(studentRes.data);
        setSummary(summaryRes.data);
        if (summaryRes.data.previous_term_chart?.term) {
          setSelectedChartTerm(summaryRes.data.previous_term_chart.term);
        } else if (summaryRes.data.semesters?.length > 0) {
          setSelectedChartTerm(summaryRes.data.semesters[summaryRes.data.semesters.length - 1]);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Không thể tải dữ liệu. Vui lòng thử lại.');
        setLoading(false);
      });
  }, [user?.mssv]);

  useEffect(() => {
    if (!selectedChartTerm || !user?.mssv) return;

    // Use initial summary data to save a request for the default term
    if (summary && summary.previous_term_chart?.term === selectedChartTerm && !chartTermData) {
      setChartTermData({
        gpa_hoc_ky: summary.previous_term_chart.gpa_hoc_ky,
        mon_hoc: summary.previous_term_chart.courses.map(c => ({
          ten_mon: c.course_name,
          ma_mon: c.course_code,
          tc: c.credits,
          diem_tk_4: c.gpa4,
          xep_loai: c.letter
        }))
      });
      return;
    }

    getGrades(selectedChartTerm, user.mssv)
      .then(res => setChartTermData(res.data))
      .catch(() => {});
  }, [selectedChartTerm, user?.mssv]);

  const remainingCredits = summary?.tc_con_lai ?? 0;
  const currentTerm = splitTermLabel(summary?.current_term);

  const chartCourses = useMemo(
    () => (chartTermData?.mon_hoc || []).filter(c => c.diem_tk_4 !== undefined && c.diem_tk_4 !== null && c.diem_tk_4 !== '-'),
    [chartTermData],
  );

  const gpaHistory = useMemo(() => summary?.gpa_history || [], [summary]);

  const renderGpaChart = () => {
    if (gpaHistory.length === 0) {
      return <div className={styles.emptyState}>Chưa có đủ dữ liệu GPA để hiển thị biểu đồ.</div>;
    }

    const svgWidth = 550;
    const svgHeight = 320;
    const paddingX = 40;
    const paddingY = 25;
    const chartW = svgWidth - paddingX * 2;
    const chartH = svgHeight - paddingY * 2 - 20; // Extra room at bottom for labels

    const points = gpaHistory.map((item, i) => {
      const shortTerm = item.term.split(' (')[0]; // Extends "HK1 (2023 - 2024)" into "HK1"
      const x = paddingX + (i / Math.max(1, gpaHistory.length - 1)) * chartW;
      const y = paddingY + chartH - (item.gpa4_term / 4.0) * chartH;
      return { x, y, term: shortTerm, gpa: item.gpa4_term, gpaCum: item.gpa4_cumulative };
    });

    const pathData = "M " + points.map(p => `${p.x},${p.y}`).join(" L ");
    const cumPathData = "M " + points.map((p) => {
      const y = paddingY + chartH - (p.gpaCum / 4.0) * chartH;
      return `${p.x},${y}`;
    }).join(" L ");

    return (
      <div className={styles.svgChartContainer}>
        <div className={styles.chartLegend}>
          <div className={styles.legendItem}><span className={styles.legendColor} style={{background: 'var(--primary)'}}></span> GPA Từng kỳ</div>
          <div className={styles.legendItem}><span className={styles.legendColor} style={{background: '#f59e0b'}}></span> GPA Tích lũy</div>
        </div>
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className={styles.svgLineChart}>
          {/* Y Axis Grid */}
          {[1, 2, 3, 4].map(val => {
            const y = paddingY + chartH - (val / 4.0) * chartH;
            return (
              <g key={`grid-y-${val}`}>
                <line x1={paddingX} y1={y} x2={svgWidth - paddingX} y2={y} stroke="var(--border-light)" strokeWidth="1" />
                <text x={paddingX - 10} y={y + 4} fontSize="11" fill="var(--text-light)" textAnchor="end">{val.toFixed(1)}</text>
              </g>
            );
          })}
          <text x={paddingX - 10} y={paddingY + chartH + 4} fontSize="11" fill="var(--text-light)" textAnchor="end">0.0</text>

          {/* Cumulative GPA Path */}
          <path d={cumPathData} fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="5,5" />
          
          {/* Term GPA Path */}
          <path d={pathData} fill="none" stroke="var(--primary)" strokeWidth="3" />
          
          {/* Data Points */}
          {points.map((p, i) => (
            <g key={`point-${i}`} className={styles.svgPointGroup}>
              {/* Vertical guideline */}
              <line className={styles.svgGuideLine} x1={p.x} y1={paddingY} x2={p.x} y2={paddingY + chartH} stroke="var(--border)" strokeWidth="1" strokeDasharray="4,4" opacity="0" />
              <circle cx={p.x} cy={p.y} r="5" fill="#fff" stroke="var(--primary)" strokeWidth="2.5" />
              <text x={p.x} y={p.y - 14} fontSize="11" fontWeight="bold" fill="var(--primary)" textAnchor="middle">{p.gpa.toFixed(2)}</text>
              {/* X Axis Label */}
              <text x={p.x} y={svgHeight - 12} fontSize="11" fontWeight="600" fill="var(--text-secondary)" textAnchor="middle">{p.term}</text>
            </g>
          ))}
        </svg>
      </div>
    );
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
            <h2 className={styles.cardTitle}>📊 GPA các môn theo kỳ</h2>
            {summary?.semesters?.length > 0 && (
              <div className={styles.customSelectWrapper} ref={chartTermDropdownRef}>
                <button 
                  className={styles.customSelectBtn} 
                  onClick={() => setChartTermDropdownOpen(!chartTermDropdownOpen)}
                >
                  <span>{selectedChartTerm === 'all' ? 'Tất cả các kỳ' : selectedChartTerm}</span>
                  <span className={`${styles.customSelectIcon} ${chartTermDropdownOpen ? styles.iconOpen : ''}`}>▼</span>
                </button>
                {chartTermDropdownOpen && (
                  <div className={styles.customDropdownMenu}>
                    <div
                      className={`${styles.customDropdownOption} ${selectedChartTerm === 'all' ? styles.customDropdownOptionActive : ''}`}
                      onClick={() => {
                        setSelectedChartTerm('all');
                        setChartTermDropdownOpen(false);
                      }}
                    >
                      Tất cả các kỳ
                    </div>
                    {summary.semesters.map((term) => (
                      <div
                        key={term}
                        className={`${styles.customDropdownOption} ${selectedChartTerm === term ? styles.customDropdownOptionActive : ''}`}
                        onClick={() => {
                          setSelectedChartTerm(term);
                          setChartTermDropdownOpen(false);
                        }}
                      >
                        {term}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className={styles.cardBody}>
            {chartCourses.length > 0 ? (
              <>
                <div className={styles.chartSummaryRow}>
                  <div>
                    <div className={styles.chartSummaryValue}>
                      {chartTermData?.gpa_hoc_ky?.toFixed(2) || '0.00'}
                    </div>
                    <div className={styles.chartSummaryLabel}>GPA học kỳ</div>
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
                    {chartCourses.map((course, index) => {
                      const fillPercent = (course.diem_tk_4 / 4.0) * 100;
                      return (
                        <div key={index} className={styles.chartBarItem}>
                          <div className={styles.chartBarValue}>{course.diem_tk_4}</div>
                          <div className={styles.chartBarTrack}>
                            <div
                              className={styles.chartBarFill}
                              style={{
                                height: `${fillPercent}%`,
                                background: getGradeColor(course.xep_loai),
                              }}
                            />
                          </div>
                          <div className={styles.chartBarLabel} title={course.ten_mon}>
                            {course.ten_mon}
                          </div>
                          <div className={styles.chartBarMeta}>{course.tc} TC</div>
                        </div>
                      );
                    })}
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
            <h2 className={styles.cardTitle}>📈 Biểu đồ biến thiên GPA</h2>
          </div>
          <div className={styles.cardBody}>
            {renderGpaChart()}
          </div>
        </div>
      </div>
    </div>
  );
}
