import { useEffect, useState } from "react";
import { createTerm, fetchTerms } from "../../services/adminApi";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";

export default function TermManagement() {
  const [state, setState] = useState({ loading: true, error: "", items: [] });
  const [form, setForm] = useState({ term_code: "", term_name: "", status: "active" });

  async function load() {
    setState({ loading: true, error: "", items: [] });
    try {
      const items = await fetchTerms();
      setState({ loading: false, error: "", items });
    } catch (err) {
      setState({ loading: false, error: err?.response?.data?.detail || "Không tải được học kỳ.", items: [] });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    await createTerm(form);
    setForm({ term_code: "", term_name: "", status: "active" });
    await load();
  }

  if (state.loading) return <LoadingState label="Đang tải học kỳ..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  return (
    <div className="section-stack">
      <form className="panel inline-form" onSubmit={handleSubmit}>
        <label className="field-group">
          <span>Mã học kỳ</span>
          <input value={form.term_code} onChange={(event) => setForm((prev) => ({ ...prev, term_code: event.target.value }))} />
        </label>
        <label className="field-group">
          <span>Tên học kỳ</span>
          <input value={form.term_name} onChange={(event) => setForm((prev) => ({ ...prev, term_name: event.target.value }))} />
        </label>
        <label className="field-group">
          <span>Trạng thái</span>
          <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </label>
        <button className="primary-button" type="submit">
          Tạo học kỳ
        </button>
      </form>

      <div className="table-card">
        <h2 className="page-title">Danh sách học kỳ</h2>
        {state.items.length ? (
          <table>
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.term_code}</td>
                  <td>{item.term_name}</td>
                  <td>{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Chưa có học kỳ nào." />
        )}
      </div>
    </div>
  );
}
