import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { fetchStudentExams } from "../../services/studentApi";

export default function StudentExams() {
  const [state, setState] = useState({ loading: true, error: "", items: [] });

  async function load() {
    setState({ loading: true, error: "", items: [] });
    try {
      const items = await fetchStudentExams();
      setState({ loading: false, error: "", items });
    } catch (err) {
      setState({ loading: false, error: err?.response?.data?.detail || "Không tải được lịch thi.", items: [] });
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (state.loading) return <LoadingState label="Đang tải lịch thi..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;
  if (!state.items.length) return <EmptyState message="Chưa có lịch thi nào." />;

  return (
    <div className="table-card">
      <div className="page-header">
        <h2 className="page-title">Lịch thi</h2>
      </div>
      <table>
        <thead>
          <tr>
            <th>Section ID</th>
            <th>Ngày thi</th>
            <th>Giờ</th>
            <th>Phòng</th>
            <th>Loại thi</th>
          </tr>
        </thead>
        <tbody>
          {state.items.map((item) => (
            <tr key={item.id}>
              <td>{item.section_id}</td>
              <td>{item.exam_date}</td>
              <td>
                {item.start_time || "--"} - {item.end_time || "--"}
              </td>
              <td>{item.room || item.location || "--"}</td>
              <td>{item.exam_type || "--"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
