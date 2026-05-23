import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import StatusBadge from "../../components/StatusBadge";
import { fetchAttendanceReport, fetchAttendanceSummary } from "../../services/teacherApi";

export default function AttendanceReportPage() {
  const { sectionId } = useParams();
  const [state, setState] = useState({ loading: true, error: "", summary: [], report: null });

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

  if (state.loading) return <LoadingState label="Đang tải báo cáo điểm danh..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;
  if (!state.report) return <EmptyState message="Chưa có báo cáo." />;

  return (
    <div className="section-stack">
      <div className="page-header">
        <h2 className="page-title">Báo cáo điểm danh</h2>
        <p className="page-subtitle">{state.report.section.course_name} - {state.report.section.section_code}</p>
      </div>
      <div className="table-card">
        <h3>Tổng hợp theo sinh viên</h3>
        {state.summary.length ? (
          <table>
            <thead>
              <tr>
                <th>Sinh viên</th>
                <th>Có mặt</th>
                <th>Muộn</th>
                <th>Vắng</th>
                <th>Có phép</th>
                <th>% tham gia</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {state.summary.map((item) => (
                <tr key={item.student_external_id}>
                  <td>{item.full_name || item.student_external_id}</td>
                  <td>{item.present_count}</td>
                  <td>{item.late_count}</td>
                  <td>{item.absent_count}</td>
                  <td>{item.excused_count}</td>
                  <td>{item.attendance_percent}%</td>
                  <td>
                    <StatusBadge status={item.warning_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Chưa có dữ liệu tổng hợp." />
        )}
      </div>

      <div className="table-card">
        <h3>Record chi tiết</h3>
        {state.report.records.length ? (
          <table>
            <thead>
              <tr>
                <th>Sinh viên</th>
                <th>Phiên</th>
                <th>Trạng thái</th>
                <th>Check-in</th>
                <th>Method</th>
              </tr>
            </thead>
            <tbody>
              {state.report.records.map((record) => (
                <tr key={record.id}>
                  <td>{record.full_name || record.student_external_id}</td>
                  <td>{record.session_id}</td>
                  <td>
                    <StatusBadge status={record.status} />
                  </td>
                  <td>{record.checkin_time || "--"}</td>
                  <td>{record.method || "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Chưa có record điểm danh." />
        )}
      </div>
    </div>
  );
}
