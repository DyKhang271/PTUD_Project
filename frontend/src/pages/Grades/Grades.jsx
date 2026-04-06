import { useEffect, useState } from 'react';
import { getGrades, getGradesSummary, getStudent } from '../../services/api';
import styles from './Grades.module.css';

export default function Grades() {
  const [summary, setSummary] = useState(null);
  const [student, setStudent] = useState(null);
  const [semesterData, setSemesterData] = useState(null);
  const [selectedSemester, setSelectedSemester] = useState('HK1-2024');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([getGradesSummary(), getStudent()])
      .then(([sumRes, stuRes]) => {
        setSummary(sumRes.data);
        setStudent(stuRes.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Không thể tải dữ liệu. Vui lòng thử lại.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    getGrades(selectedSemester)
      .then((res) => setSemesterData(res.data))
      .catch(() => {});
  }, [selectedSemester]);

  const getGradeClass = (grade) => {
    if (!grade || grade === '-') return '';
    if (grade === 'A') return styles.gradeA;
    if (grade.startsWith('B')) return styles.gradeB;
    if (grade.startsWith('C') || grade.startsWith('D')) return styles.gradeC;
    if (grade === 'F') return styles.gradeF;
    return '';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Đạt': return styles.statusPass;
      case 'Rớt': return styles.statusFail;
      case 'Đang học': return styles.statusCurrent;
      default: return '';
    }
  };

  const handleExportPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'landscape' });

    // Header
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

    // Table data
    const tableData = (semesterData?.mon_hoc || []).map((m) => [
      m.stt,
      m.ma_mon,
      m.ten_mon,
      m.tc,
      m.diem_qt || '-',
      m.diem_gk || '-',
      m.diem_ck || '-',
      m.diem_tk_10 || '-',
      m.diem_tk_4 || '-',
      m.xep_loai,
      m.trang_thai,
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
        <div className={styles.loadingCenter}><div className="spinner" /></div>
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
      {/* Summary cards */}
      <div className={styles.summaryRow}>
        <div className={styles.sumCard}>
          <div className={`${styles.sumIcon} ${styles.sumIconGpa}`}>📈</div>
          <div className={styles.sumInfo}>
            <div className={styles.sumValue}>{summary?.gpa_tich_luy?.toFixed(2)}</div>
            <div className={styles.sumLabel}>GPA Tích lũy</div>
          </div>
        </div>
        <div className={styles.sumCard}>
          <div className={`${styles.sumIcon} ${styles.sumIconPass}`}>✅</div>
          <div className={styles.sumInfo}>
            <div className={styles.sumValue}>{summary?.tc_dat} TC</div>
            <div className={styles.sumLabel}>Tín chỉ đã qua</div>
          </div>
        </div>
        <div className={styles.sumCard}>
          <div className={`${styles.sumIcon} ${styles.sumIconFail}`}>❌</div>
          <div className={styles.sumInfo}>
            <div className={styles.sumValue}>{summary?.tc_rot} TC</div>
            <div className={styles.sumLabel}>Tín chỉ rớt / nợ</div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
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

      {/* Semester selector */}
      <div className={styles.semesterSelector}>
        <span className={styles.semesterLabel}>📅 Chọn học kỳ:</span>
        <select
          className={styles.semesterSelect}
          value={selectedSemester}
          onChange={(e) => setSelectedSemester(e.target.value)}
        >
          {(summary?.semesters || []).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {semesterData && semesterData.gpa_hoc_ky > 0 && (
          <span className={styles.semesterGpa}>
            GPA Học kỳ:{' '}
            <span className={styles.semesterGpaValue}>
              {semesterData.gpa_hoc_ky?.toFixed(2)}
            </span>
          </span>
        )}
      </div>

      {/* Grades table */}
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
              {(semesterData?.mon_hoc || []).map((m) => (
                <tr key={m.ma_mon}>
                  <td>{m.stt}</td>
                  <td>{m.ma_mon}</td>
                  <td>{m.ten_mon}</td>
                  <td>{m.tc}</td>
                  <td>{m.diem_qt || '-'}</td>
                  <td>{m.diem_gk || '-'}</td>
                  <td>{m.diem_ck || '-'}</td>
                  <td>{m.diem_tk_10 || '-'}</td>
                  <td>{m.diem_tk_4 || '-'}</td>
                  <td className={getGradeClass(m.xep_loai)}>{m.xep_loai}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${getStatusBadge(m.trang_thai)}`}>
                      {m.trang_thai}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export */}
      <div className={styles.exportRow}>
        <button className={styles.exportBtn} onClick={handleExportPDF}>
          📄 Xuất PDF
        </button>
      </div>
    </div>
  );
}
