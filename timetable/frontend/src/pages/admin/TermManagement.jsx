import { useEffect, useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { createTerm, fetchTerms, updateTerm } from "../../services/adminApi";

const initialForm = {
  id: "",
  term_code: "",
  term_name: "",
  status: "inactive",
};

export default function TermManagement() {
  const [state, setState] = useState({ loading: true, error: "", items: [] });
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function load() {
    setState({ loading: true, error: "", items: [] });
    try {
      const items = await fetchTerms();
      setState({ loading: false, error: "", items });
    } catch (err) {
      setState({ loading: false, error: err?.response?.data?.detail || "Khong tai duoc hoc ky.", items: [] });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const activeTerm = useMemo(() => state.items.find((item) => item.status === "active") || null, [state.items]);

  function beginEdit(term) {
    setForm({
      id: term.id,
      term_code: term.term_code,
      term_name: term.term_name,
      status: term.status,
    });
    setFeedback("");
  }

  function resetForm() {
    setForm(initialForm);
  }

  function isDuplicateCode(nextCode, currentId) {
    const normalized = nextCode.trim().toLowerCase();
    return state.items.some((item) => item.id !== currentId && item.term_code.trim().toLowerCase() === normalized);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isDuplicateCode(form.term_code, form.id)) {
      setFeedback("Ma hoc ky da ton tai. Vui long dung ma khac.");
      return;
    }

    setSubmitting(true);
    setFeedback("");
    try {
      const payload = {
        term_code: form.term_code,
        term_name: form.term_name,
        status: form.status,
      };

      if (form.id) {
        await updateTerm(form.id, payload);
        setFeedback("Da cap nhat hoc ky.");
      } else {
        await createTerm(payload);
        setFeedback("Da tao hoc ky moi.");
      }

      resetForm();
      await load();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Khong the luu hoc ky.");
    } finally {
      setSubmitting(false);
    }
  }

  async function markCurrentTerm(termId) {
    setFeedback("");
    try {
      await Promise.all(
        state.items.map((item) =>
          updateTerm(item.id, {
            status: item.id === termId ? "active" : item.status === "active" ? "inactive" : item.status,
          }),
        ),
      );
      setFeedback("Da cap nhat hoc ky hien hanh.");
      await load();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Khong the dat hoc ky hien hanh.");
    }
  }

  async function toggleStatus(term) {
    setFeedback("");
    try {
      await updateTerm(term.id, { status: term.status === "active" ? "inactive" : "active" });
      await load();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Khong the cap nhat trang thai hoc ky.");
    }
  }

  if (state.loading) return <LoadingState label="Dang tai module hoc ky..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  return (
    <div className="section-stack">
      <div className="page-header">
        <h2 className="page-title">Hoc ky</h2>
        <p className="page-subtitle">
          Quan ly danh muc hoc ky, tranh trung ma hoc ky, bat/tat trang thai va danh dau hoc ky hien hanh.
        </p>
      </div>

      <div className="cards-grid">
        <div className="panel metric-card">
          <h3>{activeTerm?.term_code || "--"}</h3>
          <p>Hoc ky hien hanh</p>
        </div>
        <div className="panel metric-card">
          <h3>{state.items.length}</h3>
          <p>Tong so hoc ky</p>
        </div>
      </div>

      <form className="panel inline-form" onSubmit={handleSubmit}>
        <label className="field-group">
          <span>Ma hoc ky</span>
          <input value={form.term_code} onChange={(event) => setForm((prev) => ({ ...prev, term_code: event.target.value }))} />
        </label>
        <label className="field-group">
          <span>Ten hoc ky</span>
          <input value={form.term_name} onChange={(event) => setForm((prev) => ({ ...prev, term_name: event.target.value }))} />
        </label>
        <label className="field-group">
          <span>Trang thai</span>
          <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </label>
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? "Dang luu..." : form.id ? "Cap nhat hoc ky" : "Tao hoc ky"}
        </button>
        {form.id ? (
          <button className="secondary-button" type="button" onClick={resetForm}>
            Huy sua
          </button>
        ) : null}
      </form>

      {feedback ? <div className="state-card">{feedback}</div> : null}

      <div className="table-card">
        <h3 className="page-title">Danh sach hoc ky</h3>
        {state.items.length ? (
          <table>
            <thead>
              <tr>
                <th>Ma</th>
                <th>Ten</th>
                <th>Trang thai</th>
                <th>Thao tac</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.term_code}</td>
                  <td>{item.term_name}</td>
                  <td>{item.status}</td>
                  <td className="table-actions">
                    <button className="secondary-button" type="button" onClick={() => beginEdit(item)}>
                      Sua
                    </button>
                    <button className="secondary-button" type="button" onClick={() => toggleStatus(item)}>
                      {item.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                    <button className="primary-button" type="button" onClick={() => markCurrentTerm(item.id)}>
                      Dat hien hanh
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Chua co hoc ky nao." />
        )}
      </div>
    </div>
  );
}
