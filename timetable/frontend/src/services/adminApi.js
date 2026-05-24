import { api } from "./api";

export async function fetchAdminDashboard() {
  const { data } = await api.get("/admin/attendance/dashboard");
  return data;
}

export async function fetchAttendanceBySection() {
  const { data } = await api.get("/admin/attendance/by-section");
  return data;
}

export async function fetchTerms() {
  const { data } = await api.get("/admin/terms");
  return data;
}

export async function createTerm(payload) {
  const { data } = await api.post("/admin/terms", payload);
  return data;
}

export async function updateTerm(termId, payload) {
  const { data } = await api.put(`/admin/terms/${termId}`, payload);
  return data;
}

export async function fetchCourseSections(params = {}) {
  const { data } = await api.get("/admin/course-sections", { params });
  return data;
}

export async function fetchCourseSubjects(params = {}) {
  const { data } = await api.get("/admin/course-subjects", { params });
  return data;
}

export async function createCourseSection(payload) {
  const { data } = await api.post("/admin/course-sections", payload);
  return data;
}

export async function updateCourseSection(sectionId, payload) {
  const { data } = await api.put(`/admin/course-sections/${sectionId}`, payload);
  return data;
}

export async function assignSectionTeacher(sectionId, teacherId) {
  const { data } = await api.put(`/admin/sections/${sectionId}/teacher`, { teacher_id: teacherId });
  return data;
}

export async function archiveCourseSection(sectionId, status = "inactive") {
  const { data } = await api.put(`/admin/course-sections/${sectionId}`, { status });
  return data;
}

export async function importCourseSections(payload) {
  const { data } = await api.post("/admin/import", payload);
  return data;
}

export async function fetchTimetableEntries(params = {}) {
  const { data } = await api.get("/admin/timetable", { params });
  return data;
}

export async function fetchTimetableCourseGroups(params = {}) {
  const { data } = await api.get("/admin/timetable/course-groups", { params });
  return data;
}

export async function createTimetableEntry(payload) {
  const { data } = await api.post("/admin/timetable", payload);
  return data;
}

export async function updateTimetableEntry(entryId, payload) {
  const { data } = await api.put(`/admin/timetable/${entryId}`, payload);
  return data;
}

export async function deleteTimetableEntry(entryId) {
  await api.delete(`/admin/timetable/${entryId}`);
}

export async function fetchExams(sectionId) {
  const params = sectionId ? { section_id: sectionId } : {};
  const { data } = await api.get("/admin/exams", { params });
  return data;
}

export async function createExam(payload) {
  const { data } = await api.post("/admin/exams", payload);
  return data;
}

export async function updateExam(examId, payload) {
  const { data } = await api.put(`/admin/exams/${examId}`, payload);
  return data;
}

export async function deleteExam(examId) {
  await api.delete(`/admin/exams/${examId}`);
}

export async function fetchPolicies() {
  const { data } = await api.get("/admin/policies");
  return data;
}

export async function createPolicy(payload) {
  const { data } = await api.post("/admin/attendance-policies", payload);
  return data;
}

export async function updatePolicy(policyId, payload) {
  const { data } = await api.put(`/admin/attendance-policies/${policyId}`, payload);
  return data;
}

export async function deletePolicy(policyId) {
  await api.delete(`/admin/attendance-policies/${policyId}`);
}

export async function importAcademicSchedulingSource(payload) {
  const { data } = await api.post("/admin/import/academic-scheduling-source", payload);
  return data;
}

export async function fetchAcademicImportBatches() {
  const { data } = await api.get("/admin/import/academic-batches");
  return data;
}

export async function fetchAcademicImportOptions() {
  const { data } = await api.get("/admin/import/academic-scheduling-options");
  return data;
}

export async function fetchAcademicImportDebugSummary(termCode) {
  const params = termCode ? { term_code: termCode } : {};
  const { data } = await api.get("/admin/import/debug-summary", { params });
  return data;
}
