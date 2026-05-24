import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import StatusBadge from "../../components/StatusBadge";
import CustomSelect from "../../components/CustomSelect";
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

  async function handleSelectSession(val) {
    const selected = base.sessions.find((item) => item.id === val);
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

  const timetableOptions = useMemo(() => [
    { value: "", label: "Chọn thủ công" },
    ...base.timetable.map((item) => ({
      value: item.id,
      label: `Thứ ${item.day_of_week} - ${item.start_time || "--"} - ${item.end_time || "--"}`
    }))
  ], [base.timetable]);

  const sessionSelectOptions = useMemo(() => [
    { value: "", label: "Chọn phiên" },
    ...base.sessions.map((item) => ({
      value: item.id,
      label: `${item.session_date} ${item.start_time || "--"} - ${item.status}`
    }))
  ], [base.sessions]);

  if (base.loading) return <LoadingState label="Đang tải không gian điểm danh..." />;
  if (base.error) return <ErrorState message={base.error} onRetry={loadBase} />;
  if (!base.section) return <EmptyState message="Không tìm thấy lớp học phần." />;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h2 className="page-title">Điểm danh thủ công</h2>
          <p className="page-subtitle">{base.section.course_name} - {base.section.section_code}</p>
        </div>
      </div>

      {actionError ? <div className="badge danger" style={{ display: "block", width: "100%", padding: "12px", borderRadius: "var(--radius-md)" }}>⚠️ {actionError}</div> : null}

      <div className="two-column-grid">
        <form className="data-card form-grid" onSubmit={handleCreateSession}>
          <h3>Tạo phiên điểm danh</h3>
          <label className="field-group">
            <span>Buổi học</span>
            <CustomSelect
              value={form.timetable_entry_id}
              onChange={(val) => {
                const selected = base.timetable.find((item) => item.id === val);
                setForm((prev) => ({
                  ...prev,
                  timetable_entry_id: val,
                  start_time: selected?.start_time || prev.start_time,
                  end_time: selected?.end_time || prev.end_time,
                }));
              }}
              options={timetableOptions}
              placeholder="Chọn thủ công"
            />
          </label>
          <div className="inline-form">
            <label className="field-group">
              <span>Ngày</span>
              <input type="date" value={form.session_date} onChange={(event) => setForm((current) => ({ ...current, session_date: event.target.value }))} />
            </label>
            <label className="field-group">
              <span>Bắt đầu</span>
              <input type="time" value={form.start_time} onChange={(event) => setForm((current) => ({ ...current, start_time: event.target.value }))} />
            </label>
            <label className="field-group">
              <span>Kết thúc</span>
              <input type="time" value={form.end_time} onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))} />
            </label>
          </div>
          <label className="field-group">
            <span>Ghi chú buổi học</span>
            <textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} rows="3" />
          </label>
          <button className="primary-button" type="submit">Tạo phiên</button>
        </form>

        <div className="data-card section-stack">
          <h3>Mở phiên đã tạo</h3>
          <label className="field-group">
            <span>Phiên điểm danh</span>
            <CustomSelect
              value={session?.id || ""}
              onChange={handleSelectSession}
              options={sessionSelectOptions}
              placeholder="Chọn phiên"
            />
          </label>
          {session ? (
            <div className="section-stack" style={{ marginTop: "8px" }}>
              <div className="cards-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
                <div className="stat-card" style={{ padding: "12px", borderRadius: "var(--radius-md)" }}>
                  <strong style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Lớp</strong>
                  <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{base.section.section_code}</div>
                </div>
                <div className="stat-card" style={{ padding: "12px", borderRadius: "var(--radius-md)" }}>
                  <strong style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Môn học</strong>
                  <div style={{ fontWeight: 600, fontSize: "0.95rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={base.section.course_name}>{base.section.course_name}</div>
                </div>
                <div className="stat-card" style={{ padding: "12px", borderRadius: "var(--radius-md)" }}>
                  <strong style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Giảng viên</strong>
                  <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{base.section.teacher_external_id || "--"}</div>
                </div>
                <div className="stat-card" style={{ padding: "12px", borderRadius: "var(--radius-md)" }}>
                  <strong style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Trạng thái</strong>
                  <div><StatusBadge status={session.status} /></div>
                </div>
              </div>
              <div className="helper-text" style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Ngày {session.session_date} | {session.start_time || "--"} - {session.end_time || "--"}</div>
              <details style={{ background: "var(--bg)", padding: "12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.9rem" }}>Tự check-in của sinh viên (Self Check-in)</summary>
                <div className="section-stack" style={{ marginTop: "12px" }}>
                  <p className="helper-text" style={{ fontSize: "0.85rem" }}>Chỉ dùng khi muốn cho sinh viên tự check-in bằng mã hoặc QR.</p>
                  <button className="secondary-button" style={{ padding: "8px 12px" }} onClick={handleOpenSession} type="button">Tạo mã self check-in</button>
                  {openPayload ? (
                    <div className="section-stack" style={{ marginTop: "12px", gap: "8px" }}>
                      <div>
                        <strong>Mã check-in</strong>
                        <div className="code-block" style={{ marginTop: "4px", padding: "10px", fontSize: "1.1rem" }}>{openPayload.checkin_code}</div>
                      </div>
                      <div>
                        <strong>QR Token</strong>
                        <div className="code-block" style={{ marginTop: "4px", padding: "10px" }}>{openPayload.qr_token}</div>
                      </div>
                      <div className="helper-text" style={{ fontSize: "0.8rem" }}>Hết hạn lúc: {openPayload.expires_at}</div>
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

      <div className="data-card section-stack">
        <div className="page-header" style={{ marginBottom: "12px" }}>
          <div>
            <h3 className="page-title">Danh sách sinh viên</h3>
            <p className="page-subtitle">Phiên mới tự khởi tạo toàn bộ sinh viên ở trạng thái Vắng. Giảng viên cập nhật thủ công rồi lưu một lần.</p>
          </div>
        </div>
        <div className="button-row" style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
          <button className="secondary-button" onClick={() => markAll("present")} disabled={!session} type="button">Chọn tất cả có mặt</button>
          <button className="secondary-button" onClick={() => markAll("absent")} disabled={!session} type="button">Chọn tất cả vắng</button>
          <button className="secondary-button" onClick={resetChanges} disabled={!session || !changedCount} type="button">Hủy thay đổi</button>
          <button className="primary-button" onClick={saveAttendance} disabled={!session || saving} type="button">Lưu điểm danh{changedCount ? ` (${changedCount})` : ""}</button>
          <button className="secondary-button" onClick={handleOpenSession} disabled={!session || session.status === "open"} type="button">Mở lại phiên</button>
          <button className="danger-button" onClick={handleCloseSession} disabled={!session || session.status === "closed"} type="button">Đóng phiên điểm danh</button>
        </div>

        {!session ? (
          <EmptyState message="Tạo hoặc chọn phiên để xem danh sách điểm danh." />
        ) : base.students.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>MSSV</th>
                <th>Họ và tên</th>
                <th>Trạng thái điểm danh</th>
                <th>Ghi chú</th>
                <th>Cập nhật lúc</th>
              </tr>
            </thead>
            <tbody>
              {base.students.map((student) => {
                const row = draft[student.student_external_id] || { status: "unknown", note: "" };
                return (
                  <tr key={student.student_external_id}>
                    <td style={{ fontWeight: 600 }}>{student.student_external_id}</td>
                    <td>{student.full_name || "--"}</td>
                    <td>
                      <CustomSelect 
                        value={row.status} 
                        onChange={(val) => updateDraft(student.student_external_id, { status: val })}
                        options={statusOptions}
                        placeholder="Chọn..."
                      />
                    </td>
                    <td>
                      <input 
                        value={row.note || ""} 
                        onChange={(event) => updateDraft(student.student_external_id, { note: event.target.value })} 
                        placeholder="Ghi chú thêm" 
                        style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "6px 10px", width: "100%", maxWidth: "250px", background: "transparent", color: "var(--text)" }}
                      />
                    </td>
                    <td style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{row.updated_at ? new Date(row.updated_at).toLocaleString("vi-VN") : "--"}</td>
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
