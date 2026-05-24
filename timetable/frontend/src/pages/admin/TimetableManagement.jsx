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
  { value: 2, label: "Thá»© 2" },
  { value: 3, label: "Thá»© 3" },
  { value: 4, label: "Thá»© 4" },
  { value: 5, label: "Thá»© 5" },
  { value: 6, label: "Thá»© 6" },
  { value: 7, label: "Thá»© 7" },
  { value: 1, label: "Chá»§ nháº­t" },
];

const SCHEDULED_TOGGLES = [
  { value: "all", label: "Táº¥t cáº£" },
  { value: "scheduled", label: "ÄÃ£ xáº¿p lá»‹ch" },
  { value: "unscheduled", label: "ChÆ°a xáº¿p lá»‹ch" },
  { value: "unclassified", label: "ChÆ°a phÃ¢n loáº¡i" },
];

const TAB_OPTIONS = [
  { value: "timetable", label: "Lá»‹ch há»c" },
  { value: "exam", label: "Lá»‹ch thi" },
];

const EXAM_TYPE_OPTIONS = [
  { value: "", label: "Chá»n hÃ¬nh thá»©c thi" },
  { value: "Giá»¯a ká»³", label: "Giá»¯a ká»³" },
  { value: "Cuá»‘i ká»³", label: "Cuá»‘i ká»³" },
];

