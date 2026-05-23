import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getTeacherCourseStudents,
  getTeacherCourses,
  getTeacherOverview,
  importTeacherStudentGrades,
  updateTeacherStudentGrade,
} from '../../services/api';
import TeacherStats from '../../components/Teacher/TeacherStats';
import CourseRosterPanel from '../../components/Teacher/CourseRosterPanel';
import GradeEditorModal from '../../components/Teacher/GradeEditorModal';
import styles from './TeacherDashboard.module.css';

function getErrorMessage(error, fallback) {
  return error?.response?.data?.detail || fallback;
}

const CSV_HEADER_ALIASES = {
  mssv: 'mssv',
  student_id: 'mssv',
  class_section_code: 'class_section_code',
  ma_lop_hoc_phan: 'class_section_code',
  diem_thuong_ky_1: 'diem_thuong_ky_1',
  thuong_ky_1: 'diem_thuong_ky_1',
  tk1: 'diem_thuong_ky_1',
  diem_thuong_ky_2: 'diem_thuong_ky_2',
  thuong_ky_2: 'diem_thuong_ky_2',
  tk2: 'diem_thuong_ky_2',
  diem_thuc_hanh_1: 'diem_thuc_hanh_1',
  thuc_hanh_1: 'diem_thuc_hanh_1',
  th1: 'diem_thuc_hanh_1',
  diem_thuc_hanh_2: 'diem_thuc_hanh_2',
  thuc_hanh_2: 'diem_thuc_hanh_2',
  th2: 'diem_thuc_hanh_2',
  diem_qt: 'diem_qt',
  qt: 'diem_qt',
  diem_gk: 'diem_gk',
  gk: 'diem_gk',
  diem_ck: 'diem_ck',
  ck: 'diem_ck',
};

const CSV_TEMPLATE_HEADERS = [
  'mssv',
  'class_section_code',
  'diem_thuong_ky_1',
  'diem_thuong_ky_2',
  'diem_thuc_hanh_1',
  'diem_thuc_hanh_2',
  'diem_qt',
  'diem_gk',
  'diem_ck',
];

function normalizeHeader(value) {
  return CSV_HEADER_ALIASES[value.trim().toLowerCase()] || null;
}

function guessDelimiter(headerLine) {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

function splitCsvLine(line, delimiter) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function parseCsvScore(value) {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }

  const score = Number(normalized.replace(',', '.'));
  if (Number.isNaN(score)) {
    throw new Error(`Giá trị điểm không hợp lệ: ${normalized}`);
  }
  return score;
}

function parseGradeCsvText(text) {
  const normalizedText = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedText.split('\n').filter((line) => line.trim());

  if (lines.length < 2) {
    throw new Error('File CSV cần có ít nhất 1 dòng tiêu đề và 1 dòng dữ liệu.');
  }

  const delimiter = guessDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeHeader);
  if (!headers.includes('mssv')) {
    throw new Error('File CSV cần có cột mssv.');
  }

  return lines
    .slice(1)
    .map((line, index) => {
      const cells = splitCsvLine(line, delimiter);
      const row = { row_number: index + 2 };

      headers.forEach((header, cellIndex) => {
        if (!header) {
          return;
        }
        row[header] = (cells[cellIndex] || '').trim();
      });

      const hasContent = Object.entries(row).some(([key, value]) => key !== 'row_number' && value);
      if (!hasContent) {
        return null;
      }

      return {
        row_number: row.row_number,
        mssv: (row.mssv || '').trim(),
        class_section_code: (row.class_section_code || '').trim() || null,
        diem_thuong_ky_1: parseCsvScore(row.diem_thuong_ky_1),
        diem_thuong_ky_2: parseCsvScore(row.diem_thuong_ky_2),
        diem_thuc_hanh_1: parseCsvScore(row.diem_thuc_hanh_1),
        diem_thuc_hanh_2: parseCsvScore(row.diem_thuc_hanh_2),
        diem_qt: parseCsvScore(row.diem_qt),
        diem_gk: parseCsvScore(row.diem_gk),
        diem_ck: parseCsvScore(row.diem_ck),
      };
    })
    .filter(Boolean);
}

function escapeCsvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function downloadCsvFile(filename, rows) {
  const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildImportFeedback(result) {
  const importedCount = result?.imported_count || 0;
  const errorCount = result?.error_count || 0;
  const errors = result?.errors || [];

  if (!errorCount) {
    return '';
  }

  const sample = errors
    .slice(0, 3)
    .map((item) => `dòng ${item.row_number}: ${item.message}`)
    .join(' | ');

  return `Đã import ${importedCount} dòng, còn ${errorCount} dòng lỗi. ${sample}`;
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
  const [importing, setImporting] = useState(false);
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

  const loadOverviewAndCourses = useCallback(async () => {
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
  }, [user?.username]);

  const loadRoster = useCallback(async (course) => {
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
  }, [user?.username]);

  useEffect(() => {
    loadOverviewAndCourses();
  }, [loadOverviewAndCourses]);

  useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);

  useEffect(() => {
    if (selectedCourse) {
      loadRoster(selectedCourse);
    }
  }, [selectedCourse, loadRoster]);

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

  const handleImportCsv = async (file) => {
    if (!file || !selectedCourse || !user?.username) {
      return;
    }

    setImporting(true);
    try {
      const fileText = await file.text();
      const rows = parseGradeCsvText(fileText);
      if (rows.length === 0) {
        throw new Error('File CSV không có dòng dữ liệu nào để import.');
      }

      const res = await importTeacherStudentGrades({
        username: user.username,
        course_code: selectedCourse.course_code,
        term: selectedCourse.term,
        rows,
      });

      await loadOverviewAndCourses();
      await loadRoster(selectedCourse);

      const feedback = buildImportFeedback(res.data);
      setError(feedback);
      showToast(
        res.data.error_count
          ? `Đã import ${res.data.imported_count} dòng, có ${res.data.error_count} dòng lỗi.`
          : `Đã import ${res.data.imported_count} dòng điểm từ CSV.`,
      );
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể import file CSV điểm.'));
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    if (!selectedCourse) {
      return;
    }

    const rows = [
      CSV_TEMPLATE_HEADERS.join(','),
      ...students.map((student) =>
        [
          student.mssv,
          student.class_section_code,
          '',
          '',
          '',
          '',
          student.diem_qt ?? '',
          student.diem_gk ?? '',
          student.diem_ck ?? '',
        ]
          .map(escapeCsvCell)
          .join(','),
      ),
    ].join('\n');

    downloadCsvFile(`mau-diem-${selectedCourse.course_code}.csv`, rows);
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
        importing={importing}
        onImportCsv={handleImportCsv}
        onDownloadTemplate={handleDownloadTemplate}
      />

      <GradeEditorModal
        key={activeRecord ? `${activeRecord.mssv}-${activeRecord.class_section_code}` : 'empty'}
        record={activeRecord}
        saving={saving}
        onClose={() => setActiveRecord(null)}
        onSubmit={handleSaveGrade}
      />

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}
