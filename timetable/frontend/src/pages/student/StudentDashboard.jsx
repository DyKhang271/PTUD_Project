import { useEffect, useState } from "react";
import { fetchStudentAttendanceSummary, fetchStudentExams, fetchStudentTimetable } from "../../services/studentApi";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";

export default function StudentDashboard() {
  const [state, setState] = useState({ loading: true, error: "", timetable: [], exams: [], summary: [] });

  async function load() {
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const [timetable, exams, summary] = await Promise.all([
        fetchStudentTimetable(),
        fetchStudentExams(),
        fetchStudentAttendanceSummary(),
      ]);
      setState({ loading: false, error: "", timetable, exams, summary });
    } catch (err) {
      setState({ loading: false, error: err?.response?.data?.detail || "Không tải được dashboard.", timetable: [], exams: [], summary: [] });
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (state.loading) return <LoadingState label="Đang tải dashboard sinh viên..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  const warningSubjects = state.summary.filter((item) => item.warning_status === "warning");

  return (
    <div className="section-stack">
      <div className="page-header">
        <h2 className="page-title">Dashboard sinh viên</h2>
        <p className="page-subtitle">Tổng quan lịch học, lịch thi và cảnh báo điểm danh.</p>
      </div>
      <div className="cards-grid">
        <div className="panel metric-card">
          <h3>{state.timetable.length}</h3>
          <p>Buổi học trong dữ liệu hiện tại</p>
        </div>
        <div className="panel metric-card">
          <h3>{state.exams.length}</h3>
          <p>Lịch thi đã được cấu hình</p>
        </div>
        <div className="panel metric-card">
          <h3>{warningSubjects.length}</h3>
          <p>Môn đang dưới ngưỡng cảnh báo</p>
        </div>
      </div>
      <div className="panel">
        <h3>Cảnh báo điểm danh</h3>
        {warningSubjects.length ? (
          <ul>
            {warningSubjects.map((item) => (
              <li key={item.section_id}>
                {item.course_name} ({item.section_code}) - {item.attendance_percent}%
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="Chưa có môn nào rơi vào trạng thái cảnh báo." />
        )}
      </div>
    </div>
  );
}
