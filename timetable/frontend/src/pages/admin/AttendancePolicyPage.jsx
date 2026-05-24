import { useEffect, useState } from "react";
import CustomSelect from "../../components/CustomSelect";

import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import {
  createPolicy,
  deletePolicy,
  fetchAdminDashboard,
  fetchAttendanceBySection,
  fetchPolicies,
  updatePolicy,
} from "../../services/adminApi";

const initialForm = {
  id: "",
  scope_type: "global",
  scope_id: "",
  allow_late_minutes: 15,
  warning_threshold_percent: 80,
  late_count_as_absent_ratio: 0.5,
};

export default function AttendancePolicyPage() {
  const [state, setState] = useState({ loading: true, error: "", items: [], dashboard: null, bySection: [] });
  const [form, setForm] = useState(initialForm);
  const [feedback, setFeedback] = useState("");

  async function load() {
    setState({ loading: true, error: "", items: [], dashboard: null, bySection: [] });
    try {
      const [items, dashboard, bySection] = await Promise.all([
        fetchPolicies(),
        fetchAdminDashboard(),
        fetchAttendanceBySection(),
      ]);
      setState({ loading: false, error: "", items, dashboard, bySection });
    } catch (err) {
      setState({
        loading: false,
        error: err?.response?.data?.detail || "Không tải được dữ liệu chính sách điểm danh.",
        items: [],
        dashboard: null,
        bySection: [],
      });
    }
  }

  useEffect(() => {
    load();
  }, []);

  function beginEdit(policy) {
    setForm({
      id: policy.id,
      scope_type: policy.scope_type,
      scope_id: policy.scope_id || "",
      allow_late_minutes: policy.allow_late_minutes,
      warning_threshold_percent: policy.warning_threshold_percent || 80,
      late_count_as_absent_ratio: policy.late_count_as_absent_ratio || 0.5,
    });
    setFeedback("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback("");
    const payload = {
      scope_type: form.scope_type,
      scope_id: form.scope_id || null,
      allow_late_minutes: Number(form.allow_late_minutes),
      warning_threshold_percent: Number(form.warning_threshold_percent),
      late_count_as_absent_ratio: Number(form.late_count_as_absent_ratio),
    };
    try {
      if (form.id) {
        await updatePolicy(form.id, payload);
        setFeedback("Đã cập nhật chính sách điểm danh.");
      } else {
        await createPolicy(payload);
        setFeedback("Đã tạo chính sách điểm danh.");
      }
      setForm(initialForm);
      await load();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Không thể lưu chính sách điểm danh.");
    }
  }

  async function handleDelete(policyId) {
    setFeedback("");
    try {
      await deletePolicy(policyId);
      if (form.id === policyId) {
        setForm(initialForm);
      }
      await load();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Không thể xóa chính sách điểm danh.");
    }
  }

  if (state.loading) return <LoadingState label="Đang tải chính sách điểm danh..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  return (
    <div className="section-stack">
      <div className="page-header">
        <h2 className="page-title">Quản lý điểm danh</h2>
        <p className="page-subtitle">
          Theo dõi tổng quan điểm danh, cảnh báo lớp có tỷ lệ thấp và cấu hình chính sách theo phạm vi.
        </p>
      </div>

      <div className="cards-grid">
        <div className="panel metric-card">
          <h3>{state.dashboard?.total_sessions ?? 0}</h3>
          <p>Tổng phiên điểm danh</p>
        </div>
        <div className="panel metric-card">
          <h3>{state.dashboard?.average_attendance_percent ?? 0}%</h3>
          <p>Tỷ lệ tham gia trung bình</p>
        </div>
        <div className="panel metric-card">
          <h3>{state.dashboard?.late_count ?? 0}</h3>
          <p>Lượt đi muộn</p>
        </div>
        <div className="panel metric-card">
          <h3>{state.bySection.filter((item) => item.attendance_percent < 80).length}</h3>
          <p>Cảnh báo tỷ lệ thấp</p>
        </div>
      </div>

      <form className="panel inline-form" onSubmit={handleSubmit}>
        <label className="field-group">
          <span>Phạm vi áp dụng (Scope)</span>
          <CustomSelect
            value={form.scope_type}
            onChange={(val) => setForm((prev) => ({ ...prev, scope_type: val }))}
            options={[
              { value: "global", label: "Toàn trường (global)" },
              { value: "faculty", label: "Khoa (faculty)" },
              { value: "course", label: "Môn học (course)" },
              { value: "section", label: "Lớp học phần (section)" },
            ]}
            placeholder="Chọn phạm vi"
          />
        </label>
        <label className="field-group">
          <span>Mã đối tượng (Scope ID)</span>
          <input value={form.scope_id} onChange={(event) => setForm((prev) => ({ ...prev, scope_id: event.target.value }))} placeholder="Ví dụ: công nghệ thông tin hoặc mã môn" />
        </label>
        <label className="field-group">
          <span>Cho phép đi muộn tối đa (phút)</span>
          <input
            type="number"
            value={form.allow_late_minutes}
            onChange={(event) => setForm((prev) => ({ ...prev, allow_late_minutes: event.target.value }))}
          />
        </label>
        <label className="field-group">
          <span>Ngưỡng cảnh báo chuyên cần (%)</span>
          <input
            type="number"
            value={form.warning_threshold_percent}
            onChange={(event) => setForm((prev) => ({ ...prev, warning_threshold_percent: event.target.value }))}
          />
        </label>
        <button className="primary-button" type="submit">
          {form.id ? "Cập nhật chính sách" : "Tạo chính sách"}
        </button>
        {form.id ? (
          <button className="secondary-button" type="button" onClick={() => setForm(initialForm)}>
            Hủy sửa
          </button>
        ) : null}
      </form>

      {feedback ? <div className="state-card">{feedback}</div> : null}

      <div className="two-column-grid">
        <div className="table-card">
          <h3 className="page-title">Danh sách chính sách</h3>
          {state.items.length ? (
            <table>
              <thead>
                <tr>
                  <th>Phạm vi</th>
                  <th>Mã đối tượng</th>
                  <th>Muộn tối đa</th>
                  <th>Ngưỡng cảnh báo</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((item) => {
                  const scopeLabels = {
                    global: "Toàn trường",
                    faculty: "Khoa",
                    course: "Môn học",
                    section: "Lớp học phần",
                  };
                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{scopeLabels[item.scope_type] || item.scope_type}</td>
                      <td>{item.scope_id || "--"}</td>
                      <td>{item.allow_late_minutes} phút</td>
                      <td>{item.warning_threshold_percent}%</td>
                      <td className="table-actions">
                        <button className="secondary-button" type="button" onClick={() => beginEdit(item)}>
                          Sửa
                        </button>
                        <button className="danger-button" type="button" onClick={() => handleDelete(item.id)}>
                          Xóa
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyState message="Chưa có chính sách điểm danh nào." />
          )}
        </div>

        <div className="table-card">
          <h3 className="page-title">Cảnh báo theo lớp học phần</h3>
          {state.bySection.length ? (
            <table>
              <thead>
                <tr>
                  <th>Lớp học phần</th>
                  <th>Tổng phiên</th>
                  <th>Vắng</th>
                  <th>Trễ</th>
                  <th>Tỷ lệ đi học</th>
                </tr>
              </thead>
              <tbody>
                {state.bySection.map((item) => (
                  <tr key={item.group_key}>
                    <td>{item.group_name || item.group_key}</td>
                    <td>{item.total_sessions}</td>
                    <td>{item.absent_count}</td>
                    <td>{item.late_count}</td>
                    <td>{item.attendance_percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState message="Chưa có dữ liệu giám sát điểm danh theo lớp học phần." />
          )}
        </div>
      </div>
    </div>
  );
}
