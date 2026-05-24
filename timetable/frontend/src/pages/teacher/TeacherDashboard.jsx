import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import StatusBadge from "../../components/StatusBadge";
import { fetchAttendanceSummary, fetchTeacherSectionAttendanceSessions, fetchTeacherSections, fetchTeacherTodayClasses } from "../../services/teacherApi";

export default function TeacherDashboard() {
  const [state, setState] = useState({ loading: true, error: "", sections: [], today: [], sessions: [], summaries: [] });

  async function load() {
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const sections = await fetchTeacherSections();
      const [today, sessionGroups, summaryGroups] = await Promise.all([
        fetchTeacherTodayClasses().catch(() => []),
        Promise.all(sections.map((section) => fetchTeacherSectionAttendanceSessions(section.id).catch(() => []))),
        Promise.all(sections.map((section) => fetchAttendanceSummary(section.id).catch(() => []))),
      ]);
      setState({
        loading: false,
        error: "",
        sections,
        today,
        sessions: sessionGroups.flat(),
        summaries: summaryGroups.flat(),
      });
    } catch (err) {
      setState({ loading: false, error: err?.response?.data?.detail || "Không tải được dashboard giảng viên.", sections: [], today: [], sessions: [], summaries: [] });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const pendingSessions = useMemo(() => state.sessions.filter((session) => session.status !== "closed"), [state.sessions]);
  const lowAttendance = useMemo(() => state.summaries.filter((item) => item.warning_status === "warning" && item.total_sessions > 0), [state.summaries]);

  if (state.loading) return <LoadingState label="Đang tải dashboard giảng viên..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  return (
    <div className="section-stack">
      <div className="page-header">
        <h2 className="page-title">Dashboard giảng viên</h2>
        <p className="page-subtitle">Tổng quan nhanh để tiếp tục điểm danh thủ công và xử lý các lớp còn mở.</p>
      </div>

      <div className="cards-grid">
        <div className="panel metric-card">
          <h3>{state.sections.length}</h3>
          <p>Lớp phụ trách</p>
        </div>
        <div className="panel metric-card">
          <h3>{state.today.length}</h3>
          <p>Buổi học hôm nay</p>
        </div>
        <div className="panel metric-card">
          <h3>{pendingSessions.length}</h3>
          <p>Phiên chưa đóng</p>
        </div>
        <div className="panel metric-card">
          <h3>{lowAttendance.length}</h3>
          <p>Cảnh báo chuyên cần</p>
        </div>
      </div>

      <div className="panel section-stack">
        <h3>Thao tác nhanh</h3>
        {state.sections.length ? (
          <div className="button-row">
            {state.sections.slice(0, 6).map((section) => (
              <Link key={section.id} className="secondary-button" to={`/teacher/sections/${section.id}/attendance`}>
                Điểm danh {section.section_code} - {section.course_name}
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState message="Bạn chưa được gán lớp học phần nào." />
        )}
      </div>

      <div className="two-column-grid">
        <div className="table-card">
          <h3>Phiên cần tiếp tục</h3>
          {pendingSessions.length ? (
            <table>
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Giờ</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {pendingSessions.slice(0, 8).map((session) => (
                  <tr key={session.id}>
                    <td>{session.session_date}</td>
                    <td>{session.start_time || "--"} - {session.end_time || "--"}</td>
                    <td><StatusBadge status={session.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState message="Không có phiên điểm danh đang chờ xử lý." />
          )}
        </div>

        <div className="table-card">
          <h3>Cảnh báo chuyên cần</h3>
          {lowAttendance.length ? (
            <table>
              <thead>
                <tr>
                  <th>Sinh viên</th>
                  <th>Môn học</th>
                  <th>Tỷ lệ</th>
                </tr>
              </thead>
              <tbody>
                {lowAttendance.slice(0, 8).map((item) => (
                  <tr key={`${item.section_id}-${item.student_external_id}`}>
                    <td>{item.full_name || item.student_external_id}</td>
                    <td>{item.course_name}</td>
                    <td><StatusBadge status="warning" /> {item.attendance_percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState message="Chưa có cảnh báo chuyên cần." />
          )}
        </div>
      </div>
    </div>
  );
}
