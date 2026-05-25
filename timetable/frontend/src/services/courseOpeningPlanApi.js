import { api } from "./api";

const DEFAULT_SECTION_SIZE = 65;

const MOCK_TEACHERS = {
  gvaiml: "TS. Tran Minh Quan",
  gvungdung: "ThS. Nguyen Hoang Anh",
};

const MOCK_FACULTIES = [
  {
    id: "fit",
    name: "Khoa Cong nghe Thong tin",
  },
];

const MOCK_PROGRAMS = [
  {
    id: "khdl",
    faculty_id: "fit",
    name: "Khoa hoc du lieu",
  },
  {
    id: "khmt",
    faculty_id: "fit",
    name: "Khoa hoc may tinh",
  },
];

const MOCK_COHORTS = [
  {
    id: "dhkhdl18",
    program_id: "khdl",
    code: "DHKHDL18",
    label: "DHKHDL18",
    expected_students: 130,
  },
  {
    id: "dhkhdl19",
    program_id: "khdl",
    code: "DHKHDL19",
    label: "DHKHDL19",
    expected_students: 95,
  },
  {
    id: "dhkhmt19",
    program_id: "khmt",
    code: "DHKHMT19",
    label: "DHKHMT19",
    expected_students: 110,
  },
];

const MOCK_CURRICULUM = {
  khdl: {
    dhkhdl18: {
      5: [
        { course_code: "4203001146", course_name: "He co so du lieu", credits: 4, course_type: "Bat buoc" },
        { course_code: "4203002070", course_name: "Lap trinh huong su kien voi cong nghe Java", credits: 4, course_type: "Bat buoc" },
        { course_code: "4203002117", course_name: "Nhung van de xa hoi va nghe nghiep", credits: 2, course_type: "Bat buoc" },
        { course_code: "4203001545", course_name: "Nhan dang mau", credits: 3, course_type: "Bat buoc" },
        { course_code: "4203003443", course_name: "Khai thac du lieu va ung dung", credits: 3, course_type: "Bat buoc" },
        { course_code: "4203003501", course_name: "Phat trien ung dung", credits: 3, course_type: "Bat buoc" },
      ],
      8: [
        { course_code: "4203003443", course_name: "Khai thac du lieu va ung dung", credits: 3, course_type: "Bat buoc" },
        { course_code: "4203003501", course_name: "Phat trien ung dung", credits: 3, course_type: "Bat buoc" },
        { course_code: "4203003711", course_name: "May hoc", credits: 3, course_type: "Bat buoc" },
        { course_code: "4203014115", course_name: "Khai pha do thi", credits: 3, course_type: "Bat buoc" },
        { course_code: "4203001146", course_name: "He co so du lieu", credits: 4, course_type: "Bat buoc" },
      ],
    },
    dhkhdl19: {
      5: [
        { course_code: "4203001146", course_name: "He co so du lieu", credits: 4, course_type: "Bat buoc" },
        { course_code: "4203003443", course_name: "Khai thac du lieu va ung dung", credits: 3, course_type: "Bat buoc" },
        { course_code: "4203003501", course_name: "Phat trien ung dung", credits: 3, course_type: "Bat buoc" },
      ],
    },
  },
  khmt: {
    dhkhmt19: {
      5: [
        { course_code: "4203002137", course_name: "He thong may tinh", credits: 4, course_type: "Bat buoc" },
        { course_code: "4203000941", course_name: "Ky thuat lap trinh", credits: 3, course_type: "Bat buoc" },
        { course_code: "4203000901", course_name: "Cau truc roi rac", credits: 3, course_type: "Bat buoc" },
      ],
    },
  },
};

function isMissingEndpoint(error) {
  const status = error?.response?.status;
  return status === 404 || status === 405 || status === 501;
}

function sortTerms(terms) {
  return [...terms].sort((left, right) => {
    const leftCode = left.term_code || "";
    const rightCode = right.term_code || "";
    return leftCode.localeCompare(rightCode, "vi", { numeric: true });
  });
}

