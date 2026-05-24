import { useEffect, useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import StatusBadge from "../../components/StatusBadge";
import {
  archiveCourseSection,
  assignSectionTeacher,
  createCourseSection,
  fetchCourseSections,
  fetchCourseSubjects,
  fetchTeacherOptions,
  fetchTerms,
  updateCourseSection,
} from "../../services/adminApi";

const MODE_OPTIONS = [
  { value: "classified", label: "Theo ngữ cảnh" },
  { value: "unclassified", label: "Chưa phân loại" },
];

const initialFilters = {
  term_id: "",
  faculty: "",
  program: "",
  course_id: "",
  search: "",
  status: "",
  mode: "classified",
};

const initialForm = {
  id: "",
  term_id: "",
  faculty: "",
  program_name: "",
  course_code: "",
  course_name: "",
  section_code: "",
  teacher_external_id: "",
  student_count: "",
  note: "",
  status: "active",
};

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, "vi"));
}

function groupSectionsByCourse(subjects, sections, search) {
  const searchText = search.trim().toLowerCase();
  const sectionsByCourse = sections.reduce((map, section) => {
    const key = section.course_code;
    const bucket = map.get(key) || [];
    bucket.push(section);
    map.set(key, bucket);
    return map;
  }, new Map());

  const groups = subjects
    .map((subject) => {
      const courseSections = (sectionsByCourse.get(subject.course_code) || []).filter((section) => {
        if (!searchText) return true;
        return [
          section.course_code,
          section.course_name,
          section.section_code,
          section.teacher_name,
          section.teacher_external_id,
          section.note,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(searchText);
      });
      return {
        ...subject,
        sections: courseSections.sort((left, right) => left.section_code.localeCompare(right.section_code, "vi")),
      };
    })
    .filter((group) => {
      if (searchText && !group.sections.length) {
        const subjectText = [group.course_code, group.course_name].filter(Boolean).join(" ").toLowerCase();
        return subjectText.includes(searchText);
      }
      return group.sections.length > 0 || !searchText;
    });

  return groups.sort((left, right) => left.course_name.localeCompare(right.course_name, "vi"));
}

export default function CourseSectionManagement() {
  const [state, setState] = useState({ loading: true, error: "", terms: [], subjects: [], sections: [], teachers: [] });
  const [filters, setFilters] = useState(initialFilters);
  const [feedback, setFeedback] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const contextReady = Boolean(filters.term_id && filters.faculty && filters.program);
  const isUnclassifiedMode = filters.mode === "unclassified";
  const selectedTerm = state.terms.find((term) => term.id === filters.term_id);

  async function loadContextOnly(termId = filters.term_id) {
    const [terms, subjects] = await Promise.all([
      state.terms.length ? Promise.resolve(state.terms) : fetchTerms(),
      termId ? fetchCourseSubjects({ term_id: termId }) : Promise.resolve([]),
    ]);
    return { terms, subjects };
  }

  async function load(activeFilters = filters) {
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const { terms, subjects } = await loadContextOnly(activeFilters.term_id);
      let sections = [];
      if (activeFilters.term_id && (activeFilters.mode === "unclassified" || (activeFilters.faculty && activeFilters.program))) {
        sections = await fetchCourseSections({
          term_id: activeFilters.term_id,
          faculty: activeFilters.mode === "unclassified" ? undefined : activeFilters.faculty || undefined,
          program: activeFilters.mode === "unclassified" ? undefined : activeFilters.program || undefined,
          course_id: activeFilters.course_id || undefined,
          status: activeFilters.status || undefined,
        });
      }
      setState((prev) => ({ ...prev, loading: false, error: "", terms, subjects, sections }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err?.response?.data?.detail || "Không tải được danh sách lớp học phần.",
      }));
    }
  }

  useEffect(() => {
    load(initialFilters);
  }, []);

  useEffect(() => {
    if (!state.terms.length && filters.term_id !== "") return;
    load(filters);
  }, [filters.term_id, filters.faculty, filters.program, filters.course_id, filters.status, filters.mode]);

  useEffect(() => {
    if (!isModalOpen) return;
    setIsModalOpen(false);
    setForm(initialForm);
    setTeacherSearch("");
  }, [filters.term_id, filters.faculty, filters.program, filters.course_id, filters.mode]);

  const allSubjectsInTerm = useMemo(
    () => state.subjects.filter((subject) => subject.term_id === filters.term_id || !filters.term_id),
    [state.subjects, filters.term_id],
  );

  const classifiedSubjects = useMemo(
    () => allSubjectsInTerm.filter((subject) => subject.faculty && subject.program_name),
    [allSubjectsInTerm],
  );

  const facultyOptions = useMemo(
    () => uniqueSorted(classifiedSubjects.map((subject) => subject.faculty)),
    [classifiedSubjects],
  );

  const programOptions = useMemo(
    () =>
      uniqueSorted(
        classifiedSubjects
          .filter((subject) => !filters.faculty || subject.faculty === filters.faculty)
          .map((subject) => subject.program_name),
      ),
    [classifiedSubjects, filters.faculty],
  );

  const courseOptions = useMemo(
    () =>
      classifiedSubjects.filter((subject) => {
        if (!contextReady) return false;
        if (subject.faculty !== filters.faculty) return false;
        if (subject.program_name !== filters.program) return false;
        return true;
      }),
    [classifiedSubjects, contextReady, filters.faculty, filters.program],
  );

  const visibleSections = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return state.sections.filter((section) => {
      const isUnclassified = !section.faculty || !section.program_name;
      if (isUnclassifiedMode) {
        if (!isUnclassified) return false;
      } else if (isUnclassified) {
        return false;
      }

      if (search) {
        const haystack = [
          section.course_code,
          section.course_name,
          section.section_code,
          section.teacher_name,
          section.teacher_external_id,
          section.note,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [filters.search, isUnclassifiedMode, state.sections]);

  const teacherOptions = useMemo(() => {
    if (!form.teacher_external_id) return state.teachers;
    const exists = state.teachers.some((teacher) => teacher.teacher_id === form.teacher_external_id);
    if (exists) return state.teachers;
    return [
      {
        teacher_id: form.teacher_external_id,
        teacher_name: teacherSearch || form.teacher_external_id,
      },
      ...state.teachers,
    ];
  }, [form.teacher_external_id, state.teachers, teacherSearch]);

  const filteredTeacherOptions = useMemo(() => {
    const search = teacherSearch.trim().toLowerCase();
    if (!search) return teacherOptions;
    return teacherOptions.filter((teacher) =>
      [teacher.teacher_name, teacher.teacher_id].join(" ").toLowerCase().includes(search),
    );
  }, [teacherOptions, teacherSearch]);

  const groupedSections = useMemo(() => {
    if (isUnclassifiedMode) {
      return [
        {
          course_id: "unclassified",
          course_code: "UNCLASSIFIED",
          course_name: "Dữ liệu chưa phân loại",
          section_count: visibleSections.length,
          sections: visibleSections,
        },
      ];
    }
    return groupSectionsByCourse(
      filters.course_id ? courseOptions.filter((course) => course.course_id === filters.course_id) : courseOptions,
      visibleSections,
      filters.search,
    );
  }, [courseOptions, filters.course_id, filters.search, isUnclassifiedMode, visibleSections]);

  useEffect(() => {
    if (!isModalOpen) return;
    let cancelled = false;

    async function loadTeachers() {
      try {
        const teachers = await fetchTeacherOptions({
          q: teacherSearch || undefined,
          faculty: form.faculty || filters.faculty || undefined,
          limit: 50,
          refresh: teacherOptions.length === 0,
        });
        if (!cancelled) {
          setState((prev) => ({ ...prev, teachers }));
        }
      } catch {
        if (!cancelled) {
          setState((prev) => ({ ...prev, teachers: [] }));
        }
      }
    }

    loadTeachers();
    return () => {
      cancelled = true;
    };
  }, [filters.faculty, form.faculty, isModalOpen, teacherOptions.length, teacherSearch]);

  function updateFilters(patch) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  function openCreateModal() {
    if (!contextReady || isUnclassifiedMode) {
      setFeedback("Vui lòng chọn đủ Học kỳ, Khoa và Ngành/Chương trình trước khi tạo lớp học phần.");
      return;
    }
    setFeedback("");
    setForm({
      ...initialForm,
      term_id: filters.term_id,
      faculty: filters.faculty,
      program_name: filters.program,
      course_code: filters.course_id,
      course_name: courseOptions.find((course) => course.course_id === filters.course_id)?.course_name || "",
    });
    setTeacherSearch("");
    setIsModalOpen(true);
  }

  function beginEdit(section) {
    setFeedback("");
    setForm({
      id: section.id,
      term_id: section.term_id || filters.term_id,
      faculty: section.faculty || filters.faculty,
      program_name: section.program_name || filters.program,
      course_code: section.course_code || "",
      course_name: section.course_name || "",
      section_code: section.section_code || "",
      teacher_external_id: section.teacher_external_id || "",
      student_count: section.student_count ?? "",
      note: section.note || "",
      status: section.status || "active",
    });
    setTeacherSearch(section.teacher_name || section.teacher_external_id || "");
    setIsModalOpen(true);
  }

  function resetModal() {
    setIsModalOpen(false);
    setForm(initialForm);
    setTeacherSearch("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback("");
    try {
      const selectedCourse = courseOptions.find((course) => course.course_id === form.course_code);
      const payload = {
        term_id: form.term_id || null,
        course_code: form.course_code,
        course_name: selectedCourse?.course_name || form.course_name,
        section_code: form.section_code,
        teacher_external_id: form.teacher_external_id || null,
        faculty: form.faculty || null,
        program_name: form.program_name || null,
        student_count: form.student_count === "" ? 0 : Number(form.student_count),
        note: form.note || null,
        status: form.status || "active",
      };

      if (form.id) {
        await updateCourseSection(form.id, payload);
        if (form.teacher_external_id) {
          await assignSectionTeacher(form.id, form.teacher_external_id);
        }
        setFeedback("Đã cập nhật lớp học phần.");
      } else {
        const created = await createCourseSection(payload);
        if (form.teacher_external_id) {
          await assignSectionTeacher(created.id, form.teacher_external_id);
        }
        setFeedback("Đã tạo lớp học phần mới.");
      }
      resetModal();
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

  if (state.loading && !state.terms.length) return <LoadingState label="Đang tải module lớp học phần..." />;
  if (state.error && !state.terms.length) return <ErrorState message={state.error} onRetry={() => load(filters)} />;

  return (
    <div className="section-stack">
      <div className="page-header">
        <h2 className="page-title">Quản lý lớp học phần</h2>
        <p className="page-subtitle">
          Chọn ngữ cảnh học vụ trước, rồi mới xem và thao tác section. Màn hình này ưu tiên workflow gọn, không đổ toàn bộ dữ liệu ra ngay từ đầu.
        </p>
      </div>

      <div className="panel admin-sticky-toolbar">
        <div className="admin-filter-grid">
          <label className="field-group">
            <span>Học kỳ</span>
            <select
              value={filters.term_id}
              onChange={(event) =>
                updateFilters({
                  term_id: event.target.value,
                  faculty: "",
                  program: "",
                  course_id: "",
                  search: "",
                })
              }
            >
              <option value="">Chọn học kỳ</option>
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
              disabled={!filters.term_id || isUnclassifiedMode}
              onChange={(event) =>
                updateFilters({
                  faculty: event.target.value,
                  program: "",
                  course_id: "",
                })
              }
            >
              <option value="">Chọn khoa</option>
              {facultyOptions.map((faculty) => (
                <option key={faculty} value={faculty}>
                  {faculty}
                </option>
              ))}
            </select>
          </label>

          <label className="field-group">
            <span>Ngành / Chương trình</span>
            <select
              value={filters.program}
              disabled={!filters.faculty || isUnclassifiedMode}
              onChange={(event) =>
                updateFilters({
                  program: event.target.value,
                  course_id: "",
                })
              }
            >
              <option value="">Chọn ngành / chương trình</option>
              {programOptions.map((program) => (
                <option key={program} value={program}>
                  {program}
                </option>
              ))}
            </select>
          </label>

          <label className="field-group">
            <span>Môn học</span>
            <select
              value={filters.course_id}
              disabled={!contextReady || isUnclassifiedMode}
              onChange={(event) => updateFilters({ course_id: event.target.value })}
            >
              <option value="">Tất cả môn học</option>
              {courseOptions.map((course) => (
                <option key={`${course.term_id || "termless"}-${course.course_id}`} value={course.course_id}>
                  {course.course_name} ({course.course_code})
                </option>
              ))}
            </select>
          </label>

          <label className="field-group">
            <span>Tìm kiếm</span>
            <input
              value={filters.search}
              onChange={(event) => updateFilters({ search: event.target.value })}
              placeholder="Mã môn, tên môn, section, giảng viên"
            />
          </label>

          <label className="field-group">
            <span>Trạng thái</span>
            <select value={filters.status} onChange={(event) => updateFilters({ status: event.target.value })}>
              <option value="">Tất cả trạng thái</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>

        <div className="admin-toolbar-actions">
          <div className="admin-toggle-group">
            {MODE_OPTIONS.map((mode) => (
              <button
                key={mode.value}
                type="button"
                className={`admin-toggle-chip ${filters.mode === mode.value ? "is-active" : ""}`}
                onClick={() =>
                  updateFilters({
                    mode: mode.value,
                    faculty: mode.value === "unclassified" ? "" : filters.faculty,
                    program: mode.value === "unclassified" ? "" : filters.program,
                    course_id: "",
                  })
                }
              >
                {mode.label}
              </button>
            ))}
          </div>

          <div className="button-row">
            <button className="secondary-button" type="button" onClick={() => load(filters)}>
              Tải lại
            </button>
            <button className="primary-button" type="button" onClick={openCreateModal} disabled={!contextReady || isUnclassifiedMode}>
              Tạo lớp học phần
            </button>
          </div>
        </div>
      </div>

      {feedback ? <div className="state-card">{feedback}</div> : null}
      {selectedTerm && (!selectedTerm.start_date || !selectedTerm.end_date) ? (
        <div className="state-card state-warning">
          <strong>Học kỳ chưa có phạm vi ngày</strong>
          <div className="helper-text">Validation theo phạm vi học kỳ ở module lịch học/lịch thi sẽ chưa áp dụng đầy đủ cho học kỳ này cho tới khi được backfill.</div>
        </div>
      ) : null}

      {isUnclassifiedMode && filters.term_id ? (
        <div className="state-card state-warning">
          <strong>Dữ liệu chưa phân loại</strong>
          <div className="helper-text">Chế độ này chỉ dùng để chẩn đoán các section chưa map đủ metadata khoa/ngành.</div>
        </div>
      ) : null}

      {state.loading ? <LoadingState label="Đang cập nhật danh sách lớp học phần..." /> : null}
      {state.error ? <ErrorState message={state.error} onRetry={() => load(filters)} /> : null}

      {!isUnclassifiedMode && !contextReady ? (
        <EmptyState message="Vui lòng chọn Học kỳ, Khoa và Ngành/Chương trình để xem lớp học phần." />
      ) : null}

      {isUnclassifiedMode && !filters.term_id ? (
        <EmptyState message="Vui lòng chọn Học kỳ để xem dữ liệu chưa phân loại." />
      ) : null}

      {(isUnclassifiedMode ? Boolean(filters.term_id) : contextReady) ? (
        <div className="panel section-stack">
          <div className="admin-group-heading">
            <div>
              <h3 className="page-title">{isUnclassifiedMode ? "Section chưa phân loại" : "Lớp học phần theo môn"}</h3>
              <p className="page-subtitle">
                {isUnclassifiedMode
                  ? "Section chưa phân loại không tham gia luồng quản trị chính."
                  : "Mỗi thẻ là một môn học; section của môn đó được gom lại để thao tác nhanh hơn."}
              </p>
            </div>
            <div className="helper-text">{visibleSections.length} lớp học phần</div>
          </div>

          {groupedSections.length ? (
            <div className="admin-course-card-grid">
              {groupedSections.map((group) => (
                <article key={group.course_id} className="admin-course-card">
                  <div className="admin-course-card-head">
                    <div className="section-stack">
                      <div className="eyebrow">Môn học</div>
                      <div>
                        <h4>{group.course_name}</h4>
                        <p>{group.course_code}</p>
                      </div>
                    </div>
                    <div className="admin-course-card-metrics">
                      <span>{group.sections.length} lớp học phần</span>
                      <strong>{group.sections.filter((section) => section.status === "active").length} active</strong>
                    </div>
                  </div>

                  {group.sections.length ? (
                    <div className="admin-schedule-list">
                      {group.sections.map((section) => (
                        <div key={section.id} className="admin-schedule-row">
                          <div className="admin-schedule-primary">
                            <strong>{section.section_code}</strong>
                            <span>{section.term_code || "--"} • {section.student_count ?? 0} chỗ</span>
                          </div>
                          <div className="admin-schedule-secondary">
                            <span>Giảng viên: {section.teacher_name || section.teacher_external_id || "--"}</span>
                            <span>Ngành: {section.program_name || "--"}</span>
                            <span>Ghi chú: {section.note || "--"}</span>
                          </div>
                          <div className="admin-schedule-actions">
                            <StatusBadge status={section.status} />
                            <button className="secondary-button" type="button" onClick={() => beginEdit(section)}>
                              Sửa
                            </button>
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => handleArchive(section, section.status === "active" ? "inactive" : "active")}
                            >
                              {section.status === "active" ? "Ngừng" : "Kích hoạt"}
                            </button>
                            <button className="danger-button" type="button" onClick={() => handleArchive(section, "archived")}>
                              Lưu trữ
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="admin-course-empty">Chưa có lớp học phần cho môn này.</div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState message="Chưa có lớp học phần phù hợp với bộ lọc hiện tại." />
          )}
        </div>
      ) : null}

      {isModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel">
            <form className="form-grid" onSubmit={handleSubmit}>
              <div className="admin-modal-head">
                <div>
                  <h3>{form.id ? "Cập nhật lớp học phần" : "Tạo lớp học phần"}</h3>
                  <p className="page-subtitle">
                    Context hiện tại: {state.terms.find((term) => term.id === form.term_id)?.term_code || "--"} • {form.faculty || "--"} • {form.program_name || "--"}
                  </p>
                </div>
                <button className="secondary-button" type="button" onClick={resetModal}>
                  Đóng
                </button>
              </div>

              <div className="inline-form">
                <label className="field-group">
                  <span>Môn học</span>
                  <select
                    value={form.course_code}
                    onChange={(event) => {
                      const selected = courseOptions.find((course) => course.course_id === event.target.value);
                      setForm((prev) => ({
                        ...prev,
                        course_code: event.target.value,
                        course_name: selected?.course_name || "",
                      }));
                    }}
                    required
                  >
                    <option value="">Chọn môn học</option>
                    {courseOptions.map((course) => (
                      <option key={`${course.term_id || "termless"}-${course.course_id}`} value={course.course_id}>
                        {course.course_name} ({course.course_code})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-group">
                  <span>Mã lớp học phần</span>
                  <input value={form.section_code} onChange={(event) => setForm((prev) => ({ ...prev, section_code: event.target.value }))} required />
                </label>
                <label className="field-group">
                  <span>Trạng thái</span>
                  <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <label className="field-group">
                  <span>Capacity</span>
                  <input
                    type="number"
                    min="0"
                    value={form.student_count}
                    onChange={(event) => setForm((prev) => ({ ...prev, student_count: event.target.value }))}
                    placeholder="Sĩ số dự kiến"
                  />
                </label>
              </div>

              <div className="inline-form">
                <label className="field-group">
                  <span>Tìm giảng viên</span>
                  <input
                    value={teacherSearch}
                    onChange={(event) => setTeacherSearch(event.target.value)}
                    placeholder="Lọc theo tên hoặc mã giảng viên"
                  />
                </label>
                <label className="field-group">
                  <span>Giảng viên</span>
                  <select
                    value={form.teacher_external_id}
                    onChange={(event) => setForm((prev) => ({ ...prev, teacher_external_id: event.target.value }))}
                  >
                    <option value="">Chưa gán giảng viên</option>
                    {filteredTeacherOptions.map((teacher) => (
                      <option key={teacher.teacher_id} value={teacher.teacher_id}>
                        {teacher.teacher_name} ({teacher.teacher_id})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field-group">
                <span>Notes</span>
                <textarea
                  rows="4"
                  value={form.note}
                  onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                  placeholder="Ghi chú nội bộ cho lớp học phần"
                />
              </label>

              <div className="button-row">
                <button className="primary-button" type="submit" disabled={submitting}>
                  {submitting ? "Đang lưu..." : form.id ? "Cập nhật lớp học phần" : "Tạo lớp học phần"}
                </button>
                <button className="secondary-button" type="button" onClick={resetModal}>
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
