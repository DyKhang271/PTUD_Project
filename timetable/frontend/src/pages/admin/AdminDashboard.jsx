import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import {
  fetchAcademicImportBatches,
  fetchAdminDashboard,
  fetchCourseSections,
  fetchTerms,
} from "../../services/adminApi";

export default function AdminDashboard() {
  const [state, setState] = useState({
    loading: true,
    error: "",
    dashboard: null,
    terms: [],
    sections: [],
    batches: [],
  });

  async function load() {
    setState({ loading: true, error: "", dashboard: null, terms: [], sections: [], batches: [] });
    try {
      const [dashboard, terms, sections, batches] = await Promise.all([
        fetchAdminDashboard(),
        fetchTerms(),
        fetchCourseSections(),
        fetchAcademicImportBatches(),
      ]);
      setState({ loading: false, error: "", dashboard, terms, sections, batches });
    } catch (err) {
      setState({
        loading: false,
        error: err?.response?.data?.detail || "Không tải được bảng điều khiển quản trị.",
        dashboard: null,
        terms: [],
        sections: [],
        batches: [],
      });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const activeTerm = useMemo(() => state.terms.find((item) => item.status === "active") || null, [state.terms]);
  const totalStudents = useMemo(
    () => state.sections.reduce((sum, section) => sum + Number(section.student_count || 0), 0),
    [state.sections],
  );
  const totalTeachers = useMemo(() => {
    const teachers = new Set();
    state.sections.forEach((section) => {
      if (section.teacher_external_id) {
        teachers.add(section.teacher_external_id);
      }
    });
    return teachers.size;
  }, [state.sections]);
  const pendingSyncWarnings = useMemo(
    () => state.batches.filter((item) => item.status !== "success" || (item.warnings || []).length > 0).length,
    [state.batches],
  );

  if (state.loading) return <LoadingState label="Đang tải bảng điều khiển quản trị..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;
  if (!state.dashboard) return <EmptyState message="Chưa có dữ liệu thống kê." />;

  return (
    <div className="section-stack">
      <div className="page-header">
        <h2 className="page-title">Bảng điều khiển quản trị</h2>
        <p className="page-subtitle">Tổng quan sức khỏe dữ liệu học vụ, vận hành xếp lịch và cảnh báo điểm danh.</p>
      </div>

      <div className="cards-grid">
        <div className="panel metric-card">
          <h3>{activeTerm?.term_code || "--"}</h3>
          <p>Học kỳ hiện hành</p>
        </div>
        <div className="panel metric-card">
          <h3>{state.dashboard.total_sections}</h3>
          <p>Tổng lớp học phần</p>
        </div>
        <div className="panel metric-card">
          <h3>{totalStudents}</h3>
          <p>Tổng sinh viên liên kết</p>
        </div>
        <div className="panel metric-card">
          <h3>{totalTeachers}</h3>
          <p>Tổng giảng viên</p>
        </div>
        <div className="panel metric-card">
          <h3>{state.dashboard.average_attendance_percent}%</h3>
          <p>Tỷ lệ điểm danh trung bình</p>
        </div>
        <div className="panel metric-card">
          <h3>{pendingSyncWarnings}</h3>
          <p>Cảnh báo cần đối soát</p>
        </div>
      </div>

      <div className="panel section-stack">
        <h3 className="page-title">Thao tác nhanh (Quick actions)</h3>
        <div className="button-row">
          <Link className="primary-button" to="/admin/academic-data">
            Nhập dữ liệu học vụ
          </Link>
          <Link className="secondary-button" to="/admin/scheduling">
            Quản lý lịch học & thi
          </Link>
          <Link className="secondary-button" to="/admin/attendance">
            Xem cảnh báo điểm danh
          </Link>
        </div>
      </div>
    </div>
  );
}
