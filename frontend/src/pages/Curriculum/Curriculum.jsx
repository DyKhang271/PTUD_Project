import { useEffect, useState } from 'react';
import { getCurriculum } from '../../services/api';
import styles from './Curriculum.module.css';

const FILTER_TABS = ['Tất cả', 'Đại cương', 'Cơ sở ngành', 'Chuyên ngành', 'Tự chọn'];

export default function Curriculum() {
  const [data, setData] = useState([]);
  const [activeFilter, setActiveFilter] = useState('Tất cả');
  const [openSemesters, setOpenSemesters] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getCurriculum()
      .then((res) => {
        setData(res.data);
        // Open all semesters by default
        const open = {};
        res.data.forEach((_, i) => { open[i] = true; });
        setOpenSemesters(open);
        setLoading(false);
      })
      .catch(() => {
        setError('Không thể tải chương trình khung.');
        setLoading(false);
      });
  }, []);

  const toggleSemester = (index) => {
    setOpenSemesters((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Hoàn thành': return '✅';
      case 'Đang học': return '⏳';
      case 'Chưa học': return '⬜';
      case 'Rớt': return '🔴';
      default: return '⬜';
    }
  };

  const getTypeClass = (type) => {
    switch (type) {
      case 'Đại cương': return styles.typeDaiCuong;
      case 'Cơ sở ngành': return styles.typeCoSoNganh;
      case 'Chuyên ngành': return styles.typeChuyenNganh;
      case 'Tự chọn': return styles.typeTuChon;
      default: return '';
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Hoàn thành': return styles.statusDone;
      case 'Đang học': return styles.statusInProgress;
      case 'Rớt': return styles.statusDone; // red handled by icon
      default: return styles.statusPending;
    }
  };

  // Filter data
  const filteredData = data.map((semester) => ({
    ...semester,
    mon_hoc:
      activeFilter === 'Tất cả'
        ? semester.mon_hoc
        : semester.mon_hoc.filter((m) => m.loai === activeFilter),
  })).filter((semester) => semester.mon_hoc.length > 0);

  // Calculate totals
  const allCourses = data.flatMap((s) => s.mon_hoc);
  const tcTotal = 140;
  const tcDone = allCourses.filter((m) => m.trang_thai === 'Hoàn thành').reduce((s, m) => s + m.tc, 0);
  const tcCurrent = allCourses.filter((m) => m.trang_thai === 'Đang học').reduce((s, m) => s + m.tc, 0);
  const tcLeft = tcTotal - tcDone - tcCurrent;

  if (loading) {
    return (
      <div className={styles.curriculum}>
        <div className={styles.loadingCenter}><div className="spinner" /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.curriculum}>
        <div className="errorMessage">⚠️ {error}</div>
      </div>
    );
  }

  return (
    <div className={styles.curriculum}>
      {/* Filter tabs */}
      <div className={styles.filterRow}>
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            className={`${styles.filterTab} ${activeFilter === tab ? styles.filterTabActive : ''}`}
            onClick={() => setActiveFilter(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Credit overview */}
      <div className={styles.creditRow}>
        <div className={`${styles.creditCard} ${styles.creditTotal}`}>
          <div className={styles.creditValue}>{tcTotal}</div>
          <div className={styles.creditLabel}>Tổng TC cần</div>
        </div>
        <div className={`${styles.creditCard} ${styles.creditDone}`}>
          <div className={styles.creditValue}>{tcDone} ✅</div>
          <div className={styles.creditLabel}>Đã hoàn thành</div>
        </div>
        <div className={`${styles.creditCard} ${styles.creditCurrent}`}>
          <div className={styles.creditValue}>{tcCurrent} ⏳</div>
          <div className={styles.creditLabel}>Đang học</div>
        </div>
        <div className={`${styles.creditCard} ${styles.creditLeft}`}>
          <div className={styles.creditValue}>{tcLeft} ❌</div>
          <div className={styles.creditLabel}>Còn lại</div>
        </div>
      </div>

      {/* Semester groups */}
      {filteredData.map((semester, index) => {
        const origIndex = data.indexOf(data.find((d) => d.hoc_ky === semester.hoc_ky));
        const isOpen = openSemesters[origIndex];
        const doneTC = semester.mon_hoc
          .filter((m) => m.trang_thai === 'Hoàn thành')
          .reduce((s, m) => s + m.tc, 0);
        const totalTC = semester.mon_hoc.reduce((s, m) => s + m.tc, 0);

        return (
          <div className={styles.semesterGroup} key={semester.hoc_ky}>
            <div
              className={styles.semesterHeader}
              onClick={() => toggleSemester(origIndex)}
            >
              <div className={styles.semesterTitle}>
                <span className={`${styles.semesterArrow} ${isOpen ? styles.semesterArrowOpen : ''}`}>
                  ▼
                </span>
                {semester.hoc_ky}
              </div>
              <div className={styles.semesterProgress}>
                <span className={doneTC === totalTC ? styles.semesterProgressDone : ''}>
                  {doneTC}/{totalTC} TC
                </span>
              </div>
            </div>

            {isOpen && (
              <div className={styles.courseList}>
                {semester.mon_hoc.map((m) => (
                  <div className={styles.courseItem} key={m.ma_mon}>
                    <span className={styles.courseIcon}>{getStatusIcon(m.trang_thai)}</span>
                    <div className={styles.courseName}>
                      {m.ten_mon}
                      <span className={styles.courseCode}>{m.ma_mon}</span>
                      {m.trang_thai === 'Rớt' && (
                        <span className={styles.retakeBadge}>Học lại</span>
                      )}
                    </div>
                    <span className={styles.courseCredits}>{m.tc} TC</span>
                    <span className={`${styles.courseType} ${getTypeClass(m.loai)}`}>
                      {m.loai}
                    </span>
                    <span className={`${styles.courseStatus} ${getStatusClass(m.trang_thai)}`}>
                      {m.trang_thai}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
