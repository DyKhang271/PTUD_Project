import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getTeacherCourseStudents,
  getTeacherCourses,
  getTeacherOverview,
  updateTeacherStudentGrade,
} from '../../services/api';
import TeacherStats from '../../components/Teacher/TeacherStats';
import CourseRosterPanel from '../../components/Teacher/CourseRosterPanel';
import GradeEditorModal from '../../components/Teacher/GradeEditorModal';
import styles from './TeacherDashboard.module.css';

function getErrorMessage(error, fallback) {
  return error?.response?.data?.detail || fallback;
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [courses, setCourses] = useState([]);
  const [selectedCourseKey, setSelectedCourseKey] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [activeRecord, setActiveRecord] = useState(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const toastTimerRef = useRef(null);

  const selectedCourse = useMemo(
    () =>
      courses.find((course) => `${course.course_code}__${course.term}` === selectedCourseKey) ||
      null,
    [courses, selectedCourseKey],
  );

  const filteredStudents = useMemo(() => {
    if (!searchText.trim()) {
      return students;
    }
    const keyword = searchText.trim().toLowerCase();
    return students.filter(
      (student) =>
        student.mssv.toLowerCase().includes(keyword) ||
        student.ho_ten.toLowerCase().includes(keyword),
    );
  }, [searchText, students]);

  const showToast = (message) => {
    setToast(message);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(''), 3000);
  };

  const loadOverviewAndCourses = async () => {
    if (!user?.username) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [overviewRes, coursesRes] = await Promise.all([
        getTeacherOverview(user.username),
        getTeacherCourses(user.username),
      ]);
      setOverview(overviewRes.data);
      setCourses(coursesRes.data);
      if (coursesRes.data.length === 0) {
        setStudents([]);
      }
      setSelectedCourseKey((current) => {
        const hasCurrent = coursesRes.data.some(
          (course) => `${course.course_code}__${course.term}` === current,
        );
        if (hasCurrent) {
          return current;
        }
        return coursesRes.data[0]
          ? `${coursesRes.data[0].course_code}__${coursesRes.data[0].term}`
          : '';
      });
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tải dữ liệu giảng viên.'));
    } finally {
      setLoading(false);
    }
  };

  const loadRoster = async (course) => {
    if (!user?.username || !course) {
      return;
    }

    setRosterLoading(true);
    try {
      const res = await getTeacherCourseStudents(user.username, course.course_code, course.term);
      setStudents(res.data.students);
      setError('');
    } catch (err) {
      setStudents([]);
      setError(getErrorMessage(err, 'Không thể tải danh sách sinh viên.'));
    } finally {
      setRosterLoading(false);
    }
  };

  useEffect(() => {
    loadOverviewAndCourses();
  }, [user?.username]);

  useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);

  useEffect(() => {
    if (selectedCourse) {
      loadRoster(selectedCourse);
    }
  }, [selectedCourse?.course_code, selectedCourse?.term, user?.username]);

  const handleSaveGrade = async (payload) => {
    setSaving(true);
    try {
      await updateTeacherStudentGrade({
        username: user.username,
        ...payload,
      });
      setError('');
      await loadOverviewAndCourses();
      await loadRoster({
        course_code: payload.class_section_code.slice(0, 10),
        term: payload.term,
      });
      setActiveRecord(null);
      showToast('Đã lưu điểm vào file JSON và làm mới dữ liệu thành công.');
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể lưu điểm sinh viên.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingWrapper}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>Teacher workspace</div>
          <h2>Quản lý điểm sinh viên theo môn được phân công</h2>
          <p>
            Theo dõi tiến độ nhập điểm, lọc danh sách sinh viên theo từng học phần và cập nhật
            trực tiếp vào file JSON cục bộ của hệ thống.
          </p>
        </div>
        <div className={styles.heroCard}>
          <div className={styles.heroLabel}>Giảng viên đang đăng nhập</div>
          <strong>{overview?.teacher?.name || user?.name}</strong>
          <span>{overview?.teacher?.department || user?.department}</span>
        </div>
      </section>

      {error && <div className="errorMessage">{error}</div>}

      <TeacherStats summary={overview?.summary} />

      <CourseRosterPanel
        courses={courses}
        selectedCourseKey={selectedCourseKey}
        onSelectCourse={setSelectedCourseKey}
        students={filteredStudents}
        loading={rosterLoading}
        searchText={searchText}
        onSearchTextChange={setSearchText}
        onEditStudent={setActiveRecord}
      />

      <GradeEditorModal
        record={activeRecord}
        saving={saving}
        onClose={() => setActiveRecord(null)}
        onSubmit={handleSaveGrade}
      />

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}
