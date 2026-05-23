import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { fetchAdminDashboard } from "../../services/adminApi";

export default function AdminDashboard() {
  const [state, setState] = useState({ loading: true, error: "", data: null });

  async function load() {
    setState({ loading: true, error: "", data: null });
    try {
      const data = await fetchAdminDashboard();
      setState({ loading: false, error: "", data });
    } catch (err) {
      setState({ loading: false, error: err?.response?.data?.detail || "Không tải được dashboard admin.", data: null });
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (state.loading) return <LoadingState label="Đang tải dashboard admin..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;
  if (!state.data) return <EmptyState message="Chưa có dữ liệu thống kê." />;

  return (
    <div className="section-stack">
      <div className="page-header">
        <h2 className="page-title">Dashboard quản trị</h2>
      </div>
      <div className="cards-grid">
        <div className="panel metric-card">
          <h3>{state.data.total_sections}</h3>
          <p>Tổng lớp học phần</p>
        </div>
        <div className="panel metric-card">
          <h3>{state.data.total_sessions}</h3>
          <p>Tổng phiên điểm danh</p>
        </div>
        <div className="panel metric-card">
          <h3>{state.data.average_attendance_percent}%</h3>
          <p>Tỷ lệ tham gia trung bình</p>
        </div>
      </div>
    </div>
  );
}