function inferTermName(termCode) {
  if (!termCode) return "";
  const match = termCode.match(/HK(\d)[_ -]?(\d{4})[_ -]?(\d{4})/i);
  if (!match) return termCode;
  return `HK${match[1]} (${match[2]} - ${match[3]})`;
}

function buildFallbackTerms() {
  const terms = [
    {
      term_code: "HK2_2025_2026",
      term_name: "HK2 (2025 - 2026)",
      academic_year: "2025 - 2026",
      semester: "HK2",
      course_count: 5,
      student_count: 130,
      has_course_sections: true,
      has_transcript_courses: true,
      source: ["mock_curriculum", "mock_sections"],
    },
    {
      term_code: "HK2_2024_2025",
      term_name: "HK2 (2024 - 2025)",
      academic_year: "2024 - 2025",
      semester: "HK2",
      course_count: 6,
      student_count: 110,
      has_course_sections: false,
      has_transcript_courses: true,
      source: ["mock_curriculum"],
    },
  ];
  return {
    terms,
    latest_term_code: terms[0].term_code,
  };
}

function buildMockSummaryPlan({ faculty, program, cohort, curriculumSemester, termCode, courses }) {
  return {
    faculty: faculty?.name || "",
    program: program?.name || "",
    cohort: cohort?.code || "",
    curriculum_semester: Number(curriculumSemester),
    term_code: termCode,
    summary: {
      planned_courses: courses.length,
      opened_courses: 0,
      missing_courses: courses.length,
      extra_courses: 0,
      total_sections: 0,
      missing_teacher_sections: 0,
      missing_schedule_sections: 0,
      missing_exam_sections: 0,
    },
    courses: courses.map((course) => ({
      ...course,
      expected_students: cohort?.expected_students || 0,
      suggested_sections: Math.max(1, Math.ceil((cohort?.expected_students || 0) / DEFAULT_SECTION_SIZE)),
      opened_sections: 0,
      status: "missing",
      sections: [],
    })),
    meta: {
      source: "mock",
      notes: ["Backend chua co endpoint /admin/course-opening-plan, dang dung fallback o frontend."],
    },
  };
}

function buildSectionStatus(section, hasSchedule, hasExam) {
  if (!section.teacher_external_id) {
    return "missing_teacher";
  }
  if (!hasSchedule) {
    return "missing_schedule";
  }
  if (!hasExam) {
    return "missing_exam";
  }
  return "ready";
}

function buildScheduleLabel(entries) {
  if (!entries.length) {
    return "--";
  }
  return entries
    .map((entry) => {
      const room = entry.room || entry.location || "--";
      return `Thu ${entry.day_of_week} ${entry.start_time || "--"}-${entry.end_time || "--"} ${room}`;
    })
    .join(" | ");
}

function buildExamLabel(exams) {
  if (!exams.length) {
    return "--";
  }
  return exams
    .map((exam) => `${exam.exam_date || "--"} ${exam.start_time || "--"}-${exam.end_time || "--"} ${exam.room || exam.location || "--"}`)
    .join(" | ");
}

function buildClassName(cohortCode, index) {
  const suffix = String.fromCharCode(65 + (index % 26));
  return `${cohortCode}${suffix}`;
}

async function getCourseSectionsForTerm(termCode) {
  const { data } = await api.get("/course-sections", {
    params: { term_code: termCode },
  });
  return data;
}

async function getAllTimetableEntries() {
  const { data } = await api.get("/admin/timetable");
  return data;
}

async function getAllExams() {
  const { data } = await api.get("/admin/exams");
  return data;
}

