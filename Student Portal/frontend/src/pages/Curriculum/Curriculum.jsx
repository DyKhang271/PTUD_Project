import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getCurriculum, getGradesSummary } from '../../services/api';
import styles from './Curriculum.module.css';

const FILTER_TABS = ['Tất cả', 'Bắt buộc', 'Tự chọn'];

export default function Curriculum() {
  const { user } = useAuth();
  const [curriculum, setCurriculum] = useState(null);
  const [gradesSummary, setGradesSummary] = useState(null);
  const [activeFilter, setActiveFilter] = useState('Tất cả');
  const [openSemesters, setOpenSemesters] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.mssv) return;

    setLoading(true);
    Promise.all([getCurriculum(user.mssv), getGradesSummary(user.mssv)])
      .then(([curriculumRes, gradesSummaryRes]) => {
        setCurriculum(curriculumRes.data);
        setGradesSummary(gradesSummaryRes.data);
        const openState = {};
        curriculumRes.data.semesters.forEach((_, index) => {
          openState[index] = true;
        });
        setOpenSemesters(openState);
        setLoading(false);
      })
      .catch(() => {
        setError('Không thể tải chương trình khung.');
        setLoading(false);
      });
  }, [user?.mssv]);

  const toggleSemester = (index) => {
    setOpenSemesters((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Hoàn thành':
        return '✅';
      case 'Đang học':
        return '⏳';
      case 'Rớt':
        return '🔴';
      default:
        return '⬜';
    }
  };

  const getTypeClass = (type) => {
    switch (type) {
      case 'Bắt buộc':
        return styles.typeMandatory;
      case 'Tự chọn':
        return styles.typeElective;
      default:
        return '';
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Hoàn thành':
        return styles.statusDone;
      case 'Đang học':
        return styles.statusInProgress;
      case 'Rớt':
        return styles.statusRetake;
      default:
        return styles.statusPending;
    }
  };

  if (loading) {
    return (
      <div className={styles.curriculum}>
        <div className={styles.loadingCenter}>
          <div className="spinner" />
        </div>
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

  const semesters = curriculum?.semesters || [];
  const filteredData = semesters
    .map((semester) => ({
      ...semester,
      mon_hoc:
        activeFilter === 'Tất cả'
          ? semester.mon_hoc
          : semester.mon_hoc.filter((course) => course.loai === activeFilter),
    }))
    .filter((semester) => semester.mon_hoc.length > 0);

  const tcTotal = gradesSummary?.tc_tong || curriculum?.summary?.total_required_credits || 0;
  const tcDone = gradesSummary?.tc_dat || 0;
  const tcCurrent = gradesSummary?.tc_dang_hoc || 0;
  const tcLeft = gradesSummary?.tc_con_lai ?? Math.max(tcTotal - tcDone - tcCurrent, 0);

  return (
    <div className={styles.curriculum}>
      <div className={styles.heroCard}>
        <div>
          <div className={styles.heroLabel}>Chương trình khung</div>
          <h2 className={styles.heroTitle}>{curriculum?.student?.program_name}</h2>
          <div className={styles.heroMeta}>
            {curriculum?.student?.ho_ten} • {curriculum?.student?.mssv}
          </div>
        </div>
        <div className={styles.heroNote}>
          {curriculum?.summary?.note}
          <div className={styles.heroSubnote}>
            Danh sách bên dưới hiển thị toàn bộ lựa chọn môn tự chọn; số tín chỉ tổng quan dùng theo số tổng hợp chính thức của hồ sơ sinh viên.
          </div>
        </div>
      </div>

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

      {filteredData.map((semester, index) => {
        const originalIndex = semesters.findIndex((item) => item.hoc_ky === semester.hoc_ky);
        const isOpen = openSemesters[originalIndex];
        const doneCourses = semester.mon_hoc
          .filter((course) => course.trang_thai === 'Hoàn thành')
          .length;
        const totalCourses = semester.mon_hoc.length;

        return (
          <div className={styles.semesterGroup} key={`${semester.hoc_ky}-${index}`}>
            <div
              className={styles.semesterHeader}
              onClick={() => toggleSemester(originalIndex)}
              role="button"
              tabIndex={0}
            >
              <div className={styles.semesterTitle}>
                <span className={`${styles.semesterArrow} ${isOpen ? styles.semesterArrowOpen : ''}`}>
                  ▼
                </span>
                {semester.hoc_ky}
              </div>
              <div className={styles.semesterProgress}>
                <span className={doneCourses === totalCourses ? styles.semesterProgressDone : ''}>
                  {doneCourses}/{totalCourses} môn
                </span>
              </div>
            </div>

            {isOpen && (
              <div className={styles.courseList}>
                {semester.mon_hoc.map((course) => (
                  <div className={styles.courseItem} key={`${course.ma_mon}-${course.ten_mon}`}>
                    <span className={styles.courseIcon}>{getStatusIcon(course.trang_thai)}</span>
                    <div className={styles.courseName}>
                      {course.ten_mon}
                      <span className={styles.courseCode}>{course.ma_mon}</span>
                      {course.mien_gpa && (
                        <span className={styles.excludeBadge}>Miễn GPA</span>
                      )}
                    </div>
                    <span className={styles.courseCredits}>{course.tc} TC</span>
                    <span className={`${styles.courseType} ${getTypeClass(course.loai)}`}>
                      {course.loai}
                    </span>
                    <span className={`${styles.courseStatus} ${getStatusClass(course.trang_thai)}`}>
                      {course.trang_thai}
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
