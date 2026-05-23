import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import StatusBadge from "../../components/StatusBadge";
import { fetchStudentAttendanceHistory } from "../../services/studentApi";

export default function StudentAttendanceHistory() {
  const [state, setState] = useState({ loading: true, error: "", items: [] });

  async function load() {
    setState({ loading: true, error: "", items: [] });
    try {
      const items = await fetchStudentAttendanceHistory();
      setState({ loading: false, error: "", items });
    } catch (err) {
      setState({ loading: false, error: err?.response?.data?.detail || "Không tải được lịch sử điểm danh.", items: [] });
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (state.loading) return <LoadingState label="Đang tải lịch sử điểm danh..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;
  if (!state.items.length) return <EmptyState message="Chưa có lịch sử điểm danh." />;

  return (
    <div className="table-card">
      <div className="page-header">
        <h2 className="page-title">Lịch sử điểm danh</h2>
        <p className="page-subtitle">Nút check-in có thể bổ sung ở bước sau, hiện tại trang này tập trung vào lịch sử và trạng thái.</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Môn học</th>
            <th>Lớp HP</th>
            <th>Ngày</th>
            <th>Giờ</th>
            <th>Trạng thái</th>
            <th>Phương thức</th>
          </tr>
        </thead>
        <tbody>
          {state.items.map((item) => (
            <tr key={item.session_id}>
              <td>{item.course_name}</td>
              <td>{item.section_code}</td>
              <td>{item.session_date}</td>
              <td>
                {item.start_time || "--"} - {item.end_time || "--"}
              </td>
              <td>
                <StatusBadge status={item.status} />
              </td>
              <td>{item.method || "--"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
