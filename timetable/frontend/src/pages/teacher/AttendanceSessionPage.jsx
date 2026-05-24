import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import StatusBadge from "../../components/StatusBadge";
import {
  closeAttendanceSession,
  createAttendanceSession,
  fetchAttendanceRecords,
  fetchTeacherSection,
  fetchTeacherSectionAttendanceSessions,
  fetchTeacherSectionStudents,
  fetchTeacherSectionTimetable,
  openAttendanceSession,
  updateAttendanceRecordsBatch,
} from "../../services/teacherApi";

const statusOptions = [
  { value: "present", label: "Có mặt" },
  { value: "late", label: "Đi muộn" },
  { value: "absent", label: "Vắng" },
  { value: "excused", label: "Có phép" },
  { value: "unknown", label: "Chưa ghi nhận" },
];

function buildDraft(students, records) {
  const byStudent = new Map(records.map((record) => [record.student_external_id, record]));
  return students.reduce((acc, student) => {
    const record = byStudent.get(student.student_external_id);
    acc[student.student_external_id] = {
      status: record?.status || "unknown",
      note: record?.note || "",
      updated_at: record?.updated_at || null,
    };
    return acc;
  }, {});
}

export default function AttendanceSessionPage() {
  const { sectionId } = useParams();
  const [base, setBase] = useState({ loading: true, error: "", section: null, students: [], timetable: [], sessions: [] });
  const [session, setSession] = useState(null);
  const [records, setRecords] = useState([]);
  const [draft, setDraft] = useState({});
  const [openPayload, setOpenPayload] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [form, setForm] = useState({
    timetable_entry_id: "",
    session_date: new Date().toISOString().slice(0, 10),
    start_time: "",
    end_time: "",
    note: "",
  });

  async function loadBase() {
    setBase({ loading: true, error: "", section: null, students: [], timetable: [], sessions: [] });
    try {
      const [section, students, timetable, sessions] = await Promise.all([
        fetchTeacherSection(sectionId),
        fetchTeacherSectionStudents(sectionId),
        fetchTeacherSectionTimetable(sectionId),
        fetchTeacherSectionAttendanceSessions(sectionId),
      ]);
      setBase({ loading: false, error: "", section, students, timetable, sessions });
      if (timetable.length) {
        const first = timetable[0];
        setForm((prev) => ({
          ...prev,
          timetable_entry_id: prev.timetable_entry_id || first.id,
          start_time: prev.start_time || first.start_time || "",
          end_time: prev.end_time || first.end_time || "",
        }));
      }
    } catch (err) {
      setBase({ loading: false, error: err?.response?.data?.detail || "Không tải được dữ liệu lớp.", section: null, students: [], timetable: [], sessions: [] });
    }
  }

  async function loadRecords(nextSession, students = base.students) {
    const data = await fetchAttendanceRecords(nextSession.id);
    setRecords(data);
    setDraft(buildDraft(students, data));
  }

  useEffect(() => {
    loadBase();
  }, [sectionId]);

  async function handleCreateSession(event) {
    event.preventDefault();
    setActionError("");
    try {
      const created = await createAttendanceSession({
        section_id: sectionId,
        session_date: form.session_date,
        timetable_entry_id: form.timetable_entry_id || null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        note: form.note || null,
      });
      setSession(created);
      setOpenPayload(null);
      await loadRecords(created);
      const sessions = await fetchTeacherSectionAttendanceSessions(sectionId);
      setBase((prev) => ({ ...prev, sessions }));
    } catch (err) {
      setActionError(err?.response?.data?.detail || "Không tạo được phiên điểm danh.");
    }
  }

  async function handleSelectSession(event) {
    const selected = base.sessions.find((item) => item.id === event.target.value);
    setSession(selected || null);
    setOpenPayload(null);
    setActionError("");
    if (selected) await loadRecords(selected);
  }

  function updateDraft(studentId, values) {
    setDraft((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...values } }));
  }

  function markAll(status) {
    setDraft((prev) =>
      base.students.reduce((acc, student) => {
        acc[student.student_external_id] = { ...prev[student.student_external_id], status };
        return acc;
      }, {})
    );
  }

  function resetChanges() {
    setDraft(buildDraft(base.students, records));
  }

  async function saveAttendance() {
    if (!session?.id) return false;
    setSaving(true);
    setActionError("");
    try {
      const payload = base.students
        .map((student) => ({
          student_id: student.student_external_id,
          status: draft[student.student_external_id]?.status || "absent",
          note: draft[student.student_external_id]?.note || null,
        }))
        .filter((item) => item.status !== "unknown");
      const updated = await updateAttendanceRecordsBatch(session.id, payload);
      setRecords(updated);
      setDraft(buildDraft(base.students, updated));
      return true;
    } catch (err) {
      setActionError(err?.response?.data?.detail || "Không lưu được điểm danh.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleOpenSession() {
    if (!session?.id) return;
    setActionError("");
    try {
      const opened = await openAttendanceSession(session.id);
      setSession(opened.session);
      setOpenPayload(opened);
      await loadRecords(opened.session);
      const sessions = await fetchTeacherSectionAttendanceSessions(sectionId);
      setBase((prev) => ({ ...prev, sessions }));
    } catch (err) {
      setActionError(err?.response?.data?.detail || "Không mở lại được phiên điểm danh.");
    }
  }

  async function handleCloseSession() {
    if (!session?.id) return;
    setActionError("");
    try {
      const saved = await saveAttendance();
      if (!saved) return;
      const closed = await closeAttendanceSession(session.id);
      setSession(closed);
      const sessions = await fetchTeacherSectionAttendanceSessions(sectionId);
      setBase((prev) => ({ ...prev, sessions }));
    } catch (err) {
      setActionError(err?.response?.data?.detail || "Không đóng được phiên điểm danh.");
    }
  }

  const changedCount = useMemo(() => {
    const original = buildDraft(base.students, records);
    return base.students.filter((student) => {
      const id = student.student_external_id;
      return draft[id]?.status !== original[id]?.status || (draft[id]?.note || "") !== (original[id]?.note || "");
    }).length;
  }, [base.students, records, draft]);

  if (base.loading) return <LoadingState label="Đang tải không gian điểm danh..." />;
  if (base.error) return <ErrorState message={base.error} onRetry={loadBase} />;
  if (!base.section) return <EmptyState message="Không tìm thấy lớp học phần." />;

  return (
    <div className="section-stack">
      <div className="page-header">
        <h2 className="page-title">Điểm danh thủ công</h2>
        <p className="page-subtitle">{base.section.course_name} - {base.section.section_code}</p>
      </div>

      {actionError ? <div className="state-card state-error">{actionError}</div> : null}

      <div className="two-column-grid">
        <form className="panel form-grid" onSubmit={handleCreateSession}>
          <h3>Tạo phiên điểm danh</h3>
          <label className="field-group">
            <span>Buổi học</span>
            <select
              value={form.timetable_entry_id}
              onChange={(event) => {
                const selected = base.timetable.find((item) => item.id === event.target.value);
                setForm((prev) => ({
                  ...prev,
                  timetable_entry_id: event.target.value,
                  start_time: selected?.start_time || prev.start_time,
                  end_time: selected?.end_time || prev.end_time,
                }));
              }}
            >
              <option value="">Chọn thủ công</option>
              {base.timetable.map((item) => (
                <option key={item.id} value={item.id}>
                  Thứ {item.day_of_week} - {item.start_time || "--"} - {item.end_time || "--"}
                </option>
              ))}
            </select>
          </label>
          <div className="inline-form">
            <label className="field-group">
              <span>Ngày</span>
              <input type="date" value={form.session_date} onChange={(event) => setForm((prev) => ({ ...prev, session_date: event.target.value }))} />
            </label>
            <label className="field-group">
              <span>Bắt đầu</span>
              <input type="time" value={form.start_time} onChange={(event) => setForm((prev) => ({ ...prev, start_time: event.target.value }))} />
            </label>
            <label className="field-group">
              <span>Kết thúc</span>
              <input type="time" value={form.end_time} onChange={(event) => setForm((prev) => ({ ...prev, end_time: event.target.value }))} />
            </label>
          </div>
          <label className="field-group">
            <span>Ghi chú buổi học</span>
            <textarea value={form.note} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} rows="3" />
          </label>
          <button className="primary-button" type="submit">Tạo phiên</button>
        </form>

        <div className="panel section-stack">
          <h3>Mở phiên đã tạo</h3>
          <label className="field-group">
            <span>Phiên điểm danh</span>
            <select value={session?.id || ""} onChange={handleSelectSession}>
              <option value="">Chọn phiên</option>
              {base.sessions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.session_date} {item.start_time || "--"} - {item.status}
                </option>
              ))}
            </select>
          </label>
          {session ? (
            <div className="section-stack">
              <div className="cards-grid">
                <div>
                  <strong>Lớp</strong>
                  <div>{base.section.section_code}</div>
                </div>
                <div>
                  <strong>Môn học</strong>
                  <div>{base.section.course_name}</div>
                </div>
                <div>
                  <strong>Giảng viên</strong>
                  <div>{base.section.teacher_external_id || "--"}</div>
                </div>
                <div>
                  <strong>Trạng thái</strong>
                  <div><StatusBadge status={session.status} /></div>
                </div>
              </div>
              <div className="helper-text">Ngày {session.session_date} | {session.start_time || "--"} - {session.end_time || "--"}</div>
              <details>
                <summary>Student self check-in (advanced)</summary>
                <div className="section-stack">
                  <p className="helper-text">Chỉ dùng khi muốn cho sinh viên tự check-in bằng mã hoặc QR.</p>
                  <button className="secondary-button" onClick={handleOpenSession} type="button">Tạo mã self check-in</button>
                  {openPayload ? (
                    <div className="section-stack">
                      <div><strong>Check-in code</strong><div className="code-block">{openPayload.checkin_code}</div></div>
                      <div><strong>QR token</strong><div className="code-block">{openPayload.qr_token}</div></div>
                      <div className="helper-text">Hết hạn lúc: {openPayload.expires_at}</div>
                    </div>
                  ) : null}
                </div>
              </details>
            </div>
          ) : (
            <EmptyState message="Chọn hoặc tạo phiên để bắt đầu điểm danh." />
          )}
        </div>
      </div>

      <div className="table-card section-stack">
        <div className="page-header">
          <h3>Danh sách sinh viên</h3>
          <p className="page-subtitle">Phiên mới tự khởi tạo toàn bộ sinh viên ở trạng thái Vắng. Giảng viên cập nhật thủ công rồi lưu một lần.</p>
        </div>
        <div className="button-row">
          <button className="secondary-button" onClick={() => markAll("present")} disabled={!session} type="button">Mark all present</button>
          <button className="secondary-button" onClick={() => markAll("absent")} disabled={!session} type="button">Mark all absent</button>
          <button className="secondary-button" onClick={resetChanges} disabled={!session || !changedCount} type="button">Reset changes</button>
          <button className="primary-button" onClick={saveAttendance} disabled={!session || saving} type="button">Save attendance{changedCount ? ` (${changedCount})` : ""}</button>
          <button className="secondary-button" onClick={handleOpenSession} disabled={!session || session.status === "open"} type="button">Reopen session</button>
          <button className="danger-button" onClick={handleCloseSession} disabled={!session || session.status === "closed"} type="button">Close session</button>
        </div>

        {!session ? (
          <EmptyState message="Tạo hoặc chọn phiên để xem danh sách điểm danh." />
        ) : base.students.length ? (
          <table>
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Full name</th>
                <th>Attendance status</th>
                <th>Note</th>
                <th>Updated at</th>
              </tr>
            </thead>
            <tbody>
              {base.students.map((student) => {
                const row = draft[student.student_external_id] || { status: "unknown", note: "" };
                return (
                  <tr key={student.student_external_id}>
                    <td>{student.student_external_id}</td>
                    <td>{student.full_name || "--"}</td>
                    <td>
                      <select value={row.status} onChange={(event) => updateDraft(student.student_external_id, { status: event.target.value })}>
                        {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <input value={row.note || ""} onChange={(event) => updateDraft(student.student_external_id, { note: event.target.value })} placeholder="Ghi chú" />
                    </td>
                    <td>{row.updated_at ? new Date(row.updated_at).toLocaleString("vi-VN") : "--"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Lớp chưa có sinh viên." />
        )}
      </div>
    </div>
  );
}