function summarizePlan({ curriculumCourses, sections, timetableEntries, exams, cohort, faculty, program, curriculumSemester, termCode }) {
  const plannedByCode = new Map(curriculumCourses.map((course) => [course.course_code, course]));
  const sectionsByCourse = new Map();

  for (const section of sections) {
    const list = sectionsByCourse.get(section.course_code) || [];
    list.push(section);
    sectionsByCourse.set(section.course_code, list);
  }

  const timetableBySection = timetableEntries.reduce((accumulator, entry) => {
    const bucket = accumulator.get(entry.section_id) || [];
    bucket.push(entry);
    accumulator.set(entry.section_id, bucket);
    return accumulator;
  }, new Map());

  const examsBySection = exams.reduce((accumulator, exam) => {
    const bucket = accumulator.get(exam.section_id) || [];
    bucket.push(exam);
    accumulator.set(exam.section_id, bucket);
    return accumulator;
  }, new Map());

  const courseRows = curriculumCourses.map((course) => {
    const sectionItems = sectionsByCourse.get(course.course_code) || [];
    const expectedStudents = cohort?.expected_students || 0;
    const suggestedSections = Math.max(1, Math.ceil(expectedStudents / DEFAULT_SECTION_SIZE));
    const renderedSections = sectionItems.map((section, index) => {
      const sectionTimetable = timetableBySection.get(section.id) || [];
      const sectionExams = examsBySection.get(section.id) || [];
      const status = buildSectionStatus(section, sectionTimetable.length > 0, sectionExams.length > 0);

      return {
        section_id: section.id,
        section_code: section.section_code,
        class_name: buildClassName(cohort?.code || "LOP", index),
        student_count: section.student_count || 0,
        teacher_id: section.teacher_external_id || null,
        teacher_name: MOCK_TEACHERS[section.teacher_external_id] || section.teacher_external_id || "--",
        has_schedule: sectionTimetable.length > 0,
        has_exam: sectionExams.length > 0,
        schedule_label: buildScheduleLabel(sectionTimetable),
        exam_label: buildExamLabel(sectionExams),
        status,
      };
    });

    let status = "missing";
    if (renderedSections.length >= suggestedSections) {
      status = "opened";
    } else if (renderedSections.length > 0) {
      status = "under_opened";
    }

    return {
      ...course,
      expected_students: expectedStudents,
      suggested_sections: suggestedSections,
      opened_sections: renderedSections.length,
      status,
      sections: renderedSections,
    };
  });

  const plannedCodes = new Set(curriculumCourses.map((course) => course.course_code));
  const extraCourseMap = new Map();
  for (const section of sections) {
    if (!plannedCodes.has(section.course_code)) {
      extraCourseMap.set(section.course_code, section);
    }
  }

  const extraRows = [...extraCourseMap.values()].map((section) => {
    const sectionTimetable = timetableBySection.get(section.id) || [];
    const sectionExams = examsBySection.get(section.id) || [];
    const renderedSection = {
      section_id: section.id,
      section_code: section.section_code,
      class_name: buildClassName(cohort?.code || "LOP", 0),
      student_count: section.student_count || 0,
      teacher_id: section.teacher_external_id || null,
      teacher_name: MOCK_TEACHERS[section.teacher_external_id] || section.teacher_external_id || "--",
      has_schedule: sectionTimetable.length > 0,
      has_exam: sectionExams.length > 0,
      schedule_label: buildScheduleLabel(sectionTimetable),
      exam_label: buildExamLabel(sectionExams),
      status: buildSectionStatus(section, sectionTimetable.length > 0, sectionExams.length > 0),
    };

    return {
      course_code: section.course_code,
      course_name: section.course_name,
      credits: null,
      course_type: "Ngoai CT khung",
      expected_students: section.student_count || 0,
      suggested_sections: 0,
      opened_sections: 1,
      status: "extra",
      sections: [renderedSection],
    };
  });

  const allRows = [...courseRows, ...extraRows];
  const allSections = allRows.flatMap((course) => course.sections);

  return {
    faculty: faculty?.name || "",
    program: program?.name || "",
    cohort: cohort?.code || "",
    curriculum_semester: Number(curriculumSemester),
    term_code: termCode,
    summary: {
      planned_courses: curriculumCourses.length,
      opened_courses: courseRows.filter((course) => course.opened_sections > 0).length,
      missing_courses: courseRows.filter((course) => course.opened_sections === 0).length,
      extra_courses: extraRows.length,
      total_sections: allSections.length,
      missing_teacher_sections: allSections.filter((section) => section.status === "missing_teacher").length,
      missing_schedule_sections: allSections.filter((section) => section.status === "missing_schedule").length,
      missing_exam_sections: allSections.filter((section) => section.status === "missing_exam").length,
    },
    courses: allRows,
    meta: {
      source: "frontend-fallback",
      notes: ["Dang tong hop tu curriculum mock + course_sections/timetable/exams hien co."],
    },
  };
}

