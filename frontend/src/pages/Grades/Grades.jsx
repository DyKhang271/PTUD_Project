import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getGrades, getGradesSummary, getStudent } from '../../services/api';
import styles from './Grades.module.css';

const buildScoreColumns = (courses) => {
  const maxRegularCount = Math.max(0, ...courses.map((course) => (course.regular_scores || []).length));
  const maxPracticeCount = Math.max(0, ...courses.map((course) => (course.practice_scores || []).length));
  const columns = [];

  for (let index = 0; index < maxRegularCount; index += 1) {
    columns.push({ key: `regular_${index}`, label: `TK${index + 1}` });
  }

  for (let index = 0; index < maxPracticeCount; index += 1) {
    columns.push({ key: `practice_${index}`, label: `TH${index + 1}` });
  }

  if (courses.some((course) => course.tbqt_score !== null && course.tbqt_score !== undefined)) {
    columns.push({ key: 'tbqt_score', label: 'QT' });
  }

  if (courses.some((course) => course.midterm_score !== null && course.midterm_score !== undefined)) {
    columns.push({ key: 'midterm_score', label: 'GK' });
  }

  if (courses.some((course) => course.final_exam_score !== null && course.final_exam_score !== undefined)) {
    columns.push({ key: 'final_exam_score', label: 'CK' });
  }

  columns.push({ key: 'diem_tk_10', label: 'TK (10)' });
  columns.push({ key: 'diem_tk_4', label: 'TK (4)' });

  return columns;
};

const getColumnValue = (course, columnKey) => {
  if (columnKey.startsWith('regular_')) {
    const index = Number(columnKey.split('_')[1]);
    return course.regular_scores?.[index] ?? '-';
  }

  if (columnKey.startsWith('practice_')) {
    const index = Number(columnKey.split('_')[1]);
    return course.practice_scores?.[index] ?? '-';
  }

  return course[columnKey] ?? '-';
};

