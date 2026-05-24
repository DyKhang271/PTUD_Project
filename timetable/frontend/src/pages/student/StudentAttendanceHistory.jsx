import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import StatusBadge from "../../components/StatusBadge";
import { fetchStudentAttendanceHistory } from "../../services/studentApi";

const statuses = [
  { value: "all", label: "Tất cả" },
  { value: "present", label: "Có mặt" },
  { value: "late", label: "Đi muộn" },
  { value: "absent", label: "Vắng" },
  { value: "excused", label: "Có phép" },
  { value: "unknown", label: "Chưa ghi nhận" },
];

function dateText(item) {
  if (item.datetime) return new Date(item.datetime).toLocaleString("vi-VN");
  return `${item.session_date || "--"} ${item.start_time || ""}`.trim();
}

export default function StudentAttendanceHistory() {
  const [state, setState] = useState({ loading: true, error: "", items: [] });
  const [filters, setFilters] = useState({ term: "all", course: "all", status: "all" });
  const [selected, setSelected] = useState(null);

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

  const terms = useMemo(() => [...new Set(state.items.map((item) => item.term).filter(Boolean))], [state.items]);
  const courses = useMemo(() => [...new Set(state.items.map((item) => item.course_name).filter(Boolean))], [state.items]);
  const filteredItems = useMemo(() => {
    return state.items.filter((item) => {
      const matchesTerm = filters.term === "all" || item.term === filters.term;
      const matchesCourse = filters.course === "all" || item.course_name === filters.course;
      const matchesStatus = filters.status === "all" || item.status === filters.status;
      return matchesTerm && matchesCourse && matchesStatus;
    });
  }, [state.items, filters]);

  const totals = useMemo(() => {
    const total = filteredItems.length;
    const count = (status) => filteredItems.filter((item) => item.status === status).length;
    const present = count("present");
    const late = count("late");
    const absent = count("absent");
    const excused = count("excused");
    const rate = total ? Math.round(((present + late + excused) / total) * 100) : 100;
    return { total, present, late, absent, excused, rate };
  }, [filteredItems]);

  if (state.loading) return <LoadingState label="Đang tải lịch sử điểm danh..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  return (
    <div className="section-stack">
      <div className="page-header">
        <h2 className="page-title">Lịch sử điểm danh</h2>
        <p className="page-subtitle">Xem tiến độ chuyên cần theo môn học và từng buổi đã được giảng viên ghi nhận.</p>
      </div>

      <div className="cards-grid">
        <div className="panel metric-card"><h3>{totals.total}</h3><p>Total sessions</p></div>
        <div className="panel metric-card"><h3>{totals.present}</h3><p>Present</p></div>
        <div className="panel metric-card"><h3>{totals.late}</h3><p>Late</p></div>
        <div className="panel metric-card"><h3>{totals.absent}</h3><p>Absent</p></div>
        <div className="panel metric-card"><h3>{totals.excused}</h3><p>Excused</p></div>
        <div className="panel metric-card"><h3>{totals.rate}%</h3><p>Attendance rate</p></div>
      </div>

      <div className="panel plan-filter-grid">
        <label className="field-group">
          <span>Học kỳ</span>
          <select value={filters.term} onChange={(event) => setFilters((prev) => ({ ...prev, term: event.target.value }))}>
            <option value="all">Tất cả</option>
            {terms.map((term) => <option key={term} value={term}>{term}</option>)}
          </select>
        </label>
        <label className="field-group">
          <span>Môn học</span>
          <select value={filters.course} onChange={(event) => setFilters((prev) => ({ ...prev, course: event.target.value }))}>
            <option value="all">Tất cả</option>
            {courses.map((course) => <option key={course} value={course}>{course}</option>)}
          </select>
        </label>
        <label className="field-group">
          <span>Trạng thái</span>
          <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
            {statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
        </label>
      </div>

      <div className="table-card">
        {filteredItems.length ? (
          <table className="interactive-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Course</th>
                <th>Teacher</th>
                <th>Status</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.session_id} onClick={() => setSelected(item)}>
                  <td>{dateText(item)}</td>
                  <td>
                    <div>{item.course_name}</div>
                    <div className="helper-text">{item.section_code}</div>
                  </td>
                  <td>{item.teacher_name || "--"}</td>
                  <td><StatusBadge status={item.status || "unknown"} /></td>
                  <td>{item.note || "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message={state.items.length ? "Không có dữ liệu phù hợp bộ lọc." : "Chưa có lịch sử điểm danh."} />
        )}
      </div>

      <details className="panel">
        <summary>Tự check-in (nâng cao)</summary>
        <p className="helper-text">Tính năng tự check-in được ẩn vì quy trình chính là giảng viên điểm danh thủ công.</p>
      </details>

      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="page-header">
              <h3>Chi tiết điểm danh</h3>
              <button className="secondary-button" onClick={() => setSelected(null)} type="button">Đóng</button>
            </div>
            <div className="plan-context-grid">
              <div><strong>Course</strong><div>{selected.course_name}</div></div>
              <div><strong>Section</strong><div>{selected.section_code}</div></div>
              <div><strong>Teacher</strong><div>{selected.teacher_name || "--"}</div></div>
              <div><strong>Datetime</strong><div>{dateText(selected)}</div></div>
              <div><strong>Status</strong><div><StatusBadge status={selected.status || "unknown"} /></div></div>
              <div><strong>Teacher note</strong><div>{selected.note || "--"}</div></div>
              <div><strong>Updated at</strong><div>{selected.updated_at ? new Date(selected.updated_at).toLocaleString("vi-VN") : "--"}</div></div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