const SESSION_TYPE_OPTIONS = [
  { value: "theory", label: "LÃ½ thuyáº¿t" },
  { value: "practical", label: "Thá»±c hÃ nh" },
  { value: "online", label: "Trá»±c tuyáº¿n" },
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
  return DAY_OPTIONS.find((option) => option.value === dayOfWeek)?.label || `Thá»© ${dayOfWeek}`;
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
        error: err?.response?.data?.detail || "KhÃ´ng táº£i Ä‘Æ°á»£c module lá»‹ch há»c.",
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
      setFeedback("Vui lÃ²ng chá»n há»c ká»³ trÆ°á»›c khi dá»n dá»¯ liá»‡u lá»‹ch lá»—i.");
      return;
    }
    try {
      const result = await cleanupInvalidTimetableEntries({ term_id: filters.term_id });
      const message = result.marked_invalid_count
        ? `ÄÃ£ Ä‘Ã¡nh dáº¥u ${result.marked_invalid_count}/${result.detected_count} lá»‹ch lá»—i lÃ  cancelled.`
        : result.detected_count
          ? `ÄÃ£ phÃ¡t hiá»‡n ${result.detected_count} lá»‹ch lá»—i nhÆ°ng khÃ´ng cÃ³ báº£n ghi má»›i cáº§n Ä‘Ã¡nh dáº¥u thÃªm.`
          : "KhÃ´ng phÃ¡t hiá»‡n lá»‹ch lá»—i trong há»c ká»³ Ä‘ang chá»n.";
      setFeedback(message);
      await refreshCurrentView();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "KhÃ´ng thá»ƒ dá»n dá»¯ liá»‡u lá»‹ch lá»—i.");
    }
  }

  function openTimetableModal(entry = null) {
    if (!contextReady || isUnclassifiedMode) {
      setFeedback("Vui lÃ²ng chá»n Ä‘á»§ Há»c ká»³, Khoa vÃ  NgÃ nh / ChÆ°Æ¡ng trÃ¬nh trÆ°á»›c khi táº¡o lá»‹ch há»c.");
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
      setFeedback("Vui lÃ²ng chá»n Ä‘á»§ Há»c ká»³, Khoa vÃ  NgÃ nh / ChÆ°Æ¡ng trÃ¬nh trÆ°á»›c khi táº¡o lá»‹ch thi.");
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
      setFeedback("KhÃ´ng thá»ƒ lÆ°u lá»‹ch há»c náº¿u thiáº¿u context hoáº·c chÆ°a chá»n lá»›p há»c pháº§n.");
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
        setFeedback("ÄÃ£ cáº­p nháº­t lá»‹ch há»c.");
      } else {
        await createTimetableEntry(payload);
        setFeedback("ÄÃ£ táº¡o lá»‹ch há»c.");
      }
      setModalType(null);
      setTimetableForm(initialTimetableForm);
      await refreshCurrentView();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "KhÃ´ng thá»ƒ lÆ°u lá»‹ch há»c.");
    }
  }

  async function saveExam(event) {
    event.preventDefault();
    if (!examForm.term_id || !examForm.faculty || !examForm.program || !examForm.section_id) {
      setFeedback("KhÃ´ng thá»ƒ lÆ°u lá»‹ch thi náº¿u thiáº¿u context hoáº·c chÆ°a chá»n lá»›p há»c pháº§n.");
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
        setFeedback("ÄÃ£ cáº­p nháº­t lá»‹ch thi.");
      } else {
        await createExam(payload);
        setFeedback("ÄÃ£ táº¡o lá»‹ch thi.");
      }
      setModalType(null);
      setExamForm(initialExamForm);
      await refreshCurrentView();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "KhÃ´ng thá»ƒ lÆ°u lá»‹ch thi.");
    }
  }

  async function removeTimetable(entryId) {
    try {
      await deleteTimetableEntry(entryId);
      await refreshCurrentView();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "KhÃ´ng thá»ƒ xÃ³a lá»‹ch há»c.");
    }
  }

  async function removeExam(examId) {
    try {
      await deleteExam(examId);
      await refreshCurrentView();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "KhÃ´ng thá»ƒ xÃ³a lá»‹ch thi.");
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

  if (state.loading && !state.terms.length) return <LoadingState label="Äang táº£i module lá»‹ch há»c..." />;
  if (state.error && !state.terms.length) return <ErrorState message={state.error} onRetry={() => loadView(filters)} />;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h2 className="page-title">Quáº£n lÃ½ lá»‹ch há»c</h2>
          <p className="page-subtitle">
            Chá»n ngá»¯ cáº£nh há»c vá»¥ trÆ°á»›c khi thao tÃ¡c dá»¯ liá»‡u Ä‘á»ƒ admin chá»‰ nhÃ¬n tháº¥y Ä‘Ãºng lá»‹ch há»c, lá»‹ch thi thuá»™c há»c ká»³, khoa vÃ  ngÃ nh Ä‘ang quáº£n lÃ½.
          </p>
        </div>
      </div>

      <div className="toolbar-card sticky">
        <div className="filter-grid">
          <label className="field-group">
            <span>Há»c ká»³</span>
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
              <option value="">Chá»n há»c ká»³</option>
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
              <option value="">Chá»n khoa</option>
              {facultyOptions.map((faculty) => (
                <option key={faculty} value={faculty}>
                  {faculty}
                </option>
              ))}
            </select>
          </label>

          <label className="field-group">
            <span>NgÃ nh / ChÆ°Æ¡ng trÃ¬nh</span>
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
              <option value="">Chá»n ngÃ nh / chÆ°Æ¡ng trÃ¬nh</option>
              {programOptions.map((program) => (
                <option key={program} value={program}>
                  {program}
                </option>
              ))}
            </select>
          </label>

          <label className="field-group">
            <span>Há»c ká»³ CT</span>
            <select
              value={filters.curriculum_semester}
              disabled={!contextReady || isUnclassifiedMode}
              onChange={(event) => updateFilters({ curriculum_semester: event.target.value })}
            >
              <option value="">Táº¥t cáº£</option>
            </select>
          </label>

          <label className="field-group">
            <span>MÃ´n há»c</span>
            <select
              value={filters.course_id}
              disabled={!contextReady || isUnclassifiedMode}
              onChange={(event) => updateFilters({ course_id: event.target.value })}
            >
              <option value="">Táº¥t cáº£ mÃ´n há»c</option>
              {courseOptions.map((subject) => (
                <option key={`${subject.term_id || "termless"}-${subject.course_id}`} value={subject.course_id}>
                  {subject.course_name} ({subject.course_code})
                </option>
              ))}
            </select>
          </label>

          <label className="field-group">
            <span>TÃ¬m kiáº¿m</span>
            <input
              type="search"
              placeholder="TÃªn mÃ´n, mÃ£ lá»›p, phÃ²ng, giáº£ng viÃªn..."
              value={filters.q}
              onChange={(event) => updateFilters({ q: event.target.value })}
            />
          </label>
        </div>

        <div className="admin-toolbar-actions">
          <div className="admin-toggle-group" role="tablist" aria-label="Lá»c tráº¡ng thÃ¡i xáº¿p lá»‹ch">
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
              Táº£i láº¡i
            </button>
            <button className="secondary-button" type="button" onClick={runInvalidCleanup} disabled={!filters.term_id}>
              Dá»n lá»‹ch lá»—i
            </button>
            <button className="primary-button" type="button" onClick={() => openTimetableModal()} disabled={!contextReady || isUnclassifiedMode}>
              Táº¡o lá»‹ch há»c
            </button>
            <button className="primary-button" type="button" onClick={() => openExamModal()} disabled={!contextReady || isUnclassifiedMode}>
              Táº¡o lá»‹ch thi
            </button>
          </div>
        </div>
      </div>

      {feedback ? <div className="badge info" style={{ display: "block", width: "100%", padding: "12px", borderRadius: "var(--radius-md)" }}>â„¹ï¸ {feedback}</div> : null}
      {selectedFilterTerm && (!selectedFilterTerm.start_date || !selectedFilterTerm.end_date) ? (
        <div className="badge warning" style={{ display: "block", width: "100%", padding: "16px", borderRadius: "var(--radius-md)", textAlign: "left" }}>
          <strong>âš ï¸ Há»c ká»³ chÆ°a cÃ³ pháº¡m vi ngÃ y</strong>
          <div style={{ fontSize: "0.85rem", opacity: 0.85, marginTop: "4px" }}>Validation theo thá»i gian há»c ká»³ sáº½ chÆ°a Ã¡p dá»¥ng Ä‘áº§y Ä‘á»§ cho tá»›i khi há»c ká»³ nÃ y Ä‘Æ°á»£c backfill ngÃ y báº¯t Ä‘áº§u/káº¿t thÃºc.</div>
        </div>
      ) : null}
      {state.invalidEntries.length ? (
        <div className="badge warning" style={{ display: "block", width: "100%", padding: "16px", borderRadius: "var(--radius-md)", textAlign: "left" }}>
          <strong>âš ï¸ PhÃ¡t hiá»‡n {state.invalidEntries.length} lá»‹ch lá»—i trong há»c ká»³ Ä‘Ã£ chá»n</strong>
          <div style={{ fontSize: "0.85rem", opacity: 0.85, marginTop: "4px" }}>DÃ¹ng nÃºt â€œDá»n lá»‹ch lá»—iâ€ Ä‘á»ƒ tá»± Ä‘á»™ng Ä‘Ã¡nh dáº¥u cÃ¡c báº£n ghi sai lÃ  cancelled.</div>
        </div>
      ) : null}
      {state.loading ? <LoadingState label="Äang cáº­p nháº­t dá»¯ liá»‡u lá»‹ch há»c..." /> : null}
      {state.error ? <ErrorState message={state.error} onRetry={refreshCurrentView} /> : null}

      {needsContextSelection ? <EmptyState message="Vui lÃ²ng chá»n Há»c ká»³, Khoa vÃ  NgÃ nh/ChÆ°Æ¡ng trÃ¬nh Ä‘á»ƒ xem lá»‹ch há»c." /> : null}
      {unclassifiedNeedsTerm ? <EmptyState message="Vui lÃ²ng chá»n Há»c ká»³ Ä‘á»ƒ xem dá»¯ liá»‡u chÆ°a phÃ¢n loáº¡i." /> : null}

      {isUnclassifiedMode && filters.term_id ? (
        <div className="badge warning" style={{ display: "block", width: "100%", padding: "16px", borderRadius: "var(--radius-md)", textAlign: "left", marginBottom: "16px" }}>
          <strong>âš ï¸ Dá»¯ liá»‡u chÆ°a phÃ¢n loáº¡i</strong>
          <div style={{ fontSize: "0.85rem", opacity: 0.85, marginTop: "4px" }}>CÃ¡c lá»›p há»c pháº§n nÃ y chÆ°a Ä‘Æ°á»£c map Ä‘á»§ metadata há»c vá»¥.</div>
        </div>
      ) : null}

      {!needsContextSelection && !unclassifiedNeedsTerm ? (
        <div className="data-card section-stack">
          <div className="admin-group-heading">
            <div>
              <h3 className="page-title">{isUnclassifiedMode ? "Dá»¯ liá»‡u lá»‹ch chÆ°a phÃ¢n loáº¡i" : "Danh sÃ¡ch lá»‹ch theo mÃ´n"}</h3>
              <p className="page-subtitle">
                {isUnclassifiedMode
                  ? "Chá»‰ hiá»ƒn thá»‹ cÃ¡c lá»›p há»c pháº§n cÃ²n thiáº¿u metadata khoa/ngÃ nh."
                  : "Lá»‹ch há»c vÃ  lá»‹ch thi Ä‘Æ°á»£c tÃ¡ch rÃµ theo tab nhÆ°ng váº«n dÃ¹ng cÃ¹ng ngá»¯ cáº£nh há»c vá»¥."}
              </p>
            </div>
            <div className="admin-tab-group" role="tablist" aria-label="Tab lá»‹ch há»c vÃ  lá»‹ch thi">
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
                        <div className="eyebrow">MÃ´n há»c</div>
                        <div>
                          <h4>{course.course_name}</h4>
                          <p>{course.course_code}</p>
                        </div>
                      </div>
                      <div className="admin-course-card-metrics">
                        <span>{course.section_count} lá»›p há»c pháº§n</span>
                        <strong>{course.scheduled_count} lá»‹ch Ä‘Ã£ xáº¿p</strong>
                      </div>
                    </div>

                    {course.schedules.length ? (
                      <div className="admin-schedule-list">
                        {course.schedules.map((item) => (
                          <div key={item.id} className="admin-schedule-row">
                            <div className="admin-schedule-primary">
                              <strong>{item.section_code}</strong>
                              <span>{formatDay(item.day_of_week)} â€¢ {formatTimeRange(item.start_time, item.end_time)}</span>
                              <span>Loáº¡i buá»•i: {SESSION_TYPE_OPTIONS.find((option) => option.value === item.session_type)?.label || item.session_type || "--"}</span>
                            </div>
                            <div className="admin-schedule-secondary">
                              <span>PhÃ²ng: {item.room || "--"}</span>
                              <span>CÆ¡ sá»Ÿ: {item.location || "--"}</span>
                              <span>Giáº£ng viÃªn: {item.teacher_name || item.teacher_external_id || "--"}</span>
                            </div>
                            <div className="admin-schedule-actions">
                              <StatusBadge status={item.status} />
                              <button className="secondary-button" type="button" onClick={() => openTimetableModal(item)} disabled={isUnclassifiedMode}>
                                Sá»­a
                              </button>
                              <button className="danger-button" type="button" onClick={() => removeTimetable(item.id)}>
                                XÃ³a
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="admin-course-empty">ChÆ°a cÃ³ lá»‹ch cho mÃ´n nÃ y.</div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState message={isUnclassifiedMode ? "KhÃ´ng cÃ³ dá»¯ liá»‡u chÆ°a phÃ¢n loáº¡i trong bá»™ lá»c hiá»‡n táº¡i." : "ChÆ°a cÃ³ mÃ´n há»c thuá»™c ngá»¯ cáº£nh Ä‘ang chá»n."} />
            )
          ) : state.examGroups.length ? (
            <div className="admin-course-card-grid">
              {state.examGroups.map((course) => (
                <article key={`${course.term_id || "termless"}-${course.course_code}-exam`} className="admin-course-card">
                  <div className="admin-course-card-head">
                    <div className="section-stack">
                      <div className="eyebrow">MÃ´n há»c</div>
                      <div>
                        <h4>{course.course_name}</h4>
                        <p>{course.course_code}</p>
                      </div>
                    </div>
                    <div className="admin-course-card-metrics">
                      <span>{course.section_count} lá»›p há»c pháº§n</span>
                      <strong>{course.exams.length} lá»‹ch thi</strong>
                    </div>
                  </div>

                  {course.exams.length ? (
                    <div className="admin-schedule-list">
                      {course.exams.map((item) => (
                        <div key={item.id} className="admin-schedule-row">
                          <div className="admin-schedule-primary">
                            <strong>{item.section_code}</strong>
                            <span>{item.exam_date} â€¢ {formatTimeRange(item.start_time, item.end_time)}</span>
                          </div>
                          <div className="admin-schedule-secondary">
                            <span>PhÃ²ng thi: {item.room || "--"}</span>
                            <span>CÆ¡ sá»Ÿ: {item.location || "--"}</span>
                            <span>HÃ¬nh thá»©c thi: {item.exam_type || "--"}</span>
                          </div>
                          <div className="admin-schedule-actions">
                            <StatusBadge status={item.status || "scheduled"} />
                            <button className="secondary-button" type="button" onClick={() => openExamModal(item)} disabled={isUnclassifiedMode}>
                              Sá»­a
                            </button>
                            <button className="danger-button" type="button" onClick={() => removeExam(item.id)}>
                              XÃ³a
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="admin-course-empty">ChÆ°a cÃ³ lá»‹ch thi cho mÃ´n/lá»›p há»c pháº§n nÃ y.</div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState message="ChÆ°a cÃ³ lá»‹ch thi cho mÃ´n/lá»›p há»c pháº§n nÃ y." />
          )}
        </div>
      ) : null}

      {modalType === "timetable" ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel">
            <form className="form-grid" onSubmit={saveTimetable}>
              <div className="admin-modal-head">
                <div>
                  <h3>{timetableForm.id ? "Cáº­p nháº­t lá»‹ch há»c" : "Táº¡o lá»‹ch há»c"}</h3>
                  <p className="page-subtitle">
                    Context hiá»‡n táº¡i: {state.terms.find((term) => term.id === timetableForm.term_id)?.term_code || "--"} â€¢ {timetableForm.faculty || "--"} â€¢ {timetableForm.program || "--"}
                  </p>
                  {activeTimetableTerm?.start_date && activeTimetableTerm?.end_date ? (
                    <p className="helper-text">
                      Pháº¡m vi há»c ká»³: {activeTimetableTerm.start_date} Ä‘áº¿n {activeTimetableTerm.end_date}
                    </p>
                  ) : null}
                </div>
                <button className="secondary-button" type="button" onClick={() => setModalType(null)}>
                  ÄÃ³ng
                </button>
              </div>

              <div className="inline-form">
                <label className="field-group">
                  <span>MÃ´n há»c</span>
                  <select value={timetableForm.course_id} onChange={(event) => setTimetableForm((prev) => ({ ...prev, course_id: event.target.value, section_id: "" }))} required>
                    <option value="">Chá»n mÃ´n há»c</option>
                    {courseOptions.map((subject) => (
                      <option key={`${subject.term_id || "termless"}-${subject.course_id}`} value={subject.course_id}>
                        {subject.course_name} ({subject.course_code})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-group">
                  <span>Lá»›p há»c pháº§n</span>
                  <select value={timetableForm.section_id} onChange={(event) => setTimetableForm((prev) => ({ ...prev, section_id: event.target.value }))} required>
                    <option value="">Chá»n lá»›p há»c pháº§n</option>
                    {formSections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.section_code} - {section.course_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-group">
                  <span>Thá»©</span>
                  <select value={timetableForm.day_of_week} onChange={(event) => setTimetableForm((prev) => ({ ...prev, day_of_week: event.target.value }))}>
                    {DAY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-group">
                  <span>Tráº¡ng thÃ¡i</span>
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
                  <span>Giá» báº¯t Ä‘áº§u</span>
                  <input type="time" value={timetableForm.start_time} onChange={(event) => setTimetableForm((prev) => ({ ...prev, start_time: event.target.value }))} />
                </label>
                <label className="field-group">
                  <span>Giá» káº¿t thÃºc</span>
                  <input type="time" value={timetableForm.end_time} onChange={(event) => setTimetableForm((prev) => ({ ...prev, end_time: event.target.value }))} />
                </label>
                <label className="field-group">
                  <span>PhÃ²ng</span>
                  <input value={timetableForm.room} onChange={(event) => setTimetableForm((prev) => ({ ...prev, room: event.target.value }))} />
                </label>
                <label className="field-group">
                  <span>CÆ¡ sá»Ÿ</span>
                  <input value={timetableForm.location} onChange={(event) => setTimetableForm((prev) => ({ ...prev, location: event.target.value }))} />
                </label>
              </div>

              <div className="inline-form">
                <label className="field-group">
                  <span>Hiá»‡u lá»±c tá»«</span>
                  <input type="date" value={timetableForm.valid_from} onChange={(event) => setTimetableForm((prev) => ({ ...prev, valid_from: event.target.value }))} />
                </label>
                <label className="field-group">
                  <span>Hiá»‡u lá»±c Ä‘áº¿n</span>
                  <input type="date" value={timetableForm.valid_to} onChange={(event) => setTimetableForm((prev) => ({ ...prev, valid_to: event.target.value }))} />
                </label>
              </div>

              <div className="button-row">
                <button className="primary-button" type="submit">{timetableForm.id ? "LÆ°u lá»‹ch há»c" : "Táº¡o lá»‹ch há»c"}</button>
                <button className="secondary-button" type="button" onClick={() => setModalType(null)}>
                  Há»§y
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
                  <h3>{examForm.id ? "Cáº­p nháº­t lá»‹ch thi" : "Táº¡o lá»‹ch thi"}</h3>
                  <p className="page-subtitle">
                    Context hiá»‡n táº¡i: {state.terms.find((term) => term.id === examForm.term_id)?.term_code || "--"} â€¢ {examForm.faculty || "--"} â€¢ {examForm.program || "--"}
                  </p>
                  {activeExamTerm?.start_date && activeExamTerm?.end_date ? (
                    <p className="helper-text">
                      Pháº¡m vi há»c ká»³: {activeExamTerm.start_date} Ä‘áº¿n {activeExamTerm.end_date}
                    </p>
                  ) : null}
                </div>
                <button className="secondary-button" type="button" onClick={() => setModalType(null)}>
                  ÄÃ³ng
                </button>
              </div>

              <div className="inline-form">
                <label className="field-group">
                  <span>MÃ´n há»c</span>
                  <select value={examForm.course_id} onChange={(event) => setExamForm((prev) => ({ ...prev, course_id: event.target.value, section_id: "" }))} required>
                    <option value="">Chá»n mÃ´n há»c</option>
                    {courseOptions.map((subject) => (
                      <option key={`${subject.term_id || "termless"}-${subject.course_id}`} value={subject.course_id}>
                        {subject.course_name} ({subject.course_code})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-group">
                  <span>Lá»›p há»c pháº§n</span>
                  <select value={examForm.section_id} onChange={(event) => setExamForm((prev) => ({ ...prev, section_id: event.target.value }))} required>
                    <option value="">Chá»n lá»›p há»c pháº§n</option>
                    {formSections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.section_code} - {section.course_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-group">
                  <span>NgÃ y thi</span>
                  <input type="date" value={examForm.exam_date} onChange={(event) => setExamForm((prev) => ({ ...prev, exam_date: event.target.value }))} required />
                </label>
                <label className="field-group">
                  <span>Tráº¡ng thÃ¡i</span>
                  <select value={examForm.status} onChange={(event) => setExamForm((prev) => ({ ...prev, status: event.target.value }))}>
                    <option value="scheduled">Scheduled</option>
                    <option value="draft">Draft</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
              </div>

              <div className="inline-form">
                <label className="field-group">
                  <span>Giá» báº¯t Ä‘áº§u</span>
                  <input type="time" value={examForm.start_time} onChange={(event) => setExamForm((prev) => ({ ...prev, start_time: event.target.value }))} />
                </label>
                <label className="field-group">
                  <span>Giá» káº¿t thÃºc</span>
                  <input type="time" value={examForm.end_time} onChange={(event) => setExamForm((prev) => ({ ...prev, end_time: event.target.value }))} />
                </label>
                <label className="field-group">
                  <span>PhÃ²ng thi</span>
                  <input value={examForm.room} onChange={(event) => setExamForm((prev) => ({ ...prev, room: event.target.value }))} />
                </label>
                <label className="field-group">
                  <span>CÆ¡ sá»Ÿ</span>
                  <input value={examForm.location} onChange={(event) => setExamForm((prev) => ({ ...prev, location: event.target.value }))} />
                </label>
              </div>

              <div className="inline-form">
                <label className="field-group">
                  <span>HÃ¬nh thá»©c thi</span>
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
                <button className="primary-button" type="submit">{examForm.id ? "LÆ°u lá»‹ch thi" : "Táº¡o lá»‹ch thi"}</button>
                <button className="secondary-button" type="button" onClick={() => setModalType(null)}>
                  Há»§y
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

