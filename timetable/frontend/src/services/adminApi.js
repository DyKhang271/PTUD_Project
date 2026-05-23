import { api } from "./api";

export async function fetchAdminDashboard() {
  const { data } = await api.get("/admin/attendance/dashboard");
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

export async function fetchCourseSections() {
  const { data } = await api.get("/admin/course-sections");
  return data;
}

export async function createCourseSection(payload) {
  const { data } = await api.post("/admin/course-sections", payload);
  return data;
}

export async function importCourseSections(payload) {
  const { data } = await api.post("/admin/import", payload);
  return data;
}

export async function fetchTimetableEntries(sectionId) {
  const { data } = await api.get("/admin/timetable", { params: sectionId ? { section_id: sectionId } : {} });
  return data;
}

export async function createTimetableEntry(payload) {
  const { data } = await api.post("/admin/timetable", payload);
  return data;
}

export async function fetchExams(sectionId) {
  const { data } = await api.get("/admin/exams", { params: sectionId ? { section_id: sectionId } : {} });
  return data;
}

export async function createExam(payload) {
  const { data } = await api.post("/admin/exams", payload);
  return data;
}

export async function fetchPolicies() {
  const { data } = await api.get("/admin/policies");
  return data;
}

export async function createPolicy(payload) {
  const { data } = await api.post("/admin/attendance-policies", payload);
  return data;
}
