import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getStudent = () => api.get('/student');

export const getSchedule = () => api.get('/schedule');

export const getNotifications = () => api.get('/notifications');

export const getGrades = (semester) =>
  api.get('/grades', { params: { semester } });

export const getGradesSummary = () => api.get('/grades/summary');

export const getCurriculum = () => api.get('/curriculum');

export const sendChatMessage = (message) =>
  api.post('/chatbot', { message });

export const studentLogin = (mssv, password) =>
  api.post('/auth/student-login', { mssv, password });

export const parentLogin = (ho_ten, mssv, ngay_sinh, sdt) =>
  api.post('/auth/parent-login', { ho_ten, mssv, ngay_sinh, sdt });

export default api;
