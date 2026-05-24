import { useEffect, useMemo, useState } from "react";

import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import {
  createExam,
  createTimetableEntry,
  deleteExam,
  deleteTimetableEntry,
  fetchCourseSections,
  fetchExams,
  fetchTerms,
  fetchTimetableEntries,
  updateExam,
  updateTimetableEntry,
} from "../../services/adminApi";

const initialTimetableForm = {
  id: "",
  section_id: "",
  day_of_week: 2,
  start_time: "",
  end_time: "",
  room: "",
  location: "",
  status: "published",
};

const initialExamForm = {
  id: "",
  section_id: "",
  exam_date: "",
  start_time: "",
  end_time: "",
  room: "",
  location: "",
};

export default function TimetableManagement() {
  const [state, setState] = useState({ loading: true, error: "", sections: [], entries: [], exams: [], terms: [] });
  const [filters, setFilters] = useState({ term_id: "", section_id: "", teacher_id: "" });
  const [timetableForm, setTimetableForm] = useState(initialTimetableForm);
  const [examForm, setExamForm] = useState(initialExamForm);
  const [feedback, setFeedback] = useState("");

  async function load() {
    setState({ loading: true, error: "", sections: [], entries: [], exams: [], terms: [] });
    try {
      const [sections, entries, exams, terms] = await Promise.all([
        fetchCourseSections(),
        fetchTimetableEntries(),
        fetchExams(),
        fetchTerms(),
      ]);
      setState({ loading: false, error: "", sections, entries, exams, terms });
    } catch (err) {
      setState({
        loading: false,
        error: err?.response?.data?.detail || "Khong tai duoc module lich hoc va lich thi.",
        sections: [],
        entries: [],
        exams: [],
        terms: [],
      });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const sectionMap = useMemo(
    () => new Map(state.sections.map((section) => [section.id, section])),
    [state.sections],
  );

  const teacherOptions = useMemo(() => {
    const values = new Set();
    state.sections.forEach((section) => {
      if (section.teacher_external_id) {
        values.add(section.teacher_external_id);
      }
    });
    return [...values].sort();
  }, [state.sections]);

  const filteredSections = useMemo(() => {
    return state.sections.filter((section) => {
      if (filters.term_id && section.term_id !== filters.term_id) {
        return false;
      }
      if (filters.section_id && section.id !== filters.section_id) {
        return false;
      }
      if (filters.teacher_id && section.teacher_external_id !== filters.teacher_id) {
        return false;
      }
      return true;
    });
  }, [filters, state.sections]);

  const filteredSectionIds = new Set(filteredSections.map((section) => section.id));

  const filteredEntries = useMemo(
    () => state.entries.filter((entry) => filteredSectionIds.has(entry.section_id)),
    [filteredSectionIds, state.entries],
  );

  const filteredExams = useMemo(
    () => state.exams.filter((exam) => filteredSectionIds.has(exam.section_id)),
    [filteredSectionIds, state.exams],
  );

  async function saveTimetable(event) {
    event.preventDefault();
    setFeedback("");
    const payload = {
      section_id: timetableForm.section_id,
      day_of_week: Number(timetableForm.day_of_week),
      start_time: timetableForm.start_time || null,
      end_time: timetableForm.end_time || null,
      room: timetableForm.room || null,
      location: timetableForm.location || null,
      status: timetableForm.status || "published",
    };
    try {
      if (timetableForm.id) {
        await updateTimetableEntry(timetableForm.id, payload);
        setFeedback("Da cap nhat lich hoc.");
      } else {
        await createTimetableEntry(payload);
        setFeedback("Da tao lich hoc.");
      }
      setTimetableForm(initialTimetableForm);
      await load();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Khong the luu lich hoc.");
    }
  }

  async function saveExam(event) {
    event.preventDefault();
    setFeedback("");
    const payload = {
      section_id: examForm.section_id,
      exam_date: examForm.exam_date,
      start_time: examForm.start_time || null,
      end_time: examForm.end_time || null,
      room: examForm.room || null,
      location: examForm.location || null,
    };
    try {
      if (examForm.id) {
        await updateExam(examForm.id, payload);
        setFeedback("Da cap nhat lich thi.");
      } else {
        await createExam(payload);
        setFeedback("Da tao lich thi.");
      }
      setExamForm(initialExamForm);
      await load();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Khong the luu lich thi.");
    }
  }

  async function removeTimetable(entryId) {
    setFeedback("");
    try {
      await deleteTimetableEntry(entryId);
      await load();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Khong the xoa lich hoc.");
    }
  }

  async function removeExam(examId) {
    setFeedback("");
    try {
      await deleteExam(examId);
      await load();
    } catch (err) {
      setFeedback(err?.response?.data?.detail || "Khong the xoa lich thi.");
    }
  }

  if (state.loading) return <LoadingState label="Dang tai module lich hoc va lich thi..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;

  return (
    <div className="section-stack">
      <div className="page-header">
        <h2 className="page-title">Quan ly lich hoc & thi</h2>
        <p className="page-subtitle">Tao, cap nhat, xoa va loc lich hoc, lich thi theo hoc ky, section va giang vien.</p>
      </div>

      <div className="panel inline-form">
        <label className="field-group">
          <span>Loc theo hoc ky</span>
          <select value={filters.term_id} onChange={(event) => setFilters((prev) => ({ ...prev, term_id: event.target.value }))}>
            <option value="">Tat ca hoc ky</option>
            {state.terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.term_code}
              </option>
            ))}
          </select>
        </label>
        <label className="field-group">
          <span>Loc theo section</span>
          <select value={filters.section_id} onChange={(event) => setFilters((prev) => ({ ...prev, section_id: event.target.value }))}>
            <option value="">Tat ca section</option>
            {filteredSections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.section_code}
              </option>
            ))}
          </select>
        </label>
        <label className="field-group">
          <span>Loc theo giang vien</span>
          <select value={filters.teacher_id} onChange={(event) => setFilters((prev) => ({ ...prev, teacher_id: event.target.value }))}>
            <option value="">Tat ca giang vien</option>
            {teacherOptions.map((teacherId) => (
              <option key={teacherId} value={teacherId}>
                {teacherId}
              </option>
            ))}
          </select>
        </label>
      </div>

      {feedback ? <div className="state-card">{feedback}</div> : null}

      <div className="two-column-grid">
        <form className="panel form-grid" onSubmit={saveTimetable}>
          <h3>{timetableForm.id ? "Cap nhat lich hoc" : "Tao lich hoc"}</h3>
          <label className="field-group">
            <span>Section</span>
            <select
              value={timetableForm.section_id}
              onChange={(event) => setTimetableForm((prev) => ({ ...prev, section_id: event.target.value }))}
            >
              <option value="">Chon section</option>
              {filteredSections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.section_code} - {section.course_name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-group">
            <span>Thu</span>
            <input
              type="number"
              min="1"
              max="7"
              value={timetableForm.day_of_week}
              onChange={(event) => setTimetableForm((prev) => ({ ...prev, day_of_week: event.target.value }))}
            />
          </label>
          <label className="field-group">
            <span>Bat dau</span>
            <input
              type="time"
              value={timetableForm.start_time}
              onChange={(event) => setTimetableForm((prev) => ({ ...prev, start_time: event.target.value }))}
            />
          </label>
          <label className="field-group">
            <span>Ket thuc</span>
            <input
              type="time"
              value={timetableForm.end_time}
              onChange={(event) => setTimetableForm((prev) => ({ ...prev, end_time: event.target.value }))}
            />
          </label>
          <label className="field-group">
            <span>Phong</span>
            <input value={timetableForm.room} onChange={(event) => setTimetableForm((prev) => ({ ...prev, room: event.target.value }))} />
          </label>
          <label className="field-group">
            <span>Co so / vi tri</span>
            <input
              value={timetableForm.location}
              onChange={(event) => setTimetableForm((prev) => ({ ...prev, location: event.target.value }))}
            />
          </label>
          <div className="button-row">
            <button className="primary-button" type="submit">
              {timetableForm.id ? "Cap nhat lich hoc" : "Tao lich hoc"}
            </button>
            {timetableForm.id ? (
              <button className="secondary-button" type="button" onClick={() => setTimetableForm(initialTimetableForm)}>
                Huy sua
              </button>
            ) : null}
          </div>
        </form>

        <form className="panel form-grid" onSubmit={saveExam}>
          <h3>{examForm.id ? "Cap nhat lich thi" : "Tao lich thi"}</h3>
          <label className="field-group">
            <span>Section</span>
            <select value={examForm.section_id} onChange={(event) => setExamForm((prev) => ({ ...prev, section_id: event.target.value }))}>
              <option value="">Chon section</option>
              {filteredSections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.section_code} - {section.course_name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-group">
            <span>Ngay thi</span>
            <input type="date" value={examForm.exam_date} onChange={(event) => setExamForm((prev) => ({ ...prev, exam_date: event.target.value }))} />
          </label>
          <label className="field-group">
            <span>Bat dau</span>
            <input type="time" value={examForm.start_time} onChange={(event) => setExamForm((prev) => ({ ...prev, start_time: event.target.value }))} />
          </label>
          <label className="field-group">
            <span>Ket thuc</span>
            <input type="time" value={examForm.end_time} onChange={(event) => setExamForm((prev) => ({ ...prev, end_time: event.target.value }))} />
          </label>
          <label className="field-group">
            <span>Phong</span>
            <input value={examForm.room} onChange={(event) => setExamForm((prev) => ({ ...prev, room: event.target.value }))} />
          </label>
          <div className="button-row">
            <button className="primary-button" type="submit">
              {examForm.id ? "Cap nhat lich thi" : "Tao lich thi"}
            </button>
            {examForm.id ? (
              <button className="secondary-button" type="button" onClick={() => setExamForm(initialExamForm)}>
                Huy sua
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="two-column-grid">
        <div className="table-card">
          <h3 className="page-title">Danh sach lich hoc</h3>
          {filteredEntries.length ? (
            <table>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Mon hoc</th>
                  <th>Thu gio</th>
                  <th>Phong</th>
                  <th>Thao tac</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((item) => {
                  const section = sectionMap.get(item.section_id);
                  return (
                    <tr key={item.id}>
                      <td>{section?.section_code || item.section_id}</td>
                      <td>{section?.course_name || "--"}</td>
                      <td>
                        Thu {item.day_of_week} | {item.start_time || "--"} - {item.end_time || "--"}
                      </td>
                      <td>{item.room || item.location || "--"}</td>
                      <td className="table-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() =>
                            setTimetableForm({
                              id: item.id,
                              section_id: item.section_id,
                              day_of_week: item.day_of_week,
                              start_time: item.start_time || "",
                              end_time: item.end_time || "",
                              room: item.room || "",
                              location: item.location || "",
                              status: item.status || "published",
                            })
                          }
                        >
                          Sua
                        </button>
                        <button className="danger-button" type="button" onClick={() => removeTimetable(item.id)}>
                          Xoa
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyState message="Chua co lich hoc phu hop." />
          )}
        </div>

        <div className="table-card">
          <h3 className="page-title">Danh sach lich thi</h3>
          {filteredExams.length ? (
            <table>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Mon hoc</th>
                  <th>Ngay gio</th>
                  <th>Phong</th>
                  <th>Thao tac</th>
                </tr>
              </thead>
              <tbody>
                {filteredExams.map((item) => {
                  const section = sectionMap.get(item.section_id);
                  return (
                    <tr key={item.id}>
                      <td>{section?.section_code || item.section_id}</td>
                      <td>{section?.course_name || "--"}</td>
                      <td>
                        {item.exam_date} | {item.start_time || "--"} - {item.end_time || "--"}
                      </td>
                      <td>{item.room || item.location || "--"}</td>
                      <td className="table-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() =>
                            setExamForm({
                              id: item.id,
                              section_id: item.section_id,
                              exam_date: item.exam_date,
                              start_time: item.start_time || "",
                              end_time: item.end_time || "",
                              room: item.room || "",
                              location: item.location || "",
                            })
                          }
                        >
                          Sua
                        </button>
                        <button className="danger-button" type="button" onClick={() => removeExam(item.id)}>
                          Xoa
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyState message="Chua co lich thi phu hop." />
          )}
        </div>
      </div>
    </div>
  );
}
