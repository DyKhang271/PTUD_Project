import { useEffect, useState } from "react";
import { createPolicy, fetchPolicies } from "../../services/adminApi";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";

export default function AttendancePolicyPage() {
  const [state, setState] = useState({ loading: true, error: "", items: [] });
  const [form, setForm] = useState({
    scope_type: "global",
    scope_id: "",
    allow_late_minutes: 15,
    warning_threshold_percent: 80,
    late_count_as_absent_ratio: 0.5,
  });

  async function load() {
    setState({ loading: true, error: "", items: [] });
    try {
      const items = await fetchPolicies();
      setState({ loading: false, error: "", items });
    } catch (err) {
      setState({ loading: false, error: err?.response?.data?.detail || "Không tải được policy.", items: [] });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    await createPolicy({
      ...form,
      scope_id: form.scope_id || null,
      allow_late_minutes: Number(form.allow_late_minutes),
      warning_threshold_percent: Number(form.warning_threshold_percent),
      late_count_as_absent_ratio: Number(form.late_count_as_absent_ratio),
    });
    await load();
  }

  if (state.loading) return <LoadingState label="Đang tải policy điểm danh..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  return (
    <div className="section-stack">
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
          <input type="number" value={form.allow_late_minutes} onChange={(event) => setForm((prev) => ({ ...prev, allow_late_minutes: event.target.value }))} />
        </label>
        <label className="field-group">
          <span>Warning %</span>
          <input type="number" value={form.warning_threshold_percent} onChange={(event) => setForm((prev) => ({ ...prev, warning_threshold_percent: event.target.value }))} />
        </label>
        <button className="primary-button" type="submit">
          Tạo policy
        </button>
      </form>

      <div className="table-card">
        <h2 className="page-title">Danh sách policy</h2>
        {state.items.length ? (
          <table>
            <thead>
              <tr>
                <th>Scope</th>
                <th>Scope ID</th>
                <th>Muộn tối đa</th>
                <th>Ngưỡng cảnh báo</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.scope_type}</td>
                  <td>{item.scope_id || "--"}</td>
                  <td>{item.allow_late_minutes}</td>
                  <td>{item.warning_threshold_percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Chưa có policy điểm danh." />
        )}
      </div>
    </div>
  );
}
