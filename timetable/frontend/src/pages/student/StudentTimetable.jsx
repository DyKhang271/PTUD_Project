import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { fetchStudentTimetable } from "../../services/studentApi";

export default function StudentTimetable() {
  const [state, setState] = useState({ loading: true, error: "", items: [] });

  async function load() {
    setState({ loading: true, error: "", items: [] });
    try {
      const items = await fetchStudentTimetable();
      setState({ loading: false, error: "", items });
    } catch (err) {
      setState({ loading: false, error: err?.response?.data?.detail || "Không tải được thời khóa biểu.", items: [] });
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (state.loading) return <LoadingState label="Đang tải thời khóa biểu..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;
  if (!state.items.length) return <EmptyState message="Chưa có dữ liệu thời khóa biểu." />;

  return (
    <div className="table-card">
      <div className="page-header">
        <h2 className="page-title">Thời khóa biểu</h2>
        <p className="page-subtitle">Danh sách các buổi học lấy trực tiếp từ timetable backend.</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Môn học</th>
            <th>Lớp HP</th>
            <th>Thứ</th>
            <th>Giờ</th>
            <th>Phòng</th>
            <th>Giảng viên</th>
          </tr>
        </thead>
        <tbody>
          {state.items.map((item) => (
            <tr key={item.timetable_entry_id}>
              <td>{item.course_name}</td>
              <td>{item.section_code}</td>
              <td>{item.day_of_week}</td>
              <td>
                {item.start_time || "--"} - {item.end_time || "--"}
              </td>
              <td>{item.room || item.location || "--"}</td>
              <td>{item.teacher_name || item.teacher_external_id || "--"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
