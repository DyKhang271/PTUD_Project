import { useEffect, useState } from "react";
import {
  createExam,
  createTimetableEntry,
  fetchCourseSections,
  fetchExams,
  fetchTimetableEntries,
} from "../../services/adminApi";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";

export default function TimetableManagement() {
  const [state, setState] = useState({ loading: true, error: "", sections: [], entries: [], exams: [] });
  const [timetableForm, setTimetableForm] = useState({
    section_id: "",
    day_of_week: 2,
    start_time: "",
    end_time: "",
    room: "",
    location: "",
  });
  const [examForm, setExamForm] = useState({
    section_id: "",
    exam_date: "",
    start_time: "",
    end_time: "",
    room: "",
  });

  async function load() {
    setState({ loading: true, error: "", sections: [], entries: [], exams: [] });
    try {
      const sections = await fetchCourseSections();
      const entries = await fetchTimetableEntries();
      const exams = await fetchExams();
      setState({ loading: false, error: "", sections, entries, exams });
    } catch (err) {
      setState({ loading: false, error: err?.response?.data?.detail || "Không tải được lịch học/lịch thi.", sections: [], entries: [], exams: [] });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreateTimetable(event) {
    event.preventDefault();
    await createTimetableEntry({
      ...timetableForm,
      day_of_week: Number(timetableForm.day_of_week),
      start_time: timetableForm.start_time || null,
      end_time: timetableForm.end_time || null,
      room: timetableForm.room || null,
      location: timetableForm.location || null,
    });
    await load();
  }

  async function handleCreateExam(event) {
    event.preventDefault();
    await createExam({
      ...examForm,
      start_time: examForm.start_time || null,
      end_time: examForm.end_time || null,
      room: examForm.room || null,
    });
    await load();
  }

  if (state.loading) return <LoadingState label="Đang tải lịch học và lịch thi..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  return (
    <div className="section-stack">
      <form className="panel inline-form" onSubmit={handleCreateTimetable}>
        <label className="field-group">
          <span>Lớp HP</span>
          <select value={timetableForm.section_id} onChange={(event) => setTimetableForm((prev) => ({ ...prev, section_id: event.target.value }))}>
            <option value="">Chọn lớp</option>
            {state.sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.section_code}
              </option>
            ))}
          </select>
        </label>
        <label className="field-group">
          <span>Thứ</span>
          <input type="number" min="1" max="7" value={timetableForm.day_of_week} onChange={(event) => setTimetableForm((prev) => ({ ...prev, day_of_week: event.target.value }))} />
        </label>
        <label className="field-group">
          <span>Bắt đầu</span>
          <input type="time" value={timetableForm.start_time} onChange={(event) => setTimetableForm((prev) => ({ ...prev, start_time: event.target.value }))} />
        </label>
        <label className="field-group">
          <span>Kết thúc</span>
          <input type="time" value={timetableForm.end_time} onChange={(event) => setTimetableForm((prev) => ({ ...prev, end_time: event.target.value }))} />
        </label>
        <button className="primary-button" type="submit">
          Thêm lịch học
        </button>
      </form>

      <form className="panel inline-form" onSubmit={handleCreateExam}>
        <label className="field-group">
          <span>Lớp HP</span>
          <select value={examForm.section_id} onChange={(event) => setExamForm((prev) => ({ ...prev, section_id: event.target.value }))}>
            <option value="">Chọn lớp</option>
            {state.sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.section_code}
              </option>
            ))}
          </select>
        </label>
        <label className="field-group">
          <span>Ngày thi</span>
          <input type="date" value={examForm.exam_date} onChange={(event) => setExamForm((prev) => ({ ...prev, exam_date: event.target.value }))} />
        </label>
        <label className="field-group">
          <span>Bắt đầu</span>
          <input type="time" value={examForm.start_time} onChange={(event) => setExamForm((prev) => ({ ...prev, start_time: event.target.value }))} />
        </label>
        <button className="secondary-button" type="submit">
          Thêm lịch thi
        </button>
      </form>

      <div className="two-column-grid">
        <div className="table-card">
          <h2 className="page-title">Lịch học</h2>
          {state.entries.length ? (
            <table>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Thứ</th>
                  <th>Giờ</th>
                  <th>Phòng</th>
                </tr>
              </thead>
              <tbody>
                {state.entries.map((item) => (
                  <tr key={item.id}>
                    <td>{item.section_id}</td>
                    <td>{item.day_of_week}</td>
                    <td>{item.start_time || "--"} - {item.end_time || "--"}</td>
                    <td>{item.room || item.location || "--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState message="Chưa có lịch học." />
          )}
        </div>
        <div className="table-card">
          <h2 className="page-title">Lịch thi</h2>
          {state.exams.length ? (
            <table>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Ngày</th>
                  <th>Giờ</th>
                  <th>Phòng</th>
                </tr>
              </thead>
              <tbody>
                {state.exams.map((item) => (
                  <tr key={item.id}>
                    <td>{item.section_id}</td>
                    <td>{item.exam_date}</td>
                    <td>{item.start_time || "--"} - {item.end_time || "--"}</td>
                    <td>{item.room || item.location || "--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState message="Chưa có lịch thi." />
          )}
        </div>
      </div>
    </div>
  );
}
