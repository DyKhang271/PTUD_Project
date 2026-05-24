import { useEffect, useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import { fetchStudentExams } from "../../services/studentApi";

function formatExamDate(item) {
  return new Date(`${item.exam_date}T00:00:00`).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function StudentExams() {
  const [state, setState] = useState({ loading: true, error: "", items: [] });

  async function load() {
    setState({ loading: true, error: "", items: [] });
    try {
      const items = await fetchStudentExams();
      setState({ loading: false, error: "", items });
    } catch (err) {
      setState({ loading: false, error: err?.response?.data?.detail || "Không tải được lịch thi.", items: [] });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const upcoming = [];
    const past = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    state.items.forEach((item) => {
      const examDate = new Date(`${item.exam_date}T00:00:00`);
      if (examDate >= today) {
        upcoming.push(item);
      } else {
        past.push(item);
      }
    });
    return { upcoming, past };
  }, [state.items]);

  if (state.loading) return <LoadingState label="Đang tải lịch thi..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  return (
    <div className="section-stack">
      <div className="page-header timetable-hero">
        <div>
          <div className="eyebrow">Lịch thi cá nhân</div>
          <h2 className="page-title">Lịch thi sinh viên</h2>
          <p className="page-subtitle">Xem nhanh môn thi sắp diễn ra, phòng thi và giảng viên phụ trách lớp học phần.</p>
        </div>
        <div className="hero-note">
          <strong>{grouped.upcoming.length}</strong>
          <span>Bài thi sắp tới đang hiển thị ở đầu trang để bạn theo dõi dễ hơn.</span>
        </div>
      </div>

      {!state.items.length ? (
        <EmptyState message="Chưa có lịch thi nào được công bố." />
      ) : (
        <>
          <div className="cards-grid">
            {grouped.upcoming.slice(0, 3).map((item) => (
              <article key={item.id} className="panel exam-card">
                <div className="exam-card-type">{item.exam_type || "Lịch thi"}</div>
                <h3>{item.course_name}</h3>
                <p>{item.section_code} • {item.course_code}</p>
                <div className="exam-card-meta">{formatExamDate(item)}</div>
                <div className="exam-card-meta">{item.start_time || "--"} - {item.end_time || "--"}</div>
                <div className="exam-card-meta">{item.room || item.location || "Chưa cập nhật phòng thi"}</div>
                <div className="exam-card-meta">{item.teacher_name || item.teacher_external_id || "Chưa cập nhật giảng viên"}</div>
              </article>
            ))}
          </div>

          <div className="table-card">
            <div className="page-header">
              <h3 className="page-title">Danh sách lịch thi</h3>
              <p className="page-subtitle">Toàn bộ lịch thi thuộc các lớp học phần mà bạn đang tham gia.</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Môn học</th>
                  <th>Ngày thi</th>
                  <th>Giờ thi</th>
                  <th>Phòng</th>
                  <th>Giảng viên</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((item) => {
                  const examDate = new Date(`${item.exam_date}T00:00:00`);
                  const isUpcoming = examDate >= new Date(new Date().toISOString().slice(0, 10));
                  return (
                    <tr key={item.id}>
                      <td>
                        <div>{item.course_name}</div>
                        <div className="helper-text">{item.section_code} • {item.course_code}</div>
                      </td>
                      <td>{formatExamDate(item)}</td>
                      <td>{item.start_time || "--"} - {item.end_time || "--"}</td>
                      <td>{item.room || item.location || "--"}</td>
                      <td>{item.teacher_name || item.teacher_external_id || "--"}</td>
                      <td>{isUpcoming ? "Sắp diễn ra" : "Đã qua"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
