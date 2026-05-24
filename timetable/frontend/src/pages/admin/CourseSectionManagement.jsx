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
  program_name: "",
  status: "active",
};

export default function CourseSectionManagement() {
  const [state, setState] = useState({ loading: true, error: "", sections: [], terms: [] });
  const [filters, setFilters] = useState({ search: "", term_id: "", faculty: "", program: "", status: "" });
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function load(activeFilters = filters) {
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const [sections, terms] = await Promise.all([
        fetchCourseSections({
          term_id: activeFilters.term_id || undefined,
          faculty: activeFilters.faculty || undefined,
          program: activeFilters.program || undefined,
          status: activeFilters.status || undefined,
        }),
        fetchTerms(),
      ]);
      setState({ loading: false, error: "", sections, terms });
    } catch (err) {
      setState({
        loading: false,
        error: err?.response?.data?.detail || "Không tải được danh sách lớp học phần.",
        sections: [],
        terms: [],
      });
    }
  }

  useEffect(() => {
    load(filters);
  }, [filters.term_id, filters.faculty, filters.program, filters.status]);

  const facultyOptions = useMemo(
    () => [...new Set(state.sections.map((section) => section.faculty).filter(Boolean))].sort(),
    [state.sections],
  );

  const programOptions = useMemo(() => {
    return [...new Set(
      state.sections
        .filter((section) => !filters.faculty || section.faculty === filters.faculty)
        .map((section) => section.program_name)
        .filter(Boolean),
    )].sort();
  }, [filters.faculty, state.sections]);

  const filteredSections = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return state.sections.filter((section) => {
      if (!search) return true;
      return [
        section.course_code,
        section.course_name,
        section.section_code,
        section.teacher_external_id,
        section.teacher_name,
        section.faculty,
        section.program_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [filters.search, state.sections]);

  function beginEdit(section) {
    setForm({
      id: section.id,
      term_id: section.term_id || "",
      course_code: section.course_code || "",
      course_name: section.course_name || "",
      section_code: section.section_code || "",
      teacher_external_id: section.teacher_external_id || "",
      faculty: section.faculty || "",
      program_name: section.program_name || "",
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
        program_name: form.program_name || null,
        status: form.status || "active",
      };

      if (form.id) {
        await updateCourseSection(form.id, payload);
        if (form.teacher_external_id) {
          await assignSectionTeacher(form.id, form.teacher_external_id);
        }
        setFeedback("Đã cập nhật lớp học phần.");
      } else {
        await createCourseSection(payload);
        setFeedback("Đã tạo lớp học phần mới.");
      }

      resetForm();
      await load(filters);
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Không thể lưu lớp học phần.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive(section, nextStatus) {
    setFeedback("");
    try {
      await archiveCourseSection(section.id, nextStatus);
      await load(filters);
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Không thể cập nhật trạng thái lớp học phần.");
    }
  }

  if (state.loading) return <LoadingState label="Đang tải module lớp học phần..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={() => load(filters)} />;

  return (
    <div className="section-stack">
      <div className="page-header">
        <h2 className="page-title">Quản lý lớp học phần</h2>
        <p className="page-subtitle">Tổ chức lớp học phần theo khoa, chương trình và học kỳ để admin không phải lọc thủ công toàn hệ thống.</p>
      </div>

      <form className="panel form-grid" onSubmit={handleSubmit}>
        <div className="inline-form">
          <label className="field-group">
            <span>Học kỳ</span>
            <select value={form.term_id} onChange={(event) => setForm((prev) => ({ ...prev, term_id: event.target.value }))}>
              <option value="">Chưa gán học kỳ</option>
              {state.terms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.term_code}
                </option>
              ))}
            </select>
          </label>
          <label className="field-group">
            <span>Khoa</span>
            <input value={form.faculty} onChange={(event) => setForm((prev) => ({ ...prev, faculty: event.target.value }))} />
          </label>
          <label className="field-group">
            <span>Ngành / Chương trình</span>
            <input value={form.program_name} onChange={(event) => setForm((prev) => ({ ...prev, program_name: event.target.value }))} />
          </label>
          <label className="field-group">
            <span>Teacher ID</span>
            <input value={form.teacher_external_id} onChange={(event) => setForm((prev) => ({ ...prev, teacher_external_id: event.target.value }))} />
          </label>
        </div>
        <div className="inline-form">
          <label className="field-group">
            <span>Mã môn</span>
            <input value={form.course_code} onChange={(event) => setForm((prev) => ({ ...prev, course_code: event.target.value }))} />
          </label>
          <label className="field-group">
            <span>Tên môn</span>
            <input value={form.course_name} onChange={(event) => setForm((prev) => ({ ...prev, course_name: event.target.value }))} />
          </label>
          <label className="field-group">
            <span>Mã lớp học phần</span>
            <input value={form.section_code} onChange={(event) => setForm((prev) => ({ ...prev, section_code: event.target.value }))} />
          </label>
          <label className="field-group">
            <span>Trạng thái</span>
            <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="archived">archived</option>
            </select>
          </label>
        </div>
        <div className="button-row">
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? "Đang lưu..." : form.id ? "Cập nhật lớp học phần" : "Tạo lớp học phần"}
          </button>
          {form.id ? (
            <button className="secondary-button" type="button" onClick={resetForm}>
              Hủy sửa
            </button>
          ) : null}
        </div>
      </form>

      {feedback ? <div className="state-card">{feedback}</div> : null}

      <div className="panel inline-form">
        <label className="field-group">
          <span>Tìm kiếm</span>
          <input
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            placeholder="Mã môn, tên môn, section, giảng viên"
          />
        </label>
        <label className="field-group">
          <span>Học kỳ</span>
          <select value={filters.term_id} onChange={(event) => setFilters((prev) => ({ ...prev, term_id: event.target.value }))}>
            <option value="">Tất cả học kỳ</option>
            {state.terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.term_code}
              </option>
            ))}
          </select>
        </label>
        <label className="field-group">
          <span>Khoa</span>
          <select
            value={filters.faculty}
            onChange={(event) => setFilters((prev) => ({ ...prev, faculty: event.target.value, program: "" }))}
          >
            <option value="">Tất cả khoa</option>
            {facultyOptions.map((faculty) => (
              <option key={faculty} value={faculty}>
                {faculty}
              </option>
            ))}
          </select>
        </label>
        <label className="field-group">
          <span>Ngành / Chương trình</span>
          <select value={filters.program} onChange={(event) => setFilters((prev) => ({ ...prev, program: event.target.value }))}>
            <option value="">Tất cả chương trình</option>
            {programOptions.map((program) => (
              <option key={program} value={program}>
                {program}
              </option>
            ))}
          </select>
        </label>
        <label className="field-group">
          <span>Trạng thái</span>
          <select value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
            <option value="">Tất cả trạng thái</option>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
            <option value="archived">archived</option>
          </select>
        </label>
      </div>

      <div className="table-card">
        <h3 className="page-title">Danh sách lớp học phần</h3>
        {filteredSections.length ? (
          <table>
            <thead>
              <tr>
                <th>Khoa</th>
                <th>Ngành / Chương trình</th>
                <th>Lớp học phần</th>
                <th>Môn học</th>
                <th>Giảng viên</th>
                <th>Học kỳ</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredSections.map((item) => (
                <tr key={item.id}>
                  <td>{item.faculty || "--"}</td>
                  <td>{item.program_name || "--"}</td>
                  <td>{item.section_code}</td>
                  <td>
                    <strong>{item.course_name}</strong>
                    <div className="helper-text">{item.course_code}</div>
                  </td>
                  <td>{item.teacher_name || item.teacher_external_id || "--"}</td>
                  <td>{item.term_code || "--"}</td>
                  <td>{item.status}</td>
                  <td className="table-actions">
                    <button className="secondary-button" type="button" onClick={() => beginEdit(item)}>
                      Sửa
                    </button>
                    <button className="secondary-button" type="button" onClick={() => handleArchive(item, item.status === "active" ? "inactive" : "active")}>
                      {item.status === "active" ? "Ngừng" : "Kích hoạt"}
                    </button>
                    <button className="danger-button" type="button" onClick={() => handleArchive(item, "archived")}>
                      Lưu trữ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Chưa có lớp học phần phù hợp với bộ lọc." />
        )}
      </div>
    </div>
  );
}
