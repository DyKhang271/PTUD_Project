import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import StatusBadge from "../../components/StatusBadge";
import { fetchAttendanceReport, fetchAttendanceSummary } from "../../services/teacherApi";

export default function AttendanceReportPage() {
  const { sectionId } = useParams();
  const [state, setState] = useState({ loading: true, error: "", summary: [], report: null });
  const [filters, setFilters] = useState({ term: "", student: "", status: "all" });

  async function load() {
    setState({ loading: true, error: "", summary: [], report: null });
    try {
      const [summary, report] = await Promise.all([fetchAttendanceSummary(sectionId), fetchAttendanceReport(sectionId)]);
      setState({ loading: false, error: "", summary, report });
    } catch (err) {
      setState({ loading: false, error: err?.response?.data?.detail || "Không tải được báo cáo.", summary: [], report: null });
    }
  }

  useEffect(() => {
    load();
  }, [sectionId]);

  const filteredSummary = useMemo(() => {
    return state.summary.filter((item) => {
      const studentText = `${item.student_external_id || ""} ${item.full_name || ""}`.toLowerCase();
      const matchesStudent = !filters.student || studentText.includes(filters.student.toLowerCase());
      const matchesStatus = filters.status === "all" || item.warning_status === filters.status;
      return matchesStudent && matchesStatus;
    });
  }, [state.summary, filters]);

  if (state.loading) return <LoadingState label="Đang tải báo cáo điểm danh..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;
  if (!state.report) return <EmptyState message="Chưa có báo cáo." />;

  return (
    <div className="section-stack">
      <div className="page-header">
        <h2 className="page-title">Báo cáo điểm danh</h2>
        <p className="page-subtitle">{state.report.section.course_name} - {state.report.section.section_code}</p>
      </div>

      <div className="panel plan-filter-grid">
        <label className="field-group">
          <span>Học kỳ</span>
          <input value={filters.term} onChange={(event) => setFilters((prev) => ({ ...prev, term: event.target.value }))} placeholder="Nhập học kỳ" />
        </label>
        <label className="field-group">
          <span>Lớp học phần</span>
          <input value={state.report.section.section_code} disabled />
        </label>
        <label className="field-group">
          <span>Sinh viên</span>
          <input value={filters.student} onChange={(event) => setFilters((prev) => ({ ...prev, student: event.target.value }))} placeholder="Mã hoặc tên sinh viên" />
        </label>
        <label className="field-group">
          <span>Trạng thái cảnh báo</span>
          <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
            <option value="all">Tất cả</option>
            <option value="warning">Cảnh báo</option>
            <option value="ok">Ổn định</option>
          </select>
        </label>
      </div>

      <div className="table-card">
        <h3>Tổng hợp theo sinh viên</h3>
        {filteredSummary.length ? (
          <table>
            <thead>
              <tr>
                <th>Sinh viên</th>
                <th>Có mặt</th>
                <th>Đi muộn</th>
                <th>Vắng</th>
                <th>Có phép</th>
                <th>Attendance %</th>
                <th>Cảnh báo</th>
              </tr>
            </thead>
            <tbody>
              {filteredSummary.map((item) => (
                <tr key={item.student_external_id} className={item.warning_status === "warning" ? "state-warning" : ""}>
                  <td>
                    <div>{item.full_name || item.student_external_id}</div>
                    <div className="helper-text">{item.student_external_id}</div>
                  </td>
                  <td>{item.present_count}</td>
                  <td>{item.late_count}</td>
                  <td>{item.absent_count}</td>
                  <td>{item.excused_count}</td>
                  <td>{item.attendance_percent}%</td>
                  <td><StatusBadge status={item.warning_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Không có dữ liệu phù hợp bộ lọc." />
        )}
      </div>
    </div>
  );
}
