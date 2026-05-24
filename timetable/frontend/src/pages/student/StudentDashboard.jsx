import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import StatusBadge from "../../components/StatusBadge";
import { fetchStudentAttendanceSummary } from "../../services/studentApi";

const REQUIRED_THRESHOLD = 80;

function safeAbsencesRemaining(item) {
  const attended = item.present_count + item.late_count + item.excused_count;
  if (!item.total_sessions) return null;
  return Math.max(0, Math.floor(attended / (REQUIRED_THRESHOLD / 100) - item.total_sessions));
}

export default function StudentDashboard() {
  const [state, setState] = useState({ loading: true, error: "", summary: [] });

  async function load() {
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const summary = await fetchStudentAttendanceSummary();
      setState({ loading: false, error: "", summary });
    } catch (err) {
      setState({ loading: false, error: err?.response?.data?.detail || "Không tải được dashboard.", summary: [] });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    const totalSessions = state.summary.reduce((sum, item) => sum + item.total_sessions, 0);
    const present = state.summary.reduce((sum, item) => sum + item.present_count, 0);
    const late = state.summary.reduce((sum, item) => sum + item.late_count, 0);
    const absent = state.summary.reduce((sum, item) => sum + item.absent_count, 0);
    const excused = state.summary.reduce((sum, item) => sum + item.excused_count, 0);
    const rate = totalSessions ? Math.round(((present + late + excused) / totalSessions) * 100) : 100;
    return { totalSessions, present, late, absent, excused, rate };
  }, [state.summary]);

  const riskyCourses = state.summary.filter((item) => item.total_sessions > 0 && item.warning_status === "warning");

  if (state.loading) return <LoadingState label="Đang tải dashboard sinh viên..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  return (
    <div className="section-stack">
      <div className="page-header">
        <h2 className="page-title">Dashboard sinh viên</h2>
        <p className="page-subtitle">Theo dõi tỷ lệ chuyên cần và các môn có nguy cơ cảnh báo.</p>
      </div>

      <div className="cards-grid">
        <div className="panel metric-card">
          <h3>{totals.rate}%</h3>
          <p>Attendance rate</p>
        </div>
        <div className="panel metric-card">
          <h3>{totals.present}</h3>
          <p>Present sessions</p>
        </div>
        <div className="panel metric-card">
          <h3>{totals.absent}</h3>
          <p>Absent sessions</p>
        </div>
        <div className="panel metric-card">
          <h3>{totals.late}</h3>
          <p>Late sessions</p>
        </div>
        <div className="panel metric-card">
          <h3>{riskyCourses.length}</h3>
          <p>Warning courses</p>
        </div>
      </div>

      <div className="table-card">
        <h3>Cảnh báo điểm danh</h3>
        {riskyCourses.length ? (
          <table>
            <thead>
              <tr>
                <th>Môn học</th>
                <th>Attendance</th>
                <th>Ngưỡng yêu cầu</th>
                <th>Rủi ro</th>
                <th>Số buổi vắng còn an toàn</th>
              </tr>
            </thead>
            <tbody>
              {riskyCourses.map((item) => (
                <tr key={item.section_id} className="state-warning">
                  <td>
                    <div>{item.course_name}</div>
                    <div className="helper-text">{item.section_code}</div>
                  </td>
                  <td>{item.attendance_percent}% ({item.total_sessions} buổi đã ghi nhận)</td>
                  <td>{REQUIRED_THRESHOLD}%</td>
                  <td><StatusBadge status="warning" /></td>
                  <td>{safeAbsencesRemaining(item)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message={totals.totalSessions ? "Chưa có môn nào dưới ngưỡng cảnh báo." : "Chưa có phiên điểm danh nào được ghi nhận."} />
        )}
      </div>
    </div>
  );
}
