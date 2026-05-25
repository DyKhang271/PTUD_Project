import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../../../components/DataState";
import CourseSectionsTable from "./CourseSectionsTable";
import PlanFilters from "./PlanFilters";
import PlanSummaryCards from "./PlanSummaryCards";
import PlannedCoursesTable from "./PlannedCoursesTable";
import {
  bulkCreateSectionsFromPlan,
  getCourseOpeningPlan,
  getPlanningCohorts,
  getPlanningFaculties,
  getPlanningPrograms,
  getPlanningTerms,
  importCoreCurriculum,
  importCurrentTermSections,
  suggestCourseOpeningPlan,
} from "../../../services/courseOpeningPlanApi";

const DEFAULT_FILTERS = {
  faculty_id: "",
  program_id: "",
  cohort_id: "",
  curriculum_semester: "",
  term_code: "",
};

const DEFAULT_ACTION_LOADING = {
  importCurriculum: false,
  importSections: false,
  suggestPlan: false,
  bulkCreate: false,
};

function hasEnoughFilters(filters) {
  return Boolean(
    filters.faculty_id && filters.program_id && filters.cohort_id && filters.curriculum_semester && filters.term_code,
  );
}

function buildErrorMessage(error, fallback) {
  return error?.response?.data?.detail || error?.message || fallback;
}

