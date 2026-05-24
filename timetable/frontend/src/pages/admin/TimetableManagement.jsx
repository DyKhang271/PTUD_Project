import { useEffect, useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import StatusBadge from "../../components/StatusBadge";
import {
  cleanupInvalidTimetableEntries,
  createExam,
  createTimetableEntry,
  deleteExam,
  deleteTimetableEntry,
  fetchExamCourseGroups,
  fetchCourseSections,
  fetchCourseSubjects,
  fetchInvalidTimetableEntries,
  fetchTerms,
  fetchTimetableCourseGroups,
  updateExam,
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

const TAB_OPTIONS = [
  { value: "timetable", label: "Lịch học" },
  { value: "exam", label: "Lịch thi" },
];

const EXAM_TYPE_OPTIONS = [
  { value: "", label: "Chọn hình thức thi" },
  { value: "Giữa kỳ", label: "Giữa kỳ" },
  { value: "Cuối kỳ", label: "Cuối kỳ" },
];

const SESSION_TYPE_OPTIONS = [
  { value: "theory", label: "Lý thuyết" },
  { value: "practical", label: "Thực hành" },
  { value: "online", label: "Trực tuyến" },
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
  valid_from: "",
  valid_to: "",
  room: "",
  location: "",
  status: "published",
  session_type: "theory",
};

const initialExamForm = {
  id: "",
  term_id: "",
  faculty: "",
  program: "",
  curriculum_semester: "",
  course_id: "",
  section_id: "",
  exam_date: "",
  start_time: "",
  end_time: "",
  room: "",
  location: "",
  exam_type: "",
  status: "scheduled",
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
    examGroups: [],
    invalidEntries: [],
  });
  const [filters, setFilters] = useState(initialFilters);
  const [feedback, setFeedback] = useState("");
  const [activeTab, setActiveTab] = useState("timetable");
  const [modalType, setModalType] = useState(null);
  const [timetableForm, setTimetableForm] = useState(initialTimetableForm);
  const [examForm, setExamForm] = useState(initialExamForm);

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

      const invalidParams = activeFilters.term_id ? { term_id: activeFilters.term_id } : {};
      const [terms, subjects, courseGroups, sections, examGroups, invalidEntries] = await Promise.all([
        termPromise,
        subjectParams ? fetchCourseSubjects(subjectParams) : Promise.resolve([]),
        groupParams ? fetchTimetableCourseGroups(groupParams) : Promise.resolve([]),
        sectionParams ? fetchCourseSections(sectionParams) : Promise.resolve([]),
        groupParams ? fetchExamCourseGroups(groupParams) : Promise.resolve([]),
        activeFilters.term_id ? fetchInvalidTimetableEntries(invalidParams) : Promise.resolve([]),
      ]);

      setState({
        loading: false,
        error: "",
        terms,
        subjects,
        courseGroups,
        sections,
        examGroups,
        invalidEntries,
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
    if (!modalType) return;
    setModalType(null);
    setTimetableForm(initialTimetableForm);
    setExamForm(initialExamForm);
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

  const formSections = useMemo(() => {
    const targetCourseId = modalType === "exam" ? examForm.course_id : timetableForm.course_id;
    return state.sections.filter((section) => {
      if (targetCourseId && section.course_code !== targetCourseId) return false;
      return true;
    });
  }, [state.sections, modalType, examForm.course_id, timetableForm.course_id]);

  const sectionsById = useMemo(() => new Map(state.sections.map((section) => [section.id, section])), [state.sections]);
  const termsById = useMemo(() => new Map(state.terms.map((term) => [term.id, term])), [state.terms]);

  async function refreshCurrentView() {
    await loadView(filters);
  }

  async function runInvalidCleanup() {
    if (!filters.term_id) {
      setFeedback("Vui lòng chọn học kỳ trước khi dọn dữ liệu lịch lỗi.");
      return;
    }
    try {
      const result = await cleanupInvalidTimetableEntries({ term_id: filters.term_id });
      const message = result.marked_invalid_count
        ? `Đã đánh dấu ${result.marked_invalid_count}/${result.detected_count} lịch lỗi là cancelled.`
        : result.detected_count
          ? `Đã phát hiện ${result.detected_count} lịch lỗi nhưng không có bản ghi mới cần đánh dấu thêm.`
          : "Không phát hiện lịch lỗi trong học kỳ đang chọn.";
      setFeedback(message);
      await refreshCurrentView();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Không thể dọn dữ liệu lịch lỗi.");
    }
  }

  function openTimetableModal(entry = null) {
    if (!contextReady || isUnclassifiedMode) {
      setFeedback("Vui lòng chọn đủ Học kỳ, Khoa và Ngành / Chương trình trước khi tạo lịch học.");
      return;
    }
    const activeTerm = termsById.get(entry?.term_id || filters.term_id);
    setFeedback("");
    setTimetableForm(
      entry
        ? {
            id: entry.id,
            term_id: entry.term_id || filters.term_id,
            faculty: entry.faculty || filters.faculty,
            program: entry.program_name || filters.program,
            curriculum_semester: filters.curriculum_semester,
            course_id: entry.course_code || "",
            section_id: entry.section_id,
            day_of_week: String(entry.day_of_week),
            start_time: entry.start_time || "",
            end_time: entry.end_time || "",
            valid_from: entry.valid_from || activeTerm?.start_date || "",
            valid_to: entry.valid_to || activeTerm?.end_date || "",
            room: entry.room || "",
            location: entry.location || "",
            status: entry.status || "published",
            session_type: entry.session_type || "theory",
          }
        : {
            ...initialTimetableForm,
            term_id: filters.term_id,
            faculty: filters.faculty,
            program: filters.program,
            curriculum_semester: filters.curriculum_semester,
            course_id: filters.course_id,
            valid_from: activeTerm?.start_date || "",
            valid_to: activeTerm?.end_date || "",
          },
    );
    setModalType("timetable");
  }

  function openExamModal(exam = null) {
    if (!contextReady || isUnclassifiedMode) {
      setFeedback("Vui lòng chọn đủ Học kỳ, Khoa và Ngành / Chương trình trước khi tạo lịch thi.");
      return;
    }
    setFeedback("");
    const section = exam ? sectionsById.get(exam.section_id) : null;
    setExamForm(
      exam
        ? {
            id: exam.id,
            term_id: section?.term_id || filters.term_id,
            faculty: section?.faculty || filters.faculty,
            program: section?.program_name || filters.program,
            curriculum_semester: filters.curriculum_semester,
            course_id: section?.course_code || "",
            section_id: exam.section_id,
            exam_date: exam.exam_date || "",
            start_time: exam.start_time || "",
            end_time: exam.end_time || "",
            room: exam.room || "",
            location: exam.location || "",
            exam_type: exam.exam_type || "",
            status: exam.status || "scheduled",
          }
        : {
            ...initialExamForm,
            term_id: filters.term_id,
            faculty: filters.faculty,
            program: filters.program,
            curriculum_semester: filters.curriculum_semester,
            course_id: filters.course_id,
          },
    );
    setModalType("exam");
  }

  async function saveTimetable(event) {
    event.preventDefault();
    if (!timetableForm.term_id || !timetableForm.faculty || !timetableForm.program || !timetableForm.section_id) {
      setFeedback("Không thể lưu lịch học nếu thiếu context hoặc chưa chọn lớp học phần.");
      return;
    }
    const payload = {
      section_id: timetableForm.section_id,
      day_of_week: Number(timetableForm.day_of_week),
      start_time: timetableForm.start_time || null,
      end_time: timetableForm.end_time || null,
      valid_from: timetableForm.valid_from || null,
      valid_to: timetableForm.valid_to || null,
      room: timetableForm.room || null,
      location: timetableForm.location || null,
      status: timetableForm.status || "published",
      session_type: timetableForm.session_type || "theory",
    };
    try {
      if (timetableForm.id) {
        await updateTimetableEntry(timetableForm.id, payload);
        setFeedback("Đã cập nhật lịch học.");
      } else {
        await createTimetableEntry(payload);
        setFeedback("Đã tạo lịch học.");
      }
      setModalType(null);
      setTimetableForm(initialTimetableForm);
      await refreshCurrentView();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Không thể lưu lịch học.");
    }
  }

  async function saveExam(event) {
    event.preventDefault();
    if (!examForm.term_id || !examForm.faculty || !examForm.program || !examForm.section_id) {
      setFeedback("Không thể lưu lịch thi nếu thiếu context hoặc chưa chọn lớp học phần.");
      return;
    }
    const payload = {
      section_id: examForm.section_id,
      exam_date: examForm.exam_date,
      start_time: examForm.start_time || null,
      end_time: examForm.end_time || null,
      room: examForm.room || null,
      location: examForm.location || null,
      exam_type: examForm.exam_type || null,
      status: examForm.status || "scheduled",
    };
    try {
      if (examForm.id) {
        await updateExam(examForm.id, payload);
        setFeedback("Đã cập nhật lịch thi.");
      } else {
        await createExam(payload);
        setFeedback("Đã tạo lịch thi.");
      }
      setModalType(null);
      setExamForm(initialExamForm);
      await refreshCurrentView();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Không thể lưu lịch thi.");
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

  async function removeExam(examId) {
    try {
      await deleteExam(examId);
      await refreshCurrentView();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Không thể xóa lịch thi.");
    }
  }

  function updateFilters(patch) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  const needsContextSelection = !isUnclassifiedMode && !contextReady;
  const unclassifiedNeedsTerm = isUnclassifiedMode && !filters.term_id;
  const selectedFilterTerm = termsById.get(filters.term_id);
  const activeTimetableTerm = termsById.get(timetableForm.term_id);
  const activeExamTerm = termsById.get(examForm.term_id);

  if (state.loading && !state.terms.length) return <LoadingState label="Đang tải module lịch học..." />;
  if (state.error && !state.terms.length) return <ErrorState message={state.error} onRetry={() => loadView(filters)} />;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h2 className="page-title">Quản lý lịch học</h2>
          <p className="page-subtitle">
            Chọn ngữ cảnh học vụ trước khi thao tác dữ liệu để admin chỉ nhìn thấy đúng lịch học, lịch thi thuộc học kỳ, khoa và ngành đang quản lý.
          </p>
        </div>
      </div>

      <div className="toolbar-card sticky">
        <div className="filter-grid">
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
            <button className="secondary-button" type="button" onClick={runInvalidCleanup} disabled={!filters.term_id}>
              Dọn lịch lỗi
            </button>
            <button className="primary-button" type="button" onClick={() => openTimetableModal()} disabled={!contextReady || isUnclassifiedMode}>
              Tạo lịch học
            </button>
            <button className="primary-button" type="button" onClick={() => openExamModal()} disabled={!contextReady || isUnclassifiedMode}>
              Tạo lịch thi
            </button>
          </div>
        </div>
      </div>

      {feedback ? <div className="badge info" style={{ display: "block", width: "100%", padding: "12px", borderRadius: "var(--radius-md)" }}>ℹ️ {feedback}</div> : null}
      {selectedFilterTerm && (!selectedFilterTerm.start_date || !selectedFilterTerm.end_date) ? (
        <div className="badge warning" style={{ display: "block", width: "100%", padding: "16px", borderRadius: "var(--radius-md)", textAlign: "left" }}>
          <strong>⚠️ Học kỳ chưa có phạm vi ngày</strong>
          <div style={{ fontSize: "0.85rem", opacity: 0.85, marginTop: "4px" }}>Validation theo thời gian học kỳ sẽ chưa áp dụng đầy đủ cho tới khi học kỳ này được backfill ngày bắt đầu/kết thúc.</div>
        </div>
      ) : null}
      {state.invalidEntries.length ? (
        <div className="badge warning" style={{ display: "block", width: "100%", padding: "16px", borderRadius: "var(--radius-md)", textAlign: "left" }}>
          <strong>⚠️ Phát hiện {state.invalidEntries.length} lịch lỗi trong học kỳ đã chọn</strong>
          <div style={{ fontSize: "0.85rem", opacity: 0.85, marginTop: "4px" }}>Dùng nút “Dọn lịch lỗi” để tự động đánh dấu các bản ghi sai là cancelled.</div>
        </div>
      ) : null}
      {state.loading ? <LoadingState label="Đang cập nhật dữ liệu lịch học..." /> : null}
      {state.error ? <ErrorState message={state.error} onRetry={refreshCurrentView} /> : null}

      {needsContextSelection ? <EmptyState message="Vui lòng chọn Học kỳ, Khoa và Ngành/Chương trình để xem lịch học." /> : null}
      {unclassifiedNeedsTerm ? <EmptyState message="Vui lòng chọn Học kỳ để xem dữ liệu chưa phân loại." /> : null}

      {isUnclassifiedMode && filters.term_id ? (
        <div className="badge warning" style={{ display: "block", width: "100%", padding: "16px", borderRadius: "var(--radius-md)", textAlign: "left", marginBottom: "16px" }}>
          <strong>⚠️ Dữ liệu chưa phân loại</strong>
          <div style={{ fontSize: "0.85rem", opacity: 0.85, marginTop: "4px" }}>Các lớp học phần này chưa được map đủ metadata học vụ.</div>
        </div>
      ) : null}

      {!needsContextSelection && !unclassifiedNeedsTerm ? (
        <div className="data-card section-stack">
          <div className="admin-group-heading">
            <div>
              <h3 className="page-title">{isUnclassifiedMode ? "Dữ liệu lịch chưa phân loại" : "Danh sách lịch theo môn"}</h3>
              <p className="page-subtitle">
                {isUnclassifiedMode
                  ? "Chỉ hiển thị các lớp học phần còn thiếu metadata khoa/ngành."
                  : "Lịch học và lịch thi được tách rõ theo tab nhưng vẫn dùng cùng ngữ cảnh học vụ."}
              </p>
            </div>
            <div className="admin-tab-group" role="tablist" aria-label="Tab lịch học và lịch thi">
              {TAB_OPTIONS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  className={`admin-toggle-chip ${activeTab === tab.value ? "is-active" : ""}`}
                  onClick={() => setActiveTab(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === "timetable" ? (
            state.courseGroups.length ? (
              <div className="admin-course-card-grid">
                {state.courseGroups.map((course) => (
                  <article key={`${course.term_id || "termless"}-${course.course_code}-study`} className="admin-course-card">
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
                              <span>{formatDay(item.day_of_week)} • {formatTimeRange(item.start_time, item.end_time)}</span>
                              <span>Loại buổi: {SESSION_TYPE_OPTIONS.find((option) => option.value === item.session_type)?.label || item.session_type || "--"}</span>
                            </div>
                            <div className="admin-schedule-secondary">
                              <span>Phòng: {item.room || "--"}</span>
                              <span>Cơ sở: {item.location || "--"}</span>
                              <span>Giảng viên: {item.teacher_name || item.teacher_external_id || "--"}</span>
                            </div>
                            <div className="admin-schedule-actions">
                              <StatusBadge status={item.status} />
                              <button className="secondary-button" type="button" onClick={() => openTimetableModal(item)} disabled={isUnclassifiedMode}>
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
            )
          ) : state.examGroups.length ? (
            <div className="admin-course-card-grid">
              {state.examGroups.map((course) => (
                <article key={`${course.term_id || "termless"}-${course.course_code}-exam`} className="admin-course-card">
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
                      <strong>{course.exams.length} lịch thi</strong>
                    </div>
                  </div>

                  {course.exams.length ? (
                    <div className="admin-schedule-list">
                      {course.exams.map((item) => (
                        <div key={item.id} className="admin-schedule-row">
                          <div className="admin-schedule-primary">
                            <strong>{item.section_code}</strong>
                            <span>{item.exam_date} • {formatTimeRange(item.start_time, item.end_time)}</span>
                          </div>
                          <div className="admin-schedule-secondary">
                            <span>Phòng thi: {item.room || "--"}</span>
                            <span>Cơ sở: {item.location || "--"}</span>
                            <span>Hình thức thi: {item.exam_type || "--"}</span>
                          </div>
                          <div className="admin-schedule-actions">
                            <StatusBadge status={item.status || "scheduled"} />
                            <button className="secondary-button" type="button" onClick={() => openExamModal(item)} disabled={isUnclassifiedMode}>
                              Sửa
                            </button>
                            <button className="danger-button" type="button" onClick={() => removeExam(item.id)}>
                              Xóa
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="admin-course-empty">Chưa có lịch thi cho môn/lớp học phần này.</div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState message="Chưa có lịch thi cho môn/lớp học phần này." />
          )}
        </div>
      ) : null}

      {modalType === "timetable" ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel">
            <form className="form-grid" onSubmit={saveTimetable}>
              <div className="admin-modal-head">
                <div>
                  <h3>{timetableForm.id ? "Cập nhật lịch học" : "Tạo lịch học"}</h3>
                  <p className="page-subtitle">
                    Context hiện tại: {state.terms.find((term) => term.id === timetableForm.term_id)?.term_code || "--"} • {timetableForm.faculty || "--"} • {timetableForm.program || "--"}
                  </p>
                  {activeTimetableTerm?.start_date && activeTimetableTerm?.end_date ? (
                    <p className="helper-text">
                      Phạm vi học kỳ: {activeTimetableTerm.start_date} đến {activeTimetableTerm.end_date}
                    </p>
                  ) : null}
                </div>
                <button className="secondary-button" type="button" onClick={() => setModalType(null)}>
                  Đóng
                </button>
              </div>

              <div className="inline-form">
                <label className="field-group">
                  <span>Môn học</span>
                  <select value={timetableForm.course_id} onChange={(event) => setTimetableForm((prev) => ({ ...prev, course_id: event.target.value, section_id: "" }))} required>
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
                  <select value={timetableForm.section_id} onChange={(event) => setTimetableForm((prev) => ({ ...prev, section_id: event.target.value }))} required>
                    <option value="">Chọn lớp học phần</option>
                    {formSections.map((section) => (
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
                <label className="field-group">
                  <span>Loại buổi học</span>
                  <select value={timetableForm.session_type} onChange={(event) => setTimetableForm((prev) => ({ ...prev, session_type: event.target.value }))}>
                    {SESSION_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
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

              <div className="inline-form">
                <label className="field-group">
                  <span>Hiệu lực từ</span>
                  <input type="date" value={timetableForm.valid_from} onChange={(event) => setTimetableForm((prev) => ({ ...prev, valid_from: event.target.value }))} />
                </label>
                <label className="field-group">
                  <span>Hiệu lực đến</span>
                  <input type="date" value={timetableForm.valid_to} onChange={(event) => setTimetableForm((prev) => ({ ...prev, valid_to: event.target.value }))} />
                </label>
              </div>

              <div className="button-row">
                <button className="primary-button" type="submit">{timetableForm.id ? "Lưu lịch học" : "Tạo lịch học"}</button>
                <button className="secondary-button" type="button" onClick={() => setModalType(null)}>
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {modalType === "exam" ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel">
            <form className="form-grid" onSubmit={saveExam}>
              <div className="admin-modal-head">
                <div>
                  <h3>{examForm.id ? "Cập nhật lịch thi" : "Tạo lịch thi"}</h3>
                  <p className="page-subtitle">
                    Context hiện tại: {state.terms.find((term) => term.id === examForm.term_id)?.term_code || "--"} • {examForm.faculty || "--"} • {examForm.program || "--"}
                  </p>
                  {activeExamTerm?.start_date && activeExamTerm?.end_date ? (
                    <p className="helper-text">
                      Phạm vi học kỳ: {activeExamTerm.start_date} đến {activeExamTerm.end_date}
                    </p>
                  ) : null}
                </div>
                <button className="secondary-button" type="button" onClick={() => setModalType(null)}>
                  Đóng
                </button>
              </div>

              <div className="inline-form">
                <label className="field-group">
                  <span>Môn học</span>
                  <select value={examForm.course_id} onChange={(event) => setExamForm((prev) => ({ ...prev, course_id: event.target.value, section_id: "" }))} required>
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
                  <select value={examForm.section_id} onChange={(event) => setExamForm((prev) => ({ ...prev, section_id: event.target.value }))} required>
                    <option value="">Chọn lớp học phần</option>
                    {formSections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.section_code} - {section.course_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-group">
                  <span>Ngày thi</span>
                  <input type="date" value={examForm.exam_date} onChange={(event) => setExamForm((prev) => ({ ...prev, exam_date: event.target.value }))} required />
                </label>
                <label className="field-group">
                  <span>Trạng thái</span>
                  <select value={examForm.status} onChange={(event) => setExamForm((prev) => ({ ...prev, status: event.target.value }))}>
                    <option value="scheduled">Scheduled</option>
                    <option value="draft">Draft</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
              </div>

              <div className="inline-form">
                <label className="field-group">
                  <span>Giờ bắt đầu</span>
                  <input type="time" value={examForm.start_time} onChange={(event) => setExamForm((prev) => ({ ...prev, start_time: event.target.value }))} />
                </label>
                <label className="field-group">
                  <span>Giờ kết thúc</span>
                  <input type="time" value={examForm.end_time} onChange={(event) => setExamForm((prev) => ({ ...prev, end_time: event.target.value }))} />
                </label>
                <label className="field-group">
                  <span>Phòng thi</span>
                  <input value={examForm.room} onChange={(event) => setExamForm((prev) => ({ ...prev, room: event.target.value }))} />
                </label>
                <label className="field-group">
                  <span>Cơ sở</span>
                  <input value={examForm.location} onChange={(event) => setExamForm((prev) => ({ ...prev, location: event.target.value }))} />
                </label>
              </div>

              <div className="inline-form">
                <label className="field-group">
                  <span>Hình thức thi</span>
                  <select value={examForm.exam_type} onChange={(event) => setExamForm((prev) => ({ ...prev, exam_type: event.target.value }))} required>
                    {EXAM_TYPE_OPTIONS.map((option) => (
                      <option key={option.label} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="button-row">
                <button className="primary-button" type="submit">{examForm.id ? "Lưu lịch thi" : "Tạo lịch thi"}</button>
                <button className="secondary-button" type="button" onClick={() => setModalType(null)}>
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

