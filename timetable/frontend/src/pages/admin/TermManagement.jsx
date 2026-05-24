import { useEffect, useMemo, useState } from "react";
import CustomSelect from "../../components/CustomSelect";
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
      setState({ loading: false, error: err?.response?.data?.detail || "Không tải được học kỳ.", items: [] });
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
      setFeedback("Mã học kỳ đã tồn tại. Vui lòng dùng mã khác.");
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
        setFeedback("Đã cập nhật học kỳ.");
      } else {
        await createTerm(payload);
        setFeedback("Đã tạo học kỳ mới.");
      }

      resetForm();
      await load();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Không thể lưu học kỳ.");
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
      setFeedback("Đã cập nhật học kỳ hiện hành.");
      await load();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Không thể đặt học kỳ hiện hành.");
    }
  }

  async function toggleStatus(term) {
    setFeedback("");
    try {
      await updateTerm(term.id, { status: term.status === "active" ? "inactive" : "active" });
      await load();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Không thể cập nhật trạng thái học kỳ.");
    }
  }

  if (state.loading) return <LoadingState label="Đang tải học kỳ..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  return (
    <div className="section-stack">
      <div className="page-header">
        <h2 className="page-title">Học kỳ</h2>
        <p className="page-subtitle">
          Quản lý danh mục học kỳ, tránh trùng mã học kỳ, bật/tắt trạng thái và đánh dấu học kỳ hiện hành.
        </p>
      </div>

      <div className="cards-grid">
        <div className="panel metric-card">
          <h3>{activeTerm?.term_code || "--"}</h3>
          <p>Học kỳ hiện hành</p>
        </div>
        <div className="panel metric-card">
          <h3>{state.items.length}</h3>
          <p>Tổng số học kỳ</p>
        </div>
      </div>

      <form className="panel inline-form" onSubmit={handleSubmit}>
        <label className="field-group">
          <span>Mã học kỳ</span>
          <input value={form.term_code} onChange={(event) => setForm((prev) => ({ ...prev, term_code: event.target.value }))} placeholder="Ví dụ: HK2_2025_2026" required />
        </label>
        <label className="field-group">
          <span>Tên học kỳ</span>
          <input value={form.term_name} onChange={(event) => setForm((prev) => ({ ...prev, term_name: event.target.value }))} placeholder="Ví dụ: Học kỳ 2 nhóm 1 (2025-2026)" required />
        </label>
        <label className="field-group">
          <span>Trạng thái</span>
          <CustomSelect
            value={form.status}
            onChange={(val) => setForm((prev) => ({ ...prev, status: val }))}
            options={[
              { value: "active", label: "Hoạt động (active)" },
              { value: "inactive", label: "Không hoạt động (inactive)" },
            ]}
            placeholder="Chọn trạng thái"
          />
        </label>
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? "Đang lưu..." : form.id ? "Cập nhật học kỳ" : "Tạo học kỳ"}
        </button>
        {form.id ? (
          <button className="secondary-button" type="button" onClick={resetForm}>
            Hủy sửa
          </button>
        ) : null}
      </form>

      {feedback ? <div className="state-card">{feedback}</div> : null}

      <div className="table-card">
        <h3 className="page-title">Danh sách học kỳ</h3>
        {state.items.length ? (
          <table>
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên học kỳ</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.term_code}</td>
                  <td>{item.term_name}</td>
                  <td>{item.status === "active" ? "Hoạt động" : "Không hoạt động"}</td>
                  <td className="table-actions">
                    <button className="secondary-button" type="button" onClick={() => beginEdit(item)}>
                      Sửa
                    </button>
                    <button className="secondary-button" type="button" onClick={() => toggleStatus(item)}>
                      {item.status === "active" ? "Tắt kích hoạt" : "Kích hoạt"}
                    </button>
                    <button className="primary-button" type="button" onClick={() => markCurrentTerm(item.id)}>
                      Đặt hiện hành
                    </button>
                  </td>
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
