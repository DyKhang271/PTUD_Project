import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import StatusBadge from "../../components/StatusBadge";
import {
  closeAttendanceSession,
  createAttendanceSession,
  fetchAttendanceRecords,
  fetchTeacherSection,
  fetchTeacherSectionStudents,
  fetchTeacherSectionTimetable,
  openAttendanceSession,
  updateAttendanceRecord,
} from "../../services/teacherApi";

const statusOptions = ["present", "late", "absent", "excused"];

export default function AttendanceSessionPage() {
  const { sectionId } = useParams();
  const [base, setBase] = useState({
    loading: true,
    error: "",
    section: null,
    students: [],
    timetable: [],
  });
  const [session, setSession] = useState(null);
  const [records, setRecords] = useState([]);
  const [openPayload, setOpenPayload] = useState(null);
  const [actionError, setActionError] = useState("");
  const [form, setForm] = useState({
    section_id: sectionId,
    timetable_entry_id: "",
    session_date: new Date().toISOString().slice(0, 10),
    start_time: "",
    end_time: "",
    note: "",
  });

  async function loadBase() {
    setBase({ loading: true, error: "", section: null, students: [], timetable: [] });
    try {
      const [section, students, timetable] = await Promise.all([
        fetchTeacherSection(sectionId),
        fetchTeacherSectionStudents(sectionId),
        fetchTeacherSectionTimetable(sectionId),
      ]);
      setBase({ loading: false, error: "", section, students, timetable });
      if (timetable.length && !form.timetable_entry_id) {
        const first = timetable[0];
        setForm((prev) => ({
          ...prev,
          timetable_entry_id: first.id,
          start_time: first.start_time || "",
          end_time: first.end_time || "",
        }));
      }
    } catch (err) {
      setBase({ loading: false, error: err?.response?.data?.detail || "Không tải được dữ liệu lớp.", section: null, students: [], timetable: [] });
    }
  }

  async function loadRecords(sessionId) {
    const data = await fetchAttendanceRecords(sessionId);
    setRecords(data);
  }

  useEffect(() => {
    loadBase();
  }, [sectionId]);

  async function handleCreateSession(event) {
    event.preventDefault();
    setActionError("");
    try {
      const payload = {
        section_id: sectionId,
        session_date: form.session_date,
        timetable_entry_id: form.timetable_entry_id || null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        note: form.note || null,
      };
      const created = await createAttendanceSession(payload);
      setSession(created);
      setOpenPayload(null);
      await loadRecords(created.id);
    } catch (err) {
      setActionError(err?.response?.data?.detail || "Không tạo được phiên điểm danh.");
    }
  }

  async function handleOpenSession() {
    if (!session?.id) return;
    setActionError("");
    try {
      const opened = await openAttendanceSession(session.id);
      setSession(opened.session);
      setOpenPayload(opened);
      await loadRecords(opened.session.id);
    } catch (err) {
      setActionError(err?.response?.data?.detail || "Không mở được phiên điểm danh.");
    }
  }

  async function handleCloseSession() {
    if (!session?.id) return;
    setActionError("");
    try {
      const closed = await closeAttendanceSession(session.id);
      setSession(closed);
      await loadRecords(closed.id);
    } catch (err) {
      setActionError(err?.response?.data?.detail || "Không đóng được phiên điểm danh.");
    }
  }

  async function handleUpdateRecord(studentExternalId, status) {
    if (!session?.id) return;
    setActionError("");
    try {
      await updateAttendanceRecord(session.id, studentExternalId, { status });
      await loadRecords(session.id);
    } catch (err) {
      setActionError(err?.response?.data?.detail || "Không cập nhật được trạng thái điểm danh.");
    }
  }

  if (base.loading) return <LoadingState label="Đang tải không gian điểm danh..." />;
  if (base.error) return <ErrorState message={base.error} onRetry={loadBase} />;
  if (!base.section) return <EmptyState message="Không tìm thấy lớp học phần." />;

  return (
    <div className="section-stack">
      <div className="page-header">
        <h2 className="page-title">Phiên điểm danh - {base.section.section_code}</h2>
        <p className="page-subtitle">{base.section.course_name}</p>
      </div>

      {actionError ? <div className="state-card state-error">{actionError}</div> : null}

      <div className="two-column-grid">
        <form className="panel form-grid" onSubmit={handleCreateSession}>
          <h3>Tạo phiên điểm danh</h3>
          <label className="field-group">
            <span>Buổi học theo timetable</span>
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
              <input
                type="date"
                value={form.session_date}
                onChange={(event) => setForm((prev) => ({ ...prev, session_date: event.target.value }))}
              />
            </label>
            <label className="field-group">
              <span>Bắt đầu</span>
              <input
                type="time"
                value={form.start_time}
                onChange={(event) => setForm((prev) => ({ ...prev, start_time: event.target.value }))}
              />
            </label>
            <label className="field-group">
              <span>Kết thúc</span>
              <input
                type="time"
                value={form.end_time}
                onChange={(event) => setForm((prev) => ({ ...prev, end_time: event.target.value }))}
              />
            </label>
          </div>
          <label className="field-group">
            <span>Ghi chú</span>
            <textarea value={form.note} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} rows="3" />
          </label>
          <button className="primary-button" type="submit">
            Tạo phiên
          </button>
        </form>

        <div className="panel section-stack">
          <h3>Trạng thái phiên hiện tại</h3>
          {session ? (
            <>
              <div>
                <StatusBadge status={session.status} />
              </div>
              <div className="helper-text">
                Ngày {session.session_date} | {session.start_time || "--"} - {session.end_time || "--"}
              </div>
              <div className="button-row">
                <button className="primary-button" onClick={handleOpenSession} disabled={session.status === "open"}>
                  Mở phiên
                </button>
                <button className="secondary-button" onClick={handleCloseSession} disabled={session.status === "closed"}>
                  Đóng phiên
                </button>
              </div>
              {openPayload ? (
                <div className="section-stack">
                  <div>
                    <strong>Check-in code</strong>
                    <div className="code-block">{openPayload.checkin_code}</div>
                  </div>
                  <div>
                    <strong>QR token</strong>
                    <div className="code-block">{openPayload.qr_token}</div>
                  </div>
                  <div className="helper-text">Hết hạn lúc: {openPayload.expires_at}</div>
                </div>
              ) : (
                <div className="helper-text">Tạo xong phiên, bấm “Mở phiên” để sinh mã code và QR token.</div>
              )}
            </>
          ) : (
            <EmptyState message="Chưa có phiên điểm danh nào được tạo trong lần thao tác này." />
          )}
        </div>
      </div>

      <div className="table-card">
        <div className="page-header">
          <h3>Danh sách điểm danh</h3>
          <p className="page-subtitle">Mặc định backend tạo bản ghi absent cho toàn bộ sinh viên khi tạo phiên.</p>
        </div>
        {!session ? (
          <EmptyState message="Tạo phiên để xem bản ghi điểm danh." />
        ) : records.length ? (
          <table>
            <thead>
              <tr>
                <th>Sinh viên</th>
                <th>Trạng thái</th>
                <th>Check-in</th>
                <th>Method</th>
                <th>Cập nhật nhanh</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>
                    <div>{record.full_name || record.student_external_id}</div>
                    <div className="helper-text">{record.student_external_id}</div>
                  </td>
                  <td>
                    <StatusBadge status={record.status} />
                  </td>
                  <td>{record.checkin_time || "--"}</td>
                  <td>{record.method || "--"}</td>
                  <td>
                    <div className="table-actions">
                      {statusOptions.map((status) => (
                        <button key={status} className="secondary-button" onClick={() => handleUpdateRecord(record.student_external_id, status)}>
                          {status}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Chưa có record nào cho phiên này." />
        )}
      </div>
    </div>
  );
}
