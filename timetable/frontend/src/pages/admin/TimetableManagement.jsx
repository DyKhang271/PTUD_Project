import { useEffect, useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import StatusBadge from "../../components/StatusBadge";
import {
  createTimetableEntry,
  deleteTimetableEntry,
  fetchCourseSections,
  fetchCourseSubjects,
  fetchTerms,
  fetchTimetableCourseGroups,
  updateTimetableEntry,
} from "../../services/adminApi";

const DAY_OPTIONS = [
  { value: 2, label: "Thứ 2" },
  { value: 3, label: "Thứ 3" },
  { value: 4, label: "Thứ 4" },
  { value: 5, label: "Thứ 5" },
  { value: 6, label: "Thứ 6" },
  { value: 7, label: "Thứ 7" },
  { value: 1, label: "Chủ nhật" },
];

const SCHEDULED_TOGGLES = [
  { value: "all", label: "Tất cả" },
  { value: "scheduled", label: "Đã xếp lịch" },
  { value: "unscheduled", label: "Chưa xếp lịch" },
  { value: "unclassified", label: "Chưa phân loại" },
];

const initialFilters = {
  term_id: "",
  faculty: "",
  program: "",
  curriculum_semester: "",
  course_id: "",
  q: "",
  scheduled_status: "all",
};

const initialTimetableForm = {
  id: "",
  term_id: "",
  faculty: "",
  program: "",
  curriculum_semester: "",
  course_id: "",
  section_id: "",
  day_of_week: "2",
  start_time: "",
  end_time: "",
  room: "",
  location: "",
  status: "published",
};

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right, "vi"));
}

function formatDay(dayOfWeek) {
  return DAY_OPTIONS.find((option) => option.value === dayOfWeek)?.label || `Thứ ${dayOfWeek}`;
}

function formatTimeRange(startTime, endTime) {
  if (startTime && endTime) return `${startTime} - ${endTime}`;
  if (startTime) return startTime;
  if (endTime) return endTime;
  return "--";
}

function buildGroupParams(filters, contextReady, isUnclassifiedMode) {
  if (!filters.term_id) return null;
  if (!isUnclassifiedMode && !contextReady) return null;
  return {
    term_id: filters.term_id,
    faculty: isUnclassifiedMode ? undefined : filters.faculty || undefined,
    program: isUnclassifiedMode ? undefined : filters.program || undefined,
    curriculum_semester: filters.curriculum_semester || undefined,
    course_id: filters.course_id || undefined,
    q: filters.q || undefined,
    scheduled_status: filters.scheduled_status,
  };
}

