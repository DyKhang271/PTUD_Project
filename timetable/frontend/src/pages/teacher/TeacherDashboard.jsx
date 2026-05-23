import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { fetchTeacherSections } from "../../services/teacherApi";

export default function TeacherDashboard() {
  const [state, setState] = useState({ loading: true, error: "", sections: [] });

  async function load() {
    setState({ loading: true, error: "", sections: [] });
    try {
      const sections = await fetchTeacherSections();
      setState({ loading: false, error: "", sections });
    } catch (err) {
      setState({ loading: false, error: err?.response?.data?.detail || "Không tải được dữ liệu giảng viên.", sections: [] });
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (state.loading) return <LoadingState label="Đang tải dashboard giảng viên..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  return (
    <div className="section-stack">
      <div className="page-header">
        <h2 className="page-title">Dashboard giảng viên</h2>
        <p className="page-subtitle">Ưu tiên thao tác nhanh vào từng lớp học phần để mở phiên điểm danh.</p>
      </div>
      <div className="cards-grid">
        <div className="panel metric-card">
          <h3>{state.sections.length}</h3>
          <p>Lớp học phần đang phụ trách</p>
        </div>
      </div>
      <div className="panel">
        <h3>Truy cập nhanh</h3>
        {state.sections.length ? (
          <div className="button-row">
            {state.sections.map((section) => (
              <Link key={section.id} className="secondary-button" to={`/teacher/sections/${section.id}/attendance`}>
                {section.section_code}
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState message="Bạn chưa được gán lớp học phần nào." />
        )}
      </div>
    </div>
  );
}
