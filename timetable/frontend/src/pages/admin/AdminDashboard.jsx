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
        error: err?.response?.data?.detail || "Khong tai duoc dashboard admin.",
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

  if (state.loading) return <LoadingState label="Dang tai dashboard admin..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;
  if (!state.dashboard) return <EmptyState message="Chua co du lieu thong ke." />;

  return (
    <div className="section-stack">
      <div className="page-header">
        <h2 className="page-title">Dashboard quan tri</h2>
        <p className="page-subtitle">Tong quan suc khoe du lieu hoc vu, van hanh scheduling va canh bao diem danh.</p>
      </div>

      <div className="cards-grid">
        <div className="panel metric-card">
          <h3>{activeTerm?.term_code || "--"}</h3>
          <p>Hoc ky hien hanh</p>
        </div>
        <div className="panel metric-card">
          <h3>{state.dashboard.total_sections}</h3>
          <p>Tong lop hoc phan</p>
        </div>
        <div className="panel metric-card">
          <h3>{totalStudents}</h3>
          <p>Tong sinh vien lien ket</p>
        </div>
        <div className="panel metric-card">
          <h3>{totalTeachers}</h3>
          <p>Tong giang vien</p>
        </div>
        <div className="panel metric-card">
          <h3>{state.dashboard.average_attendance_percent}%</h3>
          <p>Ty le diem danh trung binh</p>
        </div>
        <div className="panel metric-card">
          <h3>{pendingSyncWarnings}</h3>
          <p>Canh bao can doi soat</p>
        </div>
      </div>

      <div className="panel section-stack">
        <h3 className="page-title">Quick actions</h3>
        <div className="button-row">
          <Link className="primary-button" to="/admin/academic-data">
            Import du lieu hoc vu
          </Link>
          <Link className="secondary-button" to="/admin/scheduling">
            Quan ly scheduling
          </Link>
          <Link className="secondary-button" to="/admin/attendance">
            Xem canh bao diem danh
          </Link>
        </div>
      </div>
    </div>
  );
}