export default function TimetableManagement() {
  const [state, setState] = useState({
    loading: true,
    error: "",
    terms: [],
    subjects: [],
    courseGroups: [],
    sections: [],
  });
  const [filters, setFilters] = useState(initialFilters);
  const [feedback, setFeedback] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [timetableForm, setTimetableForm] = useState(initialTimetableForm);

  const contextReady = Boolean(filters.term_id && filters.faculty && filters.program);
  const isUnclassifiedMode = filters.scheduled_status === "unclassified";

  async function loadView(activeFilters = filters) {
    const nextContextReady = Boolean(activeFilters.term_id && activeFilters.faculty && activeFilters.program);
    const nextUnclassifiedMode = activeFilters.scheduled_status === "unclassified";
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const termPromise = state.terms.length ? Promise.resolve(state.terms) : fetchTerms();
      const subjectParams = activeFilters.term_id
        ? {
            term_id: activeFilters.term_id,
            faculty: nextUnclassifiedMode ? undefined : activeFilters.faculty || undefined,
            program: nextUnclassifiedMode ? undefined : activeFilters.program || undefined,
            curriculum_semester: activeFilters.curriculum_semester || undefined,
          }
        : null;
      const groupParams = buildGroupParams(activeFilters, nextContextReady, nextUnclassifiedMode);
      const sectionParams = groupParams
        ? {
            term_id: activeFilters.term_id,
            faculty: nextUnclassifiedMode ? undefined : activeFilters.faculty || undefined,
            program: nextUnclassifiedMode ? undefined : activeFilters.program || undefined,
            curriculum_semester: activeFilters.curriculum_semester || undefined,
            course_id: activeFilters.course_id || undefined,
          }
        : null;

      const [terms, subjects, courseGroups, sections] = await Promise.all([
        termPromise,
        subjectParams ? fetchCourseSubjects(subjectParams) : Promise.resolve([]),
        groupParams ? fetchTimetableCourseGroups(groupParams) : Promise.resolve([]),
        sectionParams ? fetchCourseSections(sectionParams) : Promise.resolve([]),
      ]);

      setState({
        loading: false,
        error: "",
        terms,
        subjects,
        courseGroups,
        sections,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err?.response?.data?.detail || "Không tải được module lịch học.",
      }));
    }
  }

  useEffect(() => {
    loadView(initialFilters);
  }, []);

  useEffect(() => {
    if (!state.terms.length) return;
    loadView(filters);
  }, [filters.term_id, filters.faculty, filters.program, filters.curriculum_semester, filters.course_id, filters.q, filters.scheduled_status]);

  useEffect(() => {
    if (!isModalOpen) return;
    setIsModalOpen(false);
    setTimetableForm(initialTimetableForm);
  }, [filters.term_id, filters.faculty, filters.program, filters.curriculum_semester, filters.scheduled_status]);

  const classifiedSubjects = useMemo(
    () => state.subjects.filter((subject) => subject.faculty && subject.program_name),
    [state.subjects],
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

  const timetableFormSections = useMemo(
    () =>
      state.sections.filter((section) => {
        if (timetableForm.course_id && section.course_code !== timetableForm.course_id) return false;
        return true;
      }),
    [state.sections, timetableForm.course_id],
  );

  async function refreshCurrentView() {
    await loadView(filters);
  }

  function openCreateModal() {
    if (!contextReady || isUnclassifiedMode) {
      setFeedback("Vui lòng chọn đủ Học kỳ, Khoa và Ngành / Chương trình trước khi tạo lịch.");
      return;
    }
    setFeedback("");
    setTimetableForm({
      ...initialTimetableForm,
      term_id: filters.term_id,
      faculty: filters.faculty,
      program: filters.program,
      curriculum_semester: filters.curriculum_semester,
      course_id: filters.course_id,
    });
    setIsModalOpen(true);
  }

  function openEditModal(item) {
    setFeedback("");
    setTimetableForm({
      id: item.id,
      term_id: item.term_id || filters.term_id,
      faculty: item.faculty || "",
      program: item.program_name || "",
      curriculum_semester: filters.curriculum_semester,
      course_id: item.course_code || "",
      section_id: item.section_id,
      day_of_week: String(item.day_of_week),
      start_time: item.start_time || "",
      end_time: item.end_time || "",
      room: item.room || "",
      location: item.location || "",
      status: item.status || "published",
    });
    setIsModalOpen(true);
  }

  async function saveTimetable(event) {
    event.preventDefault();
    if (!timetableForm.term_id || !timetableForm.faculty || !timetableForm.program) {
      setFeedback("Không thể lưu lịch nếu thiếu Học kỳ, Khoa hoặc Ngành / Chương trình.");
      return;
    }
    const payload = {
      section_id: timetableForm.section_id,
      day_of_week: Number(timetableForm.day_of_week),
      start_time: timetableForm.start_time || null,
      end_time: timetableForm.end_time || null,
      room: timetableForm.room || null,
      location: timetableForm.location || null,
      status: timetableForm.status || "published",
    };
    try {
      if (timetableForm.id) {
        await updateTimetableEntry(timetableForm.id, payload);
        setFeedback("Đã cập nhật lịch học.");
      } else {
        await createTimetableEntry(payload);
        setFeedback("Đã tạo lịch học.");
      }
      setIsModalOpen(false);
      setTimetableForm(initialTimetableForm);
      await refreshCurrentView();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Không thể lưu lịch học.");
    }
  }

  async function removeTimetable(entryId) {
    try {
      await deleteTimetableEntry(entryId);
      await refreshCurrentView();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Không thể xóa lịch học.");
    }
  }

  function updateFilters(patch) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  const needsContextSelection = !isUnclassifiedMode && !contextReady;
  const unclassifiedNeedsTerm = isUnclassifiedMode && !filters.term_id;
  const currentCourseGroups = state.courseGroups;

  if (state.loading && !state.terms.length) {
    return <LoadingState label="Đang tải module lịch học..." />;
  }
  if (state.error && !state.terms.length) {
    return <ErrorState message={state.error} onRetry={() => loadView(filters)} />;
  }

  return (
    <div className="section-stack">
      <div className="page-header">
        <h2 className="page-title">Quản lý lịch học</h2>
        <p className="page-subtitle">
          Chọn ngữ cảnh học vụ trước khi thao tác dữ liệu để admin chỉ nhìn thấy đúng lịch học thuộc học kỳ, khoa và ngành đang quản lý.
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
                  curriculum_semester: "",
                  course_id: "",
                  q: "",
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
                  curriculum_semester: "",
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
                  curriculum_semester: "",
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
            <span>Học kỳ CT</span>
            <select
              value={filters.curriculum_semester}
              disabled={!contextReady || isUnclassifiedMode}
              onChange={(event) => updateFilters({ curriculum_semester: event.target.value })}
            >
              <option value="">Tất cả</option>
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
              {courseOptions.map((subject) => (
                <option key={`${subject.term_id || "termless"}-${subject.course_id}`} value={subject.course_id}>
                  {subject.course_name} ({subject.course_code})
                </option>
              ))}
            </select>
          </label>

          <label className="field-group">
            <span>Tìm kiếm</span>
            <input
              type="search"
              placeholder="Tên môn, mã lớp, phòng, giảng viên..."
              value={filters.q}
              onChange={(event) => updateFilters({ q: event.target.value })}
            />
          </label>
        </div>

        <div className="admin-toolbar-actions">
          <div className="admin-toggle-group" role="tablist" aria-label="Lọc trạng thái xếp lịch">
            {SCHEDULED_TOGGLES.map((toggle) => (
              <button
                key={toggle.value}
                type="button"
                className={`admin-toggle-chip ${filters.scheduled_status === toggle.value ? "is-active" : ""}`}
                onClick={() =>
                  updateFilters({
                    scheduled_status: toggle.value,
                    faculty: toggle.value === "unclassified" ? "" : filters.faculty,
                    program: toggle.value === "unclassified" ? "" : filters.program,
                    curriculum_semester: toggle.value === "unclassified" ? "" : filters.curriculum_semester,
                    course_id: "",
                  })
                }
              >
                {toggle.label}
              </button>
            ))}
          </div>

          <div className="button-row">
            <button className="secondary-button" type="button" onClick={refreshCurrentView}>
              Tải lại
            </button>
            <button className="primary-button" type="button" onClick={openCreateModal} disabled={!contextReady || isUnclassifiedMode}>
              Tạo lịch
            </button>
          </div>
        </div>
      </div>

      {feedback ? <div className="state-card">{feedback}</div> : null}
      {state.loading ? <LoadingState label="Đang cập nhật dữ liệu lịch học..." /> : null}
      {state.error ? <ErrorState message={state.error} onRetry={refreshCurrentView} /> : null}

      {needsContextSelection ? (
        <EmptyState message="Vui lòng chọn Học kỳ, Khoa và Ngành/Chương trình để xem lịch học." />
      ) : null}

      {unclassifiedNeedsTerm ? (
        <EmptyState message="Vui lòng chọn Học kỳ để xem dữ liệu chưa phân loại." />
      ) : null}

      {isUnclassifiedMode && filters.term_id ? (
        <div className="state-card state-warning">
          <strong>Dữ liệu chưa phân loại</strong>
          <div className="helper-text">Các lớp học phần này chưa được map đủ metadata học vụ.</div>
        </div>
      ) : null}

      {!needsContextSelection && !unclassifiedNeedsTerm ? (
        <div className="panel section-stack">
          <div className="admin-group-heading">
            <div>
              <h3 className="page-title">{isUnclassifiedMode ? "Lịch học chưa phân loại" : "Danh sách lịch học theo môn"}</h3>
              <p className="page-subtitle">
                {isUnclassifiedMode
                  ? "Chỉ hiển thị các lớp học phần còn thiếu metadata khoa/ngành."
                  : "Mỗi thẻ là một môn học trong context đang chọn; admin thao tác trực tiếp trên các lịch thuộc môn đó."}
              </p>
            </div>
            <div className="helper-text">
              {currentCourseGroups.length} môn học
            </div>
          </div>

          {currentCourseGroups.length ? (
            <div className="admin-course-card-grid">
              {currentCourseGroups.map((course) => (
                <article key={`${course.term_id || "termless"}-${course.course_code}`} className="admin-course-card">
                  <div className="admin-course-card-head">
                    <div className="section-stack">
                      <div className="eyebrow">Môn học</div>
                      <div>
                        <h4>{course.course_name}</h4>
                        <p>{course.course_code}</p>
                      </div>
                    </div>
                    <div className="admin-course-card-metrics">
                      <span>{course.section_count} lớp học phần</span>
                      <strong>{course.scheduled_count} lịch đã xếp</strong>
                    </div>
                  </div>

                  {course.schedules.length ? (
                    <div className="admin-schedule-list">
                      {course.schedules.map((item) => (
                        <div key={item.id} className="admin-schedule-row">
                          <div className="admin-schedule-primary">
                            <strong>{item.section_code}</strong>
                            <span>
                              {formatDay(item.day_of_week)} • {formatTimeRange(item.start_time, item.end_time)}
                            </span>
                          </div>
                          <div className="admin-schedule-secondary">
                            <span>Phòng: {item.room || "--"}</span>
                            <span>Cơ sở: {item.location || "--"}</span>
                            <span>Giảng viên: {item.teacher_name || item.teacher_external_id || "--"}</span>
                          </div>
                          <div className="admin-schedule-actions">
                            <StatusBadge status={item.status} />
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => openEditModal(item)}
                              disabled={isUnclassifiedMode}
                            >
                              Sửa
                            </button>
                            <button className="danger-button" type="button" onClick={() => removeTimetable(item.id)}>
                              Xóa
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="admin-course-empty">Chưa có lịch cho môn này.</div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState message={isUnclassifiedMode ? "Không có dữ liệu chưa phân loại trong bộ lọc hiện tại." : "Chưa có môn học thuộc ngữ cảnh đang chọn."} />
          )}
        </div>
      ) : null}

      {isModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel">
            <form className="form-grid" onSubmit={saveTimetable}>
              <div className="admin-modal-head">
                <div>
                  <h3>{timetableForm.id ? "Cập nhật lịch học" : "Tạo lịch học"}</h3>
                  <p className="page-subtitle">
                    Context hiện tại: {timetableForm.term_id ? "đã chọn học kỳ" : "chưa có học kỳ"} • {timetableForm.faculty || "chưa có khoa"} • {timetableForm.program || "chưa có ngành"}
                  </p>
                </div>
                <button className="secondary-button" type="button" onClick={() => setIsModalOpen(false)}>
                  Đóng
                </button>
              </div>

              <div className="inline-form">
                <label className="field-group">
                  <span>Học kỳ</span>
                  <input value={state.terms.find((term) => term.id === timetableForm.term_id)?.term_code || ""} readOnly />
                </label>
                <label className="field-group">
                  <span>Khoa</span>
                  <input value={timetableForm.faculty} readOnly />
                </label>
                <label className="field-group">
                  <span>Ngành / Chương trình</span>
                  <input value={timetableForm.program} readOnly />
                </label>
                <label className="field-group">
                  <span>Học kỳ CT</span>
                  <input value={timetableForm.curriculum_semester || "--"} readOnly />
                </label>
              </div>

              <div className="inline-form">
                <label className="field-group">
                  <span>Môn học</span>
                  <select
                    value={timetableForm.course_id}
                    onChange={(event) => setTimetableForm((prev) => ({ ...prev, course_id: event.target.value, section_id: "" }))}
                    required
                  >
                    <option value="">Chọn môn học</option>
                    {courseOptions.map((subject) => (
                      <option key={`${subject.term_id || "termless"}-${subject.course_id}`} value={subject.course_id}>
                        {subject.course_name} ({subject.course_code})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-group">
                  <span>Lớp học phần</span>
                  <select
                    value={timetableForm.section_id}
                    onChange={(event) => setTimetableForm((prev) => ({ ...prev, section_id: event.target.value }))}
                    required
                  >
                    <option value="">Chọn lớp học phần</option>
                    {timetableFormSections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.section_code} - {section.course_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-group">
                  <span>Thứ</span>
                  <select value={timetableForm.day_of_week} onChange={(event) => setTimetableForm((prev) => ({ ...prev, day_of_week: event.target.value }))}>
                    {DAY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-group">
                  <span>Trạng thái</span>
                  <select value={timetableForm.status} onChange={(event) => setTimetableForm((prev) => ({ ...prev, status: event.target.value }))}>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
              </div>

              <div className="inline-form">
                <label className="field-group">
                  <span>Giờ bắt đầu</span>
                  <input type="time" value={timetableForm.start_time} onChange={(event) => setTimetableForm((prev) => ({ ...prev, start_time: event.target.value }))} />
                </label>
                <label className="field-group">
                  <span>Giờ kết thúc</span>
                  <input type="time" value={timetableForm.end_time} onChange={(event) => setTimetableForm((prev) => ({ ...prev, end_time: event.target.value }))} />
                </label>
                <label className="field-group">
                  <span>Phòng</span>
                  <input value={timetableForm.room} onChange={(event) => setTimetableForm((prev) => ({ ...prev, room: event.target.value }))} />
                </label>
                <label className="field-group">
                  <span>Cơ sở</span>
                  <input value={timetableForm.location} onChange={(event) => setTimetableForm((prev) => ({ ...prev, location: event.target.value }))} />
                </label>
              </div>

              <div className="button-row">
                <button className="primary-button" type="submit">
                  {timetableForm.id ? "Lưu thay đổi" : "Tạo lịch"}
                </button>
                <button className="secondary-button" type="button" onClick={() => setIsModalOpen(false)}>
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
