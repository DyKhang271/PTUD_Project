import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import StatusBadge from "../../components/StatusBadge";
import { fetchStudentAttendanceSummary, fetchStudentExams, fetchStudentTimetable } from "../../services/studentApi";

const REQUIRED_THRESHOLD = 80;

function formatDateTime(dateValue, timeValue) {
  if (!dateValue) return "Chưa xác định";
  return `${new Date(`${dateValue}T00:00:00`).toLocaleDateString("vi-VN")} ${timeValue || ""}`.trim();
}

function getWeekStart(baseDate) {
  const date = new Date(baseDate);
  const weekday = date.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function safeAbsencesRemaining(item) {
  const attended = item.present_count + item.late_count + item.excused_count;
  if (!item.total_sessions) return null;
  return Math.max(0, Math.floor(attended / (REQUIRED_THRESHOLD / 100) - item.total_sessions));
}

export default function StudentDashboard() {
  const [state, setState] = useState({
    loading: true,
    error: "",
    summary: [],
    timetable: [],
    exams: [],
  });

  async function load() {
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    const currentDate = new Date();
    const currentWeekStart = getWeekStart(currentDate);
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6);

    setState({ loading: false, error: "", summary: [], timetable: [], exams: [] });

    const [summaryResult, timetableResult, examsResult] = await Promise.allSettled([
      fetchStudentAttendanceSummary(),
      fetchStudentTimetable({
        date_from: toDateInputValue(currentWeekStart),
        date_to: toDateInputValue(currentWeekEnd),
      }),
      fetchStudentExams(),
    ]);

    setState((prev) => ({
      ...prev,
      summary: summaryResult.status === "fulfilled" && Array.isArray(summaryResult.value) ? summaryResult.value : [],
      timetable: timetableResult.status === "fulfilled" && Array.isArray(timetableResult.value) ? timetableResult.value : [],
      exams: examsResult.status === "fulfilled" && Array.isArray(examsResult.value) ? examsResult.value : [],
    }));
  }

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    const totalSessions = state.summary.reduce((sum, item) => sum + item.total_sessions, 0);
    const present = state.summary.reduce((sum, item) => sum + item.present_count, 0);
    const late = state.summary.reduce((sum, item) => sum + item.late_count, 0);
    const absent = state.summary.reduce((sum, item) => sum + item.absent_count, 0);
    const excused = state.summary.reduce((sum, item) => sum + item.excused_count, 0);
    const rate = totalSessions ? Math.round(((present + late + excused) / totalSessions) * 100) : 100;
    return { totalSessions, present, late, absent, excused, rate };
  }, [state.summary]);

  const riskyCourses = state.summary.filter((item) => item.total_sessions > 0 && item.warning_status === "warning");

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayItems = useMemo(
    () => state.timetable.filter((item) => item.date === todayKey).sort((left, right) => `${left.start_time || ""}`.localeCompare(`${right.start_time || ""}`)),
    [state.timetable, todayKey],
  );

  const nextClass = useMemo(() => {
    const now = new Date();
    return state.timetable
      .map((item) => ({
        ...item,
        startAt: item.date && item.start_time ? new Date(`${item.date}T${item.start_time}`) : null,
      }))
      .filter((item) => item.startAt && item.startAt >= now)
      .sort((left, right) => left.startAt - right.startAt)[0];
  }, [state.timetable]);

  const nearestExam = useMemo(() => {
    const today = new Date(`${todayKey}T00:00:00`);
    return state.exams
      .map((item) => ({ ...item, examAt: new Date(`${item.exam_date}T${item.start_time || "00:00"}`) }))
      .filter((item) => item.examAt >= today)
      .sort((left, right) => left.examAt - right.examAt)[0];
  }, [state.exams, todayKey]);

  if (state.loading) return <LoadingState label="Đang tải dashboard sinh viên..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  return (
    <div className="section-stack">
      <div className="page-header timetable-hero">
        <div>
          <div className="eyebrow">Trang tổng quan học vụ</div>
          <h2 className="page-title">Dashboard sinh viên</h2>
          <p className="page-subtitle">Theo dõi lịch học, lịch thi và chuyên cần trên cùng một màn hình.</p>
        </div>
        <div className="hero-note">
          <strong>{totals.rate}%</strong>
          <span>Tỷ lệ chuyên cần hiện tại của bạn trên toàn bộ các buổi đã ghi nhận.</span>
        </div>
      </div>

      <div className="cards-grid">
        <div className="panel metric-card">
          <h3>{totals.rate}%</h3>
          <p>Tỷ lệ chuyên cần</p>
        </div>
        <div className="panel metric-card">
          <h3>{totals.present}</h3>
          <p>Có mặt</p>
        </div>
        <div className="panel metric-card">
          <h3>{totals.absent}</h3>
          <p>Vắng</p>
        </div>
        <div className="panel metric-card">
          <h3>{totals.late}</h3>
          <p>Đi trễ</p>
        </div>
        <div className="panel metric-card">
          <h3>{riskyCourses.length}</h3>
          <p>Môn cần lưu ý</p>
        </div>
      </div>

      <div className="three-column-grid">
        <div className="panel spotlight-card">
          <div className="spotlight-head">
            <div>
              <h3>Lịch học hôm nay</h3>
              <p>{todayItems.length ? `${todayItems.length} buổi trong ngày` : "Không có lịch trong hôm nay"}</p>
            </div>
            <Link className="link-button" to="/student/timetable">
              Xem thời khóa biểu
            </Link>
          </div>
          {todayItems.length ? (
            todayItems.slice(0, 3).map((item) => (
              <div key={item.timetable_entry_id} className="schedule-line">
                <strong>{item.course_name}</strong>
                <span>{item.section_code} • {item.start_time || "--"} - {item.end_time || "--"}</span>
                <span>{item.room || item.location || "Chưa cập nhật phòng"}</span>
              </div>
            ))
          ) : (
            <EmptyState message="Hôm nay chưa có buổi học nào." />
          )}
        </div>

        <div className="panel spotlight-card">
          <div className="spotlight-head">
            <div>
              <h3>Môn sắp tới</h3>
              <p>Buổi học gần nhất trong tuần</p>
            </div>
            <Link className="link-button" to="/student/timetable">
              Mở lịch tuần
            </Link>
          </div>
          {nextClass ? (
            <div className="spotlight-main">
              <strong>{nextClass.course_name}</strong>
              <span>{nextClass.section_code}</span>
              <span>{formatDateTime(nextClass.date, nextClass.start_time)}</span>
              <span>{nextClass.room || nextClass.location || "Chưa cập nhật phòng"}</span>
            </div>
          ) : (
            <EmptyState message="Không còn buổi học nào sắp tới trong tuần này." />
          )}
        </div>

        <div className="panel spotlight-card">
          <div className="spotlight-head">
            <div>
              <h3>Lịch thi gần nhất</h3>
              <p>Kỳ thi sắp diễn ra</p>
            </div>
            <Link className="link-button" to="/student/exams">
              Xem lịch thi
            </Link>
          </div>
          {nearestExam ? (
            <div className="spotlight-main">
              <strong>{nearestExam.course_name}</strong>
              <span>{nearestExam.section_code}</span>
              <span>{formatDateTime(nearestExam.exam_date, nearestExam.start_time)}</span>
              <span>{nearestExam.room || nearestExam.location || "Chưa cập nhật phòng thi"}</span>
            </div>
          ) : (
            <EmptyState message="Chưa có lịch thi nào gần nhất." />
          )}
        </div>
      </div>

      <div className="table-card">
        <div className="page-header">
          <h3 className="page-title">Cảnh báo chuyên cần</h3>
          <p className="page-subtitle">Theo dõi các môn đang tiến gần ngưỡng cảnh báo chuyên cần.</p>
        </div>
        {riskyCourses.length ? (
          <table>
            <thead>
              <tr>
                <th>Môn học</th>
                <th>Tỷ lệ chuyên cần</th>
                <th>Ngưỡng yêu cầu</th>
                <th>Trạng thái</th>
                <th>Số buổi vắng còn an toàn</th>
              </tr>
            </thead>
            <tbody>
              {riskyCourses.map((item) => (
                <tr key={item.section_id} className="state-warning">
                  <td>
                    <div>{item.course_name}</div>
                    <div className="helper-text">{item.section_code}</div>
                  </td>
                  <td>{item.attendance_percent}% ({item.total_sessions} buổi đã ghi nhận)</td>
                  <td>{REQUIRED_THRESHOLD}%</td>
                  <td><StatusBadge status="warning" /></td>
                  <td>{safeAbsencesRemaining(item)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message={totals.totalSessions ? "Chưa có môn nào dưới ngưỡng cảnh báo." : "Chưa có dữ liệu điểm danh để đánh giá."} />
        )}
      </div>
    </div>
  );
}
