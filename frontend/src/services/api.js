import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const withStudentParams = (mssv, extraParams = {}) => ({
  params: {
    ...(mssv ? { mssv } : {}),
    ...extraParams,
  },
});

export const getStudent = (mssv) => api.get('/student', withStudentParams(mssv));

export const getSchedule = () => api.get('/schedule');

export const getNotifications = () => api.get('/notifications');

export const getGrades = (semester, mssv) =>
  api.get('/grades', withStudentParams(mssv, { semester }));

export const getGradesSummary = (mssv) =>
  api.get('/grades/summary', withStudentParams(mssv));

export const getCurriculum = (mssv) =>
  api.get('/curriculum', withStudentParams(mssv));

export const sendChatMessage = (message) =>
  api.post('/chatbot', { message });

export const studentLogin = (mssv, password) =>
  api.post('/auth/student-login', { mssv, password });

export const parentLogin = (ho_ten, mssv, ngay_sinh, sdt) =>
  api.post('/auth/parent-login', { ho_ten, mssv, ngay_sinh, sdt });

export const adminLogin = (username, password) =>
  api.post('/auth/admin-login', { username, password });

export const getAvailableAccounts = () => api.get('/auth/accounts');

export const getAdminStudents = () => api.get('/admin/students');

export const createAdminStudent = (data) => api.post('/admin/students', data);

export const updateAdminStudentPassword = (mssv, new_password) =>
  api.put(`/admin/students/${mssv}/password`, { new_password });

export default api;
