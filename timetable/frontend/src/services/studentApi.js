import { api } from "./api";

export async function fetchStudentTimetable() {
  const { data } = await api.get("/student/timetable");
  return data;
}

export async function fetchStudentExams() {
  const { data } = await api.get("/student/exams");
  return data;
}

export async function fetchStudentAttendanceHistory() {
  const { data } = await api.get("/student/attendance-history");
  return data;
}

export async function fetchStudentAttendanceSummary() {
  const { data } = await api.get("/student/attendance/summary");
  return data;
}