export async function getPlanningFaculties() {
  try {
    const { data } = await api.get("/admin/faculties");
    return data;
  } catch (error) {
    if (isMissingEndpoint(error)) {
      return MOCK_FACULTIES;
    }
    throw error;
  }
}

export async function getPlanningPrograms(facultyId) {
  try {
    const { data } = await api.get("/admin/programs", { params: { faculty_id: facultyId } });
    return data;
  } catch (error) {
    if (isMissingEndpoint(error)) {
      return MOCK_PROGRAMS.filter((program) => program.faculty_id === facultyId);
    }
    throw error;
  }
}

export async function getPlanningCohorts(programId) {
  try {
    const { data } = await api.get("/admin/cohorts", { params: { program_id: programId } });
    return data;
  } catch (error) {
    if (isMissingEndpoint(error)) {
      return MOCK_COHORTS.filter((cohort) => cohort.program_id === programId);
    }
    throw error;
  }
}

export async function getPlanningTerms() {
  try {
    const { data } = await api.get("/admin/import/source-terms");
    if (Array.isArray(data)) {
      return {
        terms: sortTerms(data),
        latest_term_code: data.at(-1)?.term_code || "",
      };
    }
    if (Array.isArray(data?.terms)) {
      return {
        terms: sortTerms(data.terms),
        latest_term_code: data.latest_term_code || data.terms.at(-1)?.term_code || "",
      };
    }
  } catch (error) {
    if (!isMissingEndpoint(error)) {
      throw error;
    }
  }

  try {
    const { data } = await api.get("/admin/terms");
    return {
      terms: sortTerms(
        (data || []).map((term) => ({
          term_code: term.term_code,
          term_name: term.term_name || inferTermName(term.term_code),
          academic_year: "",
          semester: "",
          course_count: 0,
          student_count: 0,
          has_course_sections: false,
          has_transcript_courses: false,
          source: ["admin_terms"],
        })),
      ),
      latest_term_code: data?.at(-1)?.term_code || "",
    };
  } catch (error) {
    if (isMissingEndpoint(error)) {
      return buildFallbackTerms();
    }
    throw error;
  }
}

export async function getCurriculumSemesterCourses({ programId, cohortId, curriculumSemester }) {
  try {
    const { data } = await api.get("/admin/curriculum/semester-courses", {
      params: {
        program_id: programId,
        cohort_id: cohortId,
        curriculum_semester: curriculumSemester,
      },
    });
    return data;
  } catch (error) {
    if (isMissingEndpoint(error)) {
      return MOCK_CURRICULUM[programId]?.[cohortId]?.[curriculumSemester] || [];
    }
    throw error;
  }
}

