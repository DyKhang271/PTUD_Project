import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { fetchTeacherSections } from "../../services/teacherApi";

export default function TeacherSections() {
  const [state, setState] = useState({ loading: true, error: "", sections: [] });

  async function load() {
    setState({ loading: true, error: "", sections: [] });
    try {
      const sections = await fetchTeacherSections();
      setState({ loading: false, error: "", sections });
    } catch (err) {
      setState({ loading: false, error: err?.response?.data?.detail || "Không tải được danh sách lớp.", sections: [] });
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (state.loading) return <LoadingState label="Đang tải lớp phụ trách..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;
  if (!state.sections.length) return <EmptyState message="Giảng viên chưa có lớp học phần nào." />;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h2 className="page-title">Điểm danh</h2>
          <p className="page-subtitle">Chọn lớp học phần để tạo hoặc tiếp tục phiên điểm danh thủ công.</p>
        </div>
      </div>
      
      <div className="data-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mã môn</th>
              <th>Tên môn</th>
              <th>Lớp HP</th>
              <th>Số sinh viên</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {state.sections.map((section) => (
              <tr key={section.id}>
                <td>{section.course_code}</td>
                <td>
                  <strong>{section.course_name}</strong>
                </td>
                <td>{section.section_code}</td>
                <td>{section.student_count || "--"}</td>
                <td>
                  <div className="table-actions">
                    <Link className="primary-button" to={`/teacher/sections/${section.id}/attendance`}>
                      Điểm danh
                    </Link>
                    <Link className="secondary-button" to={`/teacher/sections/${section.id}/report`}>
                      Báo cáo
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
