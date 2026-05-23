import { useEffect, useState } from "react";
import { createCourseSection, fetchCourseSections, fetchTerms, importCourseSections } from "../../services/adminApi";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";

export default function CourseSectionManagement() {
  const [state, setState] = useState({ loading: true, error: "", sections: [], terms: [] });
  const [form, setForm] = useState({
    term_id: "",
    course_code: "",
    course_name: "",
    section_code: "",
    teacher_external_id: "",
    faculty: "",
  });
  const [importForm, setImportForm] = useState({ term: "", class_name: "", student_id: "", limit: 100 });

  async function load() {
    setState({ loading: true, error: "", sections: [], terms: [] });
    try {
      const [sections, terms] = await Promise.all([fetchCourseSections(), fetchTerms()]);
      setState({ loading: false, error: "", sections, terms });
    } catch (err) {
      setState({ loading: false, error: err?.response?.data?.detail || "Không tải được lớp học phần.", sections: [], terms: [] });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    await createCourseSection({
      ...form,
      term_id: form.term_id || null,
      teacher_external_id: form.teacher_external_id || null,
      faculty: form.faculty || null,
    });
    setForm({ term_id: "", course_code: "", course_name: "", section_code: "", teacher_external_id: "", faculty: "" });
    await load();
  }

  async function handleImport(event) {
    event.preventDefault();
    await importCourseSections({
      term: importForm.term || null,
      class_name: importForm.class_name || null,
      student_id: importForm.student_id || null,
      limit: Number(importForm.limit || 100),
    });
    await load();
  }

  if (state.loading) return <LoadingState label="Đang tải lớp học phần..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  return (
    <div className="section-stack">
      <form className="panel inline-form" onSubmit={handleCreate}>
        <label className="field-group">
          <span>Học kỳ</span>
          <select value={form.term_id} onChange={(event) => setForm((prev) => ({ ...prev, term_id: event.target.value }))}>
            <option value="">Chưa gắn</option>
            {state.terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.term_code}
              </option>
            ))}
          </select>
        </label>
        <label className="field-group">
          <span>Mã môn</span>
          <input value={form.course_code} onChange={(event) => setForm((prev) => ({ ...prev, course_code: event.target.value }))} />
        </label>
        <label className="field-group">
          <span>Tên môn</span>
          <input value={form.course_name} onChange={(event) => setForm((prev) => ({ ...prev, course_name: event.target.value }))} />
        </label>
        <label className="field-group">
          <span>Lớp HP</span>
          <input value={form.section_code} onChange={(event) => setForm((prev) => ({ ...prev, section_code: event.target.value }))} />
        </label>
        <label className="field-group">
          <span>Teacher ID</span>
          <input value={form.teacher_external_id} onChange={(event) => setForm((prev) => ({ ...prev, teacher_external_id: event.target.value }))} />
        </label>
        <button className="primary-button" type="submit">
          Tạo lớp HP
        </button>
      </form>

      <form className="panel inline-form" onSubmit={handleImport}>
        <label className="field-group">
          <span>Import theo học kỳ</span>
          <input value={importForm.term} onChange={(event) => setImportForm((prev) => ({ ...prev, term: event.target.value }))} />
        </label>
        <label className="field-group">
          <span>Class name</span>
          <input value={importForm.class_name} onChange={(event) => setImportForm((prev) => ({ ...prev, class_name: event.target.value }))} />
        </label>
        <label className="field-group">
          <span>Student ID</span>
          <input value={importForm.student_id} onChange={(event) => setImportForm((prev) => ({ ...prev, student_id: event.target.value }))} />
        </label>
        <button className="secondary-button" type="submit">
          Import từ Student Portal
        </button>
      </form>

      <div className="table-card">
        <h2 className="page-title">Danh sách lớp học phần</h2>
        {state.sections.length ? (
          <table>
            <thead>
              <tr>
                <th>Mã môn</th>
                <th>Tên môn</th>
                <th>Lớp HP</th>
                <th>Teacher</th>
                <th>Faculty</th>
              </tr>
            </thead>
            <tbody>
              {state.sections.map((item) => (
                <tr key={item.id}>
                  <td>{item.course_code}</td>
                  <td>{item.course_name}</td>
                  <td>{item.section_code}</td>
                  <td>{item.teacher_external_id || "--"}</td>
                  <td>{item.faculty || "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Chưa có lớp học phần." />
        )}
      </div>
    </div>
  );
}
