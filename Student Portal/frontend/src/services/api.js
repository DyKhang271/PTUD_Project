import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const TIMETABLE_TOKEN_KEY = 'timetable_access_token';

const timetableApi = axios.create({
  baseURL: import.meta.env.VITE_TIMETABLE_API_BASE_URL || 'http://127.0.0.1:8001',
  timeout: 20000,
});

timetableApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(TIMETABLE_TOKEN_KEY);
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const withStudentParams = (mssv, extraParams = {}) => ({
  params: {
    ...(mssv ? { mssv } : {}),
    ...extraParams,
  },
});

export const setTimetableAccessToken = (token) => {
  if (token) {
    localStorage.setItem(TIMETABLE_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TIMETABLE_TOKEN_KEY);
  }
};

export const getTimetableAccessToken = () => localStorage.getItem(TIMETABLE_TOKEN_KEY);

export const getStudent = (mssv) => api.get('/student', withStudentParams(mssv));

export const getSchedule = () => api.get('/schedule');

export const getNotifications = () => api.get('/notifications');

export const getGrades = (semester, mssv) =>
  api.get('/grades', withStudentParams(mssv, { semester }));

export const getGradesSummary = (mssv) =>
  api.get('/grades/summary', withStudentParams(mssv));

export const getCurriculum = (mssv) =>
  api.get('/curriculum', withStudentParams(mssv));

export const sendChatMessage = (payload) =>
  api.post('/chatbot', typeof payload === 'string' ? { message: payload } : payload, {
    timeout: 30000,
  });

export const studentLogin = (mssv, password) =>
  api.post('/auth/student-login', { mssv, password });

export const parentLogin = (ho_ten, mssv, ngay_sinh, sdt) =>
  api.post('/auth/parent-login', { ho_ten, mssv, ngay_sinh, sdt });

export const adminLogin = (username, password) =>
  api.post('/auth/admin-login', { username, password });

export const teacherLogin = (username, password) =>
  api.post('/auth/teacher-login', { username, password });

export const getAvailableAccounts = () => api.get('/auth/accounts');

export const getAvailableTeachers = () => api.get('/auth/teachers');

export const getAdminStudents = () => api.get('/admin/students');

export const createAdminStudent = (data) => api.post('/admin/students', data);

export const updateAdminStudentPassword = (mssv, new_password) =>
  api.put(`/admin/students/${mssv}/password`, { new_password });

export const getTeacherOverview = (username) =>
  api.get('/teacher/overview', { params: { username } });

export const getTeacherCourses = (username) =>
  api.get('/teacher/courses', { params: { username } });

export const getTeacherCourseStudents = (username, courseCode, term) =>
  api.get(`/teacher/courses/${courseCode}/students`, {
    params: { username, term },
  });

export const updateTeacherStudentGrade = (payload) =>
  api.put('/teacher/grades', payload);

export const importTeacherStudentGrades = (payload) =>
  api.post('/teacher/grades/import', payload);

export const getSystemConfig = () => api.get('/admin/system/config');

export const updateSystemConfig = (data) => api.put('/admin/system/config', data);

export const getAdminTeachers = () => api.get('/admin/teachers');

export const createAdminTeacher = (data) => api.post('/admin/teachers', data);

export const updateAdminTeacherPassword = (username, new_password) =>
  api.put(`/admin/teachers/${username}/password`, { new_password });

export const getAdminTeacherAssignments = (username) => 
  api.get(`/admin/teachers/${username}/assignments`);

export const assignCourseToTeacher = (username, payload) => 
  api.post(`/admin/teachers/${username}/assignments`, payload);

export const removeCourseFromTeacher = (username, courseCode, term) => 
  api.delete(`/admin/teachers/${username}/assignments`, {
    params: { course_code: courseCode, term }
  });

export const updateAdminStudent = (mssv, data) => api.put(`/admin/students/${mssv}`, data);
export const deleteAdminStudent = (mssv) => api.delete(`/admin/students/${mssv}`);
export const bulkImportAdminStudents = (data) => api.post('/admin/students/bulk', data);

export const updateAdminTeacher = (username, data) => api.put(`/admin/teachers/${username}`, data);
export const deleteAdminTeacher = (username) => api.delete(`/admin/teachers/${username}`);
export const bulkImportAdminTeachers = (data) => api.post('/admin/teachers/bulk', data);

export const getAdminSchedule = () => api.get('/admin/schedule');
export const createAdminSchedule = (data) => api.post('/admin/schedule', data);
export const updateAdminSchedule = (id, data) => api.put(`/admin/schedule/${id}`, data);
export const deleteAdminSchedule = (id) => api.delete(`/admin/schedule/${id}`);

export const getAdminNotifications = () => api.get('/admin/notifications');
export const createAdminNotification = (data) => api.post('/admin/notifications', data);
export const updateAdminNotification = (id, data) => api.put(`/admin/notifications/${id}`, data);
export const deleteAdminNotification = (id) => api.delete(`/admin/notifications/${id}`);

export const timetableAdminLogin = async (username, password) => {
  const response = await timetableApi.post('/auth/login', {
    role: 'admin',
    username,
    password,
  });
  setTimetableAccessToken(response.data?.access_token);
  return response;
};

export const getTimetableSourceTerms = () => timetableApi.get('/admin/import/source-terms');

export const importCoreSections = (termCode, limit = 100) =>
  timetableApi.post('/admin/import/core-sections', {
    term_code: termCode,
    limit,
  });

export const getCourseSections = (termCode) =>
  timetableApi.get('/course-sections', {
    params: { term_code: termCode },
  });

export const downloadTimetableCsvScaffold = (termCode, includeOptional = true) =>
  timetableApi.get('/admin/import/timetable-entries/csv-scaffold', {
    params: {
      term_code: termCode,
      include_optional: includeOptional,
    },
    responseType: 'blob',
  });

export const uploadTimetableCsv = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return timetableApi.post('/admin/import/timetable-entries/csv', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const getTimetableDebugSummary = (termCode) =>
  timetableApi.get('/admin/import/debug-summary', {
    params: { term_code: termCode },
  });

export default api;
