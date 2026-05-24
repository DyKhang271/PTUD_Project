import { useEffect, useState } from "react";

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
        error: err?.response?.data?.detail || "Khong tai duoc module diem danh.",
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
        setFeedback("Da cap nhat policy diem danh.");
      } else {
        await createPolicy(payload);
        setFeedback("Da tao policy diem danh.");
      }
      setForm(initialForm);
      await load();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Khong the luu policy diem danh.");
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
      setFeedback(err?.response?.data?.detail || "Khong the xoa policy diem danh.");
    }
  }

  if (state.loading) return <LoadingState label="Dang tai module diem danh..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  return (
    <div className="section-stack">
      <div className="page-header">
        <h2 className="page-title">Quan ly diem danh</h2>
        <p className="page-subtitle">
          Theo doi tong quan diem danh, canh bao lop co ty le thap va cau hinh policy theo pham vi.
        </p>
      </div>

      <div className="cards-grid">
        <div className="panel metric-card">
          <h3>{state.dashboard?.total_sessions ?? 0}</h3>
          <p>Tong phien diem danh</p>
        </div>
        <div className="panel metric-card">
          <h3>{state.dashboard?.average_attendance_percent ?? 0}%</h3>
          <p>Ty le tham gia trung binh</p>
        </div>
        <div className="panel metric-card">
          <h3>{state.dashboard?.late_count ?? 0}</h3>
          <p>Luot di muon</p>
        </div>
        <div className="panel metric-card">
          <h3>{state.bySection.filter((item) => item.attendance_percent < 80).length}</h3>
          <p>Canh bao ty le thap</p>
        </div>
      </div>

      <form className="panel inline-form" onSubmit={handleSubmit}>
        <label className="field-group">
          <span>Scope type</span>
          <select value={form.scope_type} onChange={(event) => setForm((prev) => ({ ...prev, scope_type: event.target.value }))}>
            <option value="global">global</option>
            <option value="faculty">faculty</option>
            <option value="course">course</option>
            <option value="section">section</option>
          </select>
        </label>
        <label className="field-group">
          <span>Scope id</span>
          <input value={form.scope_id} onChange={(event) => setForm((prev) => ({ ...prev, scope_id: event.target.value }))} />
        </label>
        <label className="field-group">
          <span>Allow late</span>
          <input
            type="number"
            value={form.allow_late_minutes}
            onChange={(event) => setForm((prev) => ({ ...prev, allow_late_minutes: event.target.value }))}
          />
        </label>
        <label className="field-group">
          <span>Warning %</span>
          <input
            type="number"
            value={form.warning_threshold_percent}
            onChange={(event) => setForm((prev) => ({ ...prev, warning_threshold_percent: event.target.value }))}
          />
        </label>
        <button className="primary-button" type="submit">
          {form.id ? "Cap nhat policy" : "Tao policy"}
        </button>
        {form.id ? (
          <button className="secondary-button" type="button" onClick={() => setForm(initialForm)}>
            Huy sua
          </button>
        ) : null}
      </form>

      {feedback ? <div className="state-card">{feedback}</div> : null}

      <div className="two-column-grid">
        <div className="table-card">
          <h3 className="page-title">Danh sach policy</h3>
          {state.items.length ? (
            <table>
              <thead>
                <tr>
                  <th>Scope</th>
                  <th>Scope ID</th>
                  <th>Muon toi da</th>
                  <th>Nguong canh bao</th>
                  <th>Thao tac</th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.scope_type}</td>
                    <td>{item.scope_id || "--"}</td>
                    <td>{item.allow_late_minutes}</td>
                    <td>{item.warning_threshold_percent}%</td>
                    <td className="table-actions">
                      <button className="secondary-button" type="button" onClick={() => beginEdit(item)}>
                        Sua
                      </button>
                      <button className="danger-button" type="button" onClick={() => handleDelete(item.id)}>
                        Xoa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState message="Chua co policy diem danh." />
          )}
        </div>

        <div className="table-card">
          <h3 className="page-title">Canh bao theo lop hoc phan</h3>
          {state.bySection.length ? (
            <table>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Tong phien</th>
                  <th>Absent</th>
                  <th>Late</th>
                  <th>Ty le tham gia</th>
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
            <EmptyState message="Chua co du lieu giam sat diem danh theo lop." />
          )}
        </div>
      </div>
    </div>
  );
}