export default function Grades() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [student, setStudent] = useState(null);
  const [semesterData, setSemesterData] = useState(null);
  const [selectedSemester, setSelectedSemester] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user?.mssv) return;

    setLoading(true);
    Promise.all([getGradesSummary(user.mssv), getStudent(user.mssv)])
      .then(([summaryRes, studentRes]) => {
        setSummary(summaryRes.data);
        setStudent(studentRes.data);
        setSelectedSemester(
          summaryRes.data.latest_completed_term || summaryRes.data.semesters?.[0] || '',
        );
        setLoading(false);
      })
      .catch(() => {
        setError('Khong the tai du lieu. Vui long thu lai.');
        setLoading(false);
      });
  }, [user?.mssv]);

  useEffect(() => {
    if (!selectedSemester || !user?.mssv) return;

    getGrades(selectedSemester, user.mssv)
      .then((res) => setSemesterData(res.data))
      .catch(() => {});
  }, [selectedSemester, user?.mssv]);

  const getGradeClass = (grade) => {
    if (!grade || grade === '-') return '';
    if (grade.startsWith('A')) return styles.gradeA;
    if (grade.startsWith('B')) return styles.gradeB;
    if (grade.startsWith('C') || grade.startsWith('D')) return styles.gradeC;
    if (grade === 'F') return styles.gradeF;
    return '';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Dat':
      case 'Đạt':
        return styles.statusPass;
      case 'Rot':
      case 'Rớt':
        return styles.statusFail;
      case 'Dang hoc':
      case 'Đang học':
        return styles.statusCurrent;
      default:
        return '';
    }
  };

  const courses = semesterData?.mon_hoc || [];
  const scoreColumns = buildScoreColumns(courses);

  const handleExportPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(18);
    doc.setTextColor(26, 60, 110);
    doc.text('BANG DIEM SINH VIEN', 148, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Ho ten: ${student?.ho_ten || ''}`, 14, 35);
    doc.text(`MSSV: ${student?.mssv || ''}`, 14, 42);
    doc.text(`Nganh: ${student?.nganh || ''}`, 14, 49);
    doc.text(`GPA Tich luy: ${summary?.gpa_tich_luy?.toFixed(2) || ''}`, 200, 35);
    doc.text(`Xep loai: ${summary?.xep_loai || ''}`, 200, 42);
    doc.text(`Hoc ky: ${semesterData?.hoc_ky || selectedSemester}`, 200, 49);

    const tableData = courses.map((course) => [
      course.stt,
      course.ma_mon,
      course.ten_mon,
      course.tc,
      ...scoreColumns.map((column) => getColumnValue(course, column.key)),
      course.xep_loai,
      course.trang_thai,
    ]);

    autoTable(doc, {
      startY: 58,
      head: [[
        'STT',
        'Ma mon',
        'Ten mon',
        'TC',
        ...scoreColumns.map((column) => column.label),
        'Xep loai',
        'Trang thai',
      ]],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [26, 60, 110], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    doc.save(`bang-diem-${selectedSemester}.pdf`);
  };

  if (loading) {
    return (
      <div className={styles.grades}>
        <div className={styles.loadingCenter}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.grades}>
        <div className="errorMessage">Warning: {error}</div>
      </div>
    );
  }

  const percent = summary?.tc_tong ? ((summary.tc_dat / summary.tc_tong) * 100).toFixed(1) : 0;

  return (
    <div className={styles.grades}>
      <div className={styles.summaryRow}>
        <div className={styles.sumCard}>
          <div className={`${styles.sumIcon} ${styles.sumIconGpa}`}>GPA</div>
          <div className={styles.sumInfo}>
            <div className={styles.sumValue}>{summary?.gpa_tich_luy?.toFixed(2)}</div>
            <div className={styles.sumLabel}>GPA tich luy</div>
          </div>
        </div>
        <div className={styles.sumCard}>
          <div className={`${styles.sumIcon} ${styles.sumIconPass}`}>TC</div>
          <div className={styles.sumInfo}>
            <div className={styles.sumValue}>{summary?.tc_dat} TC</div>
            <div className={styles.sumLabel}>Tin chi da tich luy</div>
          </div>
        </div>
        <div className={styles.sumCard}>
          <div className={`${styles.sumIcon} ${styles.sumIconFail}`}>HK</div>
          <div className={styles.sumInfo}>
            <div className={styles.sumValue}>{summary?.tc_dang_hoc} TC</div>
            <div className={styles.sumLabel}>Tin chi dang hoc</div>
          </div>
        </div>
      </div>

      <div className={styles.progressCard}>
        <div className={styles.progressLabel}>
          <span className={styles.progressText}>
            Tien do tin chi: {summary?.tc_dat}/{summary?.tc_tong} TC
          </span>
          <span className={styles.progressPercent}>{percent}%</span>
        </div>
        <div className={styles.progressBarOuter}>
          <div className={styles.progressBarInner} style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className={styles.semesterSelector}>
        <span className={styles.semesterLabel}>Chon hoc ky:</span>
        <div className={styles.customSelectWrapper} ref={dropdownRef}>
          <button
            className={styles.customSelectBtn}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <span>{selectedSemester === 'all' ? 'Tat ca hoc ky' : selectedSemester}</span>
            <span className={`${styles.customSelectIcon} ${dropdownOpen ? styles.iconOpen : ''}`}>
              ▼
            </span>
          </button>
          {dropdownOpen && (
            <div className={styles.customDropdownMenu}>
              <div
                className={`${styles.customDropdownOption} ${selectedSemester === 'all' ? styles.customDropdownOptionActive : ''}`}
                onClick={() => {
                  setSelectedSemester('all');
                  setDropdownOpen(false);
                }}
              >
                Tat ca hoc ky
              </div>
              {(summary?.semesters || []).map((semester) => (
                <div
                  key={semester}
                  className={`${styles.customDropdownOption} ${selectedSemester === semester ? styles.customDropdownOptionActive : ''}`}
                  onClick={() => {
                    setSelectedSemester(semester);
                    setDropdownOpen(false);
                  }}
                >
                  {semester}
                </div>
              ))}
            </div>
          )}
        </div>
        {semesterData && semesterData.gpa_hoc_ky > 0 && (
          <span className={styles.semesterGpa}>
            {selectedSemester === 'all' ? 'GPA tich luy: ' : 'GPA hoc ky: '}
            <span className={styles.semesterGpaValue}>{semesterData.gpa_hoc_ky?.toFixed(2)}</span>
          </span>
        )}
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>STT</th>
                <th>Ma mon</th>
                <th>Ten mon hoc</th>
                <th>TC</th>
                {scoreColumns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
                <th>Xep loai</th>
                <th>Trang thai</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course, index, arr) => {
                const prev = arr[index - 1];
                const showHeader = course.hoc_ky_goc && (!prev || prev.hoc_ky_goc !== course.hoc_ky_goc);

                return (
                  <React.Fragment key={`${course.ma_mon}-${course.stt}`}>
                    {showHeader && (
                      <tr className={styles.termGroupHeader}>
                        <td colSpan={scoreColumns.length + 6}>{course.hoc_ky_goc}</td>
                      </tr>
                    )}
                    <tr>
                      <td>{course.stt}</td>
                      <td>{course.ma_mon}</td>
                      <td>{course.ten_mon}</td>
                      <td>{course.tc}</td>
                      {scoreColumns.map((column) => (
                        <td key={column.key}>{getColumnValue(course, column.key)}</td>
                      ))}
                      <td className={getGradeClass(course.xep_loai)}>{course.xep_loai}</td>
                      <td>
                        <span className={`${styles.statusBadge} ${getStatusBadge(course.trang_thai)}`}>
                          {course.trang_thai}
                        </span>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.exportRow}>
        <button className={styles.exportBtn} onClick={handleExportPDF}>
          Xuat PDF
        </button>
      </div>
    </div>
  );
}
