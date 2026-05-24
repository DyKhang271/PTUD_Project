import { useEffect, useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import {
  archiveCourseSection,
  assignSectionTeacher,
  createCourseSection,
  fetchCourseSections,
  fetchTerms,
  updateCourseSection,
} from "../../services/adminApi";

const initialForm = {
  id: "",
  term_id: "",
  course_code: "",
  course_name: "",
  section_code: "",
  teacher_external_id: "",
  faculty: "",
  status: "active",
};

export default function CourseSectionManagement() {
  const [state, setState] = useState({ loading: true, error: "", sections: [], terms: [] });
  const [filters, setFilters] = useState({ search: "", term_id: "", status: "" });
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function load() {
    setState({ loading: true, error: "", sections: [], terms: [] });
    try {
      const [sections, terms] = await Promise.all([fetchCourseSections(), fetchTerms()]);
      setState({ loading: false, error: "", sections, terms });
    } catch (err) {
      setState({
        loading: false,
        error: err?.response?.data?.detail || "Khong tai duoc danh sach lop hoc phan.",
        sections: [],
        terms: [],
      });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredSections = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return state.sections.filter((section) => {
      if (filters.term_id && section.term_id !== filters.term_id) {
        return false;
      }
      if (filters.status && section.status !== filters.status) {
        return false;
      }
      if (!search) {
        return true;
      }
      const haystack = [
        section.course_code,
        section.course_name,
        section.section_code,
        section.teacher_external_id,
        section.faculty,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [filters, state.sections]);

  function beginEdit(section) {
    setForm({
      id: section.id,
      term_id: section.term_id || "",
      course_code: section.course_code || "",
      course_name: section.course_name || "",
      section_code: section.section_code || "",
      teacher_external_id: section.teacher_external_id || "",
      faculty: section.faculty || "",
      status: section.status || "active",
    });
    setFeedback("");
  }

  function resetForm() {
    setForm(initialForm);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback("");
    try {
      const payload = {
        term_id: form.term_id || null,
        course_code: form.course_code,
        course_name: form.course_name,
        section_code: form.section_code,
        teacher_external_id: form.teacher_external_id || null,
        faculty: form.faculty || null,
        status: form.status || "active",
      };

      if (form.id) {
        await updateCourseSection(form.id, payload);
        if (form.teacher_external_id) {
          await assignSectionTeacher(form.id, form.teacher_external_id);
        }
        setFeedback("Da cap nhat lop hoc phan.");
      } else {
        await createCourseSection(payload);
        setFeedback("Da tao lop hoc phan moi.");
      }

      resetForm();
      await load();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Khong the luu lop hoc phan.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive(section, nextStatus) {
    setFeedback("");
    try {
      await archiveCourseSection(section.id, nextStatus);
      if (form.id === section.id) {
        setForm((current) => ({ ...current, status: nextStatus }));
      }
      await load();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Khong the cap nhat trang thai lop hoc phan.");
    }
  }

  if (state.loading) return <LoadingState label="Dang tai module lop hoc phan..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  return (
    <div className="section-stack">
      <div className="page-header">
        <h2 className="page-title">Quan ly lop hoc phan</h2>
        <p className="page-subtitle">
          Module nay chi dung de quan ly cac section da ton tai: tao tay, chinh sua, gan giang vien va doi trang thai.
        </p>
      </div>

      <form className="panel inline-form" onSubmit={handleSubmit}>
        <label className="field-group">
          <span>Hoc ky</span>
          <select value={form.term_id} onChange={(event) => setForm((prev) => ({ ...prev, term_id: event.target.value }))}>
            <option value="">Chua gan hoc ky</option>
            {state.terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.term_code}
              </option>
            ))}
          </select>
        </label>
        <label className="field-group">
          <span>Ma mon</span>
          <input value={form.course_code} onChange={(event) => setForm((prev) => ({ ...prev, course_code: event.target.value }))} />
        </label>
        <label className="field-group">
          <span>Ten mon</span>
          <input value={form.course_name} onChange={(event) => setForm((prev) => ({ ...prev, course_name: event.target.value }))} />
        </label>
        <label className="field-group">
          <span>Section code</span>
          <input value={form.section_code} onChange={(event) => setForm((prev) => ({ ...prev, section_code: event.target.value }))} />
        </label>
        <label className="field-group">
          <span>Teacher ID</span>
          <input
            value={form.teacher_external_id}
            onChange={(event) => setForm((prev) => ({ ...prev, teacher_external_id: event.target.value }))}
          />
        </label>
        <label className="field-group">
          <span>Trang thai</span>
          <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
            <option value="archived">archived</option>
          </select>
        </label>
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? "Dang luu..." : form.id ? "Cap nhat lop hoc phan" : "Tao lop hoc phan"}
        </button>
        {form.id ? (
          <button className="secondary-button" type="button" onClick={resetForm}>
            Huy sua
          </button>
        ) : null}
      </form>

      {feedback ? <div className="state-card">{feedback}</div> : null}

      <div className="panel inline-form">
        <label className="field-group">
          <span>Tim kiem</span>
          <input
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            placeholder="Ma mon, ten mon, section, teacher"
          />
        </label>
        <label className="field-group">
          <span>Loc theo hoc ky</span>
          <select value={filters.term_id} onChange={(event) => setFilters((prev) => ({ ...prev, term_id: event.target.value }))}>
            <option value="">Tat ca hoc ky</option>
            {state.terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.term_code}
              </option>
            ))}
          </select>
        </label>
        <label className="field-group">
          <span>Loc theo trang thai</span>
          <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
            <option value="">Tat ca trang thai</option>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
            <option value="archived">archived</option>
          </select>
        </label>
      </div>

      <div className="table-card">
        <h3 className="page-title">Danh sach lop hoc phan</h3>
        {filteredSections.length ? (
          <table>
            <thead>
              <tr>
                <th>Section</th>
                <th>Mon hoc</th>
                <th>Giang vien</th>
                <th>Faculty</th>
                <th>Trang thai</th>
                <th>Thao tac</th>
              </tr>
            </thead>
            <tbody>
              {filteredSections.map((item) => (
                <tr key={item.id}>
                  <td>{item.section_code}</td>
                  <td>
                    <strong>{item.course_name}</strong>
                    <div className="helper-text">{item.course_code}</div>
                  </td>
                  <td>{item.teacher_external_id || "--"}</td>
                  <td>{item.faculty || "--"}</td>
                  <td>{item.status}</td>
                  <td className="table-actions">
                    <button className="secondary-button" type="button" onClick={() => beginEdit(item)}>
                      Sua
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => handleArchive(item, item.status === "active" ? "inactive" : "active")}
                    >
                      {item.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                    <button className="danger-button" type="button" onClick={() => handleArchive(item, "archived")}>
                      Archive
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Chua co lop hoc phan phu hop voi bo loc." />
        )}
      </div>
    </div>
  );
}