export async function getCourseOpeningPlan(filters) {
  try {
    const { data } = await api.get("/admin/course-opening-plan", {
      params: {
        faculty_id: filters.faculty_id,
        program_id: filters.program_id,
        cohort_id: filters.cohort_id,
        curriculum_semester: filters.curriculum_semester,
        term_code: filters.term_code,
      },
    });
    return data;
  } catch (error) {
    if (!isMissingEndpoint(error)) {
      throw error;
    }
  }

  const faculty = MOCK_FACULTIES.find((item) => item.id === filters.faculty_id) || null;
  const program = MOCK_PROGRAMS.find((item) => item.id === filters.program_id) || null;
  const cohort = MOCK_COHORTS.find((item) => item.id === filters.cohort_id) || null;
  const curriculumCourses = MOCK_CURRICULUM[filters.program_id]?.[filters.cohort_id]?.[filters.curriculum_semester] || [];

  if (!filters.term_code || !curriculumCourses.length) {
    return buildMockSummaryPlan({
      faculty,
      program,
      cohort,
      curriculumSemester: filters.curriculum_semester,
      termCode: filters.term_code,
      courses: curriculumCourses,
    });
  }

  try {
    const [sections, timetableEntries, exams] = await Promise.all([
      getCourseSectionsForTerm(filters.term_code),
      getAllTimetableEntries(),
      getAllExams(),
    ]);

    return summarizePlan({
      curriculumCourses,
      sections,
      timetableEntries,
      exams,
      cohort,
      faculty,
      program,
      curriculumSemester: filters.curriculum_semester,
      termCode: filters.term_code,
    });
  } catch (error) {
    if (isMissingEndpoint(error)) {
      return buildMockSummaryPlan({
        faculty,
        program,
        cohort,
        curriculumSemester: filters.curriculum_semester,
        termCode: filters.term_code,
        courses: curriculumCourses,
      });
    }
    throw error;
  }
}

export async function importCoreCurriculum() {
  try {
    const { data } = await api.post("/admin/import/core-curriculum");
    return data;
  } catch (error) {
    if (isMissingEndpoint(error)) {
      return {
        mode: "mock",
        message: "Backend chua co /admin/import/core-curriculum. Frontend dang dung curriculum mock tu Student Portal snapshot.",
      };
    }
    throw error;
  }
}

export async function importCurrentTermSections(termCode) {
  const { data } = await api.post("/admin/import/core-sections", {
    term_code: termCode,
    limit: 200,
  });
  return data;
}

export async function suggestCourseOpeningPlan(filters) {
  try {
    const { data } = await api.post("/admin/course-opening-plan/suggest", {
      faculty_id: filters.faculty_id,
      program_id: filters.program_id,
      cohort_id: filters.cohort_id,
      curriculum_semester: filters.curriculum_semester,
      term_code: filters.term_code,
    });
    return data;
  } catch (error) {
    if (isMissingEndpoint(error)) {
      const plan = await getCourseOpeningPlan(filters);
      const missingCourses = plan.courses.filter(
        (course) => course.status === "missing" || course.status === "under_opened",
      );
      return {
        mode: "mock",
        suggested_courses: missingCourses.length,
        message: missingCourses.length
          ? `De xuat mo them ${missingCourses.length} mon theo CT khung cho hoc ky da chon.`
          : "Tat ca mon trong CT khung da co lop hoc phan hoac dang duoc mo.",
      };
    }
    throw error;
  }
}

export async function bulkCreateSectionsFromPlan(filters) {
  try {
    const { data } = await api.post("/admin/course-sections/bulk-create-from-plan", {
      faculty_id: filters.faculty_id,
      program_id: filters.program_id,
      cohort_id: filters.cohort_id,
      curriculum_semester: filters.curriculum_semester,
      term_code: filters.term_code,
    });
    return data;
  } catch (error) {
    if (isMissingEndpoint(error)) {
      const plan = await getCourseOpeningPlan(filters);
      return {
        mode: "mock",
        created_sections: 0,
        pending_courses: plan.courses
          .filter((course) => course.status === "missing" || course.status === "under_opened")
          .map((course) => course.course_code),
        message: "Backend bulk create chua san sang. UI dang chi hien danh sach mon can tao them.",
      };
    }
    throw error;
  }
}
