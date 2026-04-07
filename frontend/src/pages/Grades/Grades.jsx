import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getGrades, getGradesSummary, getStudent } from '../../services/api';
import styles from './Grades.module.css';

export default function Grades() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [student, setStudent] = useState(null);
  const [semesterData, setSemesterData] = useState(null);
  const [selectedSemester, setSelectedSemester] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        setError('Không thể tải dữ liệu. Vui lòng thử lại.');
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
      case 'Đạt':
        return styles.statusPass;
      case 'Rớt':
        return styles.statusFail;
      case 'Đang học':
        return styles.statusCurrent;
      default:
        return '';
    }
  };

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

    const tableData = (semesterData?.mon_hoc || []).map((course) => [
      course.stt,
      course.ma_mon,
      course.ten_mon,
      course.tc,
      course.diem_qt ?? '-',
      course.diem_gk ?? '-',
      course.diem_ck ?? '-',
      course.diem_tk_10 ?? '-',
      course.diem_tk_4 ?? '-',
      course.xep_loai,
      course.trang_thai,
    ]);

    autoTable(doc, {
      startY: 58,
      head: [['STT', 'Ma mon', 'Ten mon', 'TC', 'QT', 'GK', 'CK', 'TK(10)', 'TK(4)', 'Xep loai', 'Trang thai']],
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
        <div className="errorMessage">⚠️ {error}</div>
      </div>
    );
  }

  const percent = summary ? ((summary.tc_dat / summary.tc_tong) * 100).toFixed(1) : 0;

  return (
    <div className={styles.grades}>
      <div className={styles.summaryRow}>
        <div className={styles.sumCard}>
          <div className={`${styles.sumIcon} ${styles.sumIconGpa}`}>📈</div>
          <div className={styles.sumInfo}>
            <div className={styles.sumValue}>{summary?.gpa_tich_luy?.toFixed(2)}</div>
            <div className={styles.sumLabel}>GPA tích lũy</div>
          </div>
        </div>
        <div className={styles.sumCard}>
          <div className={`${styles.sumIcon} ${styles.sumIconPass}`}>✅</div>
          <div className={styles.sumInfo}>
            <div className={styles.sumValue}>{summary?.tc_dat} TC</div>
            <div className={styles.sumLabel}>Tín chỉ đã tích lũy</div>
          </div>
        </div>
        <div className={styles.sumCard}>
          <div className={`${styles.sumIcon} ${styles.sumIconFail}`}>⏳</div>
          <div className={styles.sumInfo}>
            <div className={styles.sumValue}>{summary?.tc_dang_hoc} TC</div>
            <div className={styles.sumLabel}>Tín chỉ đang học</div>
          </div>
        </div>
      </div>

      <div className={styles.progressCard}>
        <div className={styles.progressLabel}>
          <span className={styles.progressText}>
            Tiến độ tín chỉ: {summary?.tc_dat}/{summary?.tc_tong} TC
          </span>
          <span className={styles.progressPercent}>{percent}%</span>
        </div>
        <div className={styles.progressBarOuter}>
          <div
            className={styles.progressBarInner}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className={styles.semesterSelector}>
        <span className={styles.semesterLabel}>📅 Chọn học kỳ:</span>
        <select
          className={styles.semesterSelect}
          value={selectedSemester}
          onChange={(e) => setSelectedSemester(e.target.value)}
        >
          {(summary?.semesters || []).map((semester) => (
            <option key={semester} value={semester}>
              {semester}
            </option>
          ))}
        </select>
        {semesterData && semesterData.gpa_hoc_ky > 0 && (
          <span className={styles.semesterGpa}>
            GPA học kỳ:{' '}
            <span className={styles.semesterGpaValue}>
              {semesterData.gpa_hoc_ky?.toFixed(2)}
            </span>
          </span>
        )}
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>STT</th>
                <th>Mã môn</th>
                <th>Tên môn học</th>
                <th>TC</th>
                <th>QT</th>
                <th>GK</th>
                <th>CK</th>
                <th>TK (10)</th>
                <th>TK (4)</th>
                <th>Xếp loại</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {(semesterData?.mon_hoc || []).map((course) => (
                <tr key={`${course.ma_mon}-${course.stt}`}>
                  <td>{course.stt}</td>
                  <td>{course.ma_mon}</td>
                  <td>{course.ten_mon}</td>
                  <td>{course.tc}</td>
                  <td>{course.diem_qt ?? '-'}</td>
                  <td>{course.diem_gk ?? '-'}</td>
                  <td>{course.diem_ck ?? '-'}</td>
                  <td>{course.diem_tk_10 ?? '-'}</td>
                  <td>{course.diem_tk_4 ?? '-'}</td>
                  <td className={getGradeClass(course.xep_loai)}>{course.xep_loai}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${getStatusBadge(course.trang_thai)}`}>
                      {course.trang_thai}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.exportRow}>
        <button className={styles.exportBtn} onClick={handleExportPDF}>
          📄 Xuất PDF
        </button>
      </div>
    </div>
  );
}
