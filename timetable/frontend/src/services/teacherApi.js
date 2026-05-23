import { api } from "./api";

export async function fetchTeacherSections() {
  const { data } = await api.get("/teacher/sections");
  return data;
}

export async function fetchTeacherSection(sectionId) {
  const { data } = await api.get(`/teacher/sections/${sectionId}`);
  return data;
}

export async function fetchTeacherSectionStudents(sectionId) {
  const { data } = await api.get(`/teacher/sections/${sectionId}/students`);
  return data;
}

export async function fetchTeacherSectionTimetable(sectionId) {
  const { data } = await api.get(`/teacher/sections/${sectionId}/timetable`);
  return data;
}

export async function createAttendanceSession(payload) {
  const { data } = await api.post("/teacher/attendance-sessions", payload);
  return data;
}

export async function fetchAttendanceSession(sessionId) {
  const { data } = await api.get(`/teacher/attendance-sessions/${sessionId}`);
  return data;
}

export async function openAttendanceSession(sessionId) {
  const { data } = await api.post(`/teacher/attendance-sessions/${sessionId}/open`);
  return data;
}

export async function closeAttendanceSession(sessionId) {
  const { data } = await api.patch(`/teacher/attendance-sessions/${sessionId}/close`);
  return data;
}

export async function fetchAttendanceRecords(sessionId) {
  const { data } = await api.get(`/teacher/attendance-sessions/${sessionId}/records`);
  return data;
}

export async function updateAttendanceRecord(sessionId, studentExternalId, payload) {
  const { data } = await api.put(`/teacher/attendance-sessions/${sessionId}/records/${studentExternalId}`, payload);
  return data;
}

export async function fetchAttendanceSummary(sectionId) {
  const { data } = await api.get(`/teacher/sections/${sectionId}/attendance-summary`);
  return data;
}

export async function fetchAttendanceReport(sectionId) {
  const { data } = await api.get(`/teacher/sections/${sectionId}/attendance-report`);
  return data;
}
