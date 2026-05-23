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
        error: buildErrorMessage(error, "Khong tai duoc bo loc ke hoach mo lop."),
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
          error: buildErrorMessage(error, "Khong tai duoc ke hoach mo lop."),
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
        message: buildErrorMessage(error, "Khong thuc hien duoc hanh dong quan tri."),
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
    return <LoadingState label="Dang tai du lieu bo loc ke hoach mo lop..." />;
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
            "Da dong bo CT khung hoac kich hoat fallback tu Student Portal.",
          )
        }
        onImportSections={() =>
          runAction(
            "importSections",
            () => importCurrentTermSections(filters.term_code),
            "Da dong bo lop hoc phan cua hoc ky thuc te.",
          )
        }
        onSuggestPlan={() =>
          runAction("suggestPlan", () => suggestCourseOpeningPlan(filters), "Da cap nhat de xuat mo lop theo CT khung.")
        }
        onBulkCreate={() =>
          runAction(
            "bulkCreate",
            () => bulkCreateSectionsFromPlan(filters),
            "Da xu ly yeu cau tao lop hoc phan cho cac mon con thieu.",
          )
        }
        actionLoading={actionLoading}
        disabled={!hasEnoughFilters(filters)}
      />

      {feedback.message ? (
        <div className={`state-card ${feedback.type === "error" ? "state-error" : "state-success"}`}>{feedback.message}</div>
      ) : null}

      {!hasEnoughFilters(filters) ? (
        <EmptyState message="Vui long chon Khoa, Chuong trinh, Khoa va Hoc ky de xem ke hoach mo lop." />
      ) : planState.loading ? (
        <LoadingState label="Dang tong hop ke hoach mo lop..." />
      ) : planState.error ? (
        <ErrorState message={planState.error} onRetry={() => setFilters((prev) => ({ ...prev }))} />
      ) : !planState.data?.courses?.length ? (
        <EmptyState message="Chua co du lieu ke hoach mo lop cho lua chon nay." />
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