export default function CourseOpeningPlanPage() {
  const [bootstrap, setBootstrap] = useState({
    loading: true,
    error: "",
    faculties: [],
    programs: [],
    cohorts: [],
    terms: [],
    latestTermCode: "",
  });
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [planState, setPlanState] = useState({ loading: false, error: "", data: null });
  const [selectedCourseCode, setSelectedCourseCode] = useState("");
  const [actionLoading, setActionLoading] = useState(DEFAULT_ACTION_LOADING);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  const semesters = useMemo(() => [1, 2, 3, 4, 5, 6, 7, 8], []);

  async function loadBootstrap() {
    setBootstrap((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const [faculties, termsPayload] = await Promise.all([getPlanningFaculties(), getPlanningTerms()]);
      const firstFacultyId = faculties[0]?.id || "";
      const programs = firstFacultyId ? await getPlanningPrograms(firstFacultyId) : [];
      const firstProgramId = programs[0]?.id || "";
      const cohorts = firstProgramId ? await getPlanningCohorts(firstProgramId) : [];
      const firstCohortId = cohorts[0]?.id || "";
      const nextFilters = {
        faculty_id: firstFacultyId,
        program_id: firstProgramId,
        cohort_id: firstCohortId,
        curriculum_semester: "5",
        term_code: termsPayload.latest_term_code || termsPayload.terms[0]?.term_code || "",
      };

      setBootstrap({
        loading: false,
        error: "",
        faculties,
        programs,
        cohorts,
        terms: termsPayload.terms || [],
        latestTermCode: termsPayload.latest_term_code || "",
      });
      setFilters(nextFilters);
    } catch (error) {
      setBootstrap({
        loading: false,
        error: buildErrorMessage(error, "Không tải được bộ lọc kế hoạch mở lớp."),
        faculties: [],
        programs: [],
        cohorts: [],
        terms: [],
        latestTermCode: "",
      });
    }
  }

  useEffect(() => {
    loadBootstrap();
  }, []);

  useEffect(() => {
    if (!hasEnoughFilters(filters)) {
      setPlanState({ loading: false, error: "", data: null });
      setSelectedCourseCode("");
      return;
    }

    let cancelled = false;

    async function loadPlan() {
      setPlanState((prev) => ({ ...prev, loading: true, error: "" }));
      try {
        const data = await getCourseOpeningPlan(filters);
        if (cancelled) return;
        setPlanState({ loading: false, error: "", data });
        setSelectedCourseCode((current) => current || data.courses?.[0]?.course_code || "");
      } catch (error) {
        if (cancelled) return;
        setPlanState({
          loading: false,
          error: buildErrorMessage(error, "Không tải được kế hoạch mở lớp."),
          data: null,
        });
      }
    }

    loadPlan();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  async function handleFilterChange(key, value) {
    setFeedback({ type: "", message: "" });

    if (key === "faculty_id") {
      const programs = value ? await getPlanningPrograms(value) : [];
      const nextProgramId = programs[0]?.id || "";
      const cohorts = nextProgramId ? await getPlanningCohorts(nextProgramId) : [];
      const nextCohortId = cohorts[0]?.id || "";
      setBootstrap((prev) => ({ ...prev, programs, cohorts }));
      setFilters((prev) => ({
        ...prev,
        faculty_id: value,
        program_id: nextProgramId,
        cohort_id: nextCohortId,
      }));
      return;
    }

    if (key === "program_id") {
      const cohorts = value ? await getPlanningCohorts(value) : [];
      const nextCohortId = cohorts[0]?.id || "";
      setBootstrap((prev) => ({ ...prev, cohorts }));
      setFilters((prev) => ({
        ...prev,
        program_id: value,
        cohort_id: nextCohortId,
      }));
      return;
    }

    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function runAction(actionKey, action, successMessage) {
    setActionLoading((prev) => ({ ...prev, [actionKey]: true }));
    setFeedback({ type: "", message: "" });
    try {
      const result = await action();
      setFeedback({
        type: "success",
        message: result?.message || successMessage,
      });
      if (hasEnoughFilters(filters)) {
        const data = await getCourseOpeningPlan(filters);
        setPlanState({ loading: false, error: "", data });
        setSelectedCourseCode((current) => current || data.courses?.[0]?.course_code || "");
      }
    } catch (error) {
      setFeedback({
        type: "error",
        message: buildErrorMessage(error, "Không thực hiện được hành động quản trị."),
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, [actionKey]: false }));
    }
  }

  const selectedCourse = useMemo(() => {
    if (!planState.data?.courses?.length) {
      return null;
    }
    return planState.data.courses.find((course) => course.course_code === selectedCourseCode) || planState.data.courses[0] || null;
  }, [planState.data, selectedCourseCode]);

  if (bootstrap.loading) {
    return <LoadingState label="Đang tải dữ liệu bộ lọc kế hoạch mở lớp..." />;
  }

  if (bootstrap.error) {
    return <ErrorState message={bootstrap.error} onRetry={loadBootstrap} />;
  }

  return (
    <div className="section-stack">
      <PlanFilters
        filters={filters}
        faculties={bootstrap.faculties}
        programs={bootstrap.programs}
        cohorts={bootstrap.cohorts}
        terms={bootstrap.terms}
        semesters={semesters}
        onChange={handleFilterChange}
        onImportCurriculum={() =>
          runAction(
            "importCurriculum",
            () => importCoreCurriculum(),
            "Đã đồng bộ chương trình khung hoặc kích hoạt chế độ dự phòng từ Student Portal.",
          )
        }
        onImportSections={() =>
          runAction(
            "importSections",
            () => importCurrentTermSections(filters.term_code),
            "Đã đồng bộ lớp học phần của học kỳ thực tế.",
          )
        }
        onSuggestPlan={() =>
          runAction("suggestPlan", () => suggestCourseOpeningPlan(filters), "Đã cập nhật đề xuất mở lớp theo chương trình khung.")
        }
        onBulkCreate={() =>
          runAction(
            "bulkCreate",
            () => bulkCreateSectionsFromPlan(filters),
            "Đã xử lý yêu cầu tạo lớp học phần cho các môn còn thiếu.",
          )
        }
        actionLoading={actionLoading}
        disabled={!hasEnoughFilters(filters)}
      />

      {feedback.message ? (
        <div className={`state-card ${feedback.type === "error" ? "state-error" : "state-success"}`}>{feedback.message}</div>
      ) : null}

      {!hasEnoughFilters(filters) ? (
        <EmptyState message="Vui lòng chọn Khoa, Chương trình, Khóa và Học kỳ để xem kế hoạch mở lớp." />
      ) : planState.loading ? (
        <LoadingState label="Đang tổng hợp kế hoạch mở lớp..." />
      ) : planState.error ? (
        <ErrorState message={planState.error} onRetry={() => setFilters((prev) => ({ ...prev }))} />
      ) : !planState.data?.courses?.length ? (
        <EmptyState message="Chưa có dữ liệu kế hoạch mở lớp cho lựa chọn này." />
      ) : (
        <>
          {planState.data.meta?.notes?.length ? (
            <div className="state-card">
              {planState.data.meta.notes.map((note) => (
                <div key={note}>{note}</div>
              ))}
            </div>
          ) : null}
          <PlanSummaryCards plan={planState.data} />
          <PlannedCoursesTable
            courses={planState.data.courses}
            selectedCourseCode={selectedCourse?.course_code || ""}
            onSelectCourse={(course) => setSelectedCourseCode(course.course_code)}
          />
          <CourseSectionsTable course={selectedCourse} />
        </>
      )}
    </div>
  );
}
