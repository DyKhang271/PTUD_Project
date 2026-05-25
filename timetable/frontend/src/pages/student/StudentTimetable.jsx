import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ErrorState, LoadingState } from "../../components/DataState";
import { fetchStudentExams, fetchStudentTimetable } from "../../services/studentApi";

const DAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];
const DAY_START = "07:00";
const DAY_END = "21:30";
const PIXELS_PER_HOUR = 80;
const TIME_GUIDES = ["07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"];
const LEGEND_ITEMS = [
  { key: "study", label: "Lý thuyết", className: "type-study" },
  { key: "practice", label: "Thực hành", className: "type-practice" },
  { key: "online", label: "Trực tuyến", className: "type-online" },
  { key: "exam", label: "Lịch thi", className: "type-exam" },
  { key: "cancelled", label: "Tạm ngưng", className: "type-cancelled" },
];

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function formatDayHeader(date) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(date);
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getWeekStart(baseDate) {
  const date = new Date(baseDate);
  const weekday = date.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getWeekDays(baseDate) {
  const start = getWeekStart(baseDate);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function formatTimeRange(start, end) {
  const normalizedStart = start ? String(start).slice(0, 5) : "--";
  const normalizedEnd = end ? String(end).slice(0, 5) : "--";
  return `${normalizedStart} - ${normalizedEnd}`;
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value || "00:00").split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function minutesToTop(minutes) {
  return (minutes / 60) * PIXELS_PER_HOUR;
}

function resolveLegendClass(item) {
  if (item.kind === "exam") return "type-exam";
  if (item.status === "cancelled") return "type-cancelled";
  if (item.session_type === "practice") return "type-practice";
  if (
    item.session_type === "online" ||
    `${item.location || ""}`.toLowerCase().includes("trực tuyến") ||
    `${item.location || ""}`.toLowerCase().includes("truc tuyen")
  ) {
    return "type-online";
  }
  return "type-study";
}

function formatSessionType(item) {
  if (item.kind === "exam") return "Lịch thi";
  if (item.status === "cancelled") return "Tạm ngưng";
  if (item.session_type === "practice") return "Thực hành";
  if (
    item.session_type === "online" ||
    `${item.location || ""}`.toLowerCase().includes("trực tuyến") ||
    `${item.location || ""}`.toLowerCase().includes("truc tuyen")
  ) {
    return "Trực tuyến";
  }
  return "Lý thuyết";
}

function buildWeekRangeLabel(days) {
  if (!days.length) return "";
  const first = days[0];
  const last = days[days.length - 1];
  return `${formatLongDate(first)} - ${new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(last)}`;
}

function normalizeEvent(item, dayStartMinutes, dayEndMinutes) {
  const startMinutes = Math.max(0, timeToMinutes(item.start_time) - dayStartMinutes);
  const endMinutesRaw = timeToMinutes(item.end_time || item.start_time);
  const endMinutes = Math.min(dayEndMinutes - dayStartMinutes, Math.max(startMinutes + 45, endMinutesRaw - dayStartMinutes));
  return {
    ...item,
    startMinutes,
    endMinutes,
    durationMinutes: Math.max(45, endMinutes - startMinutes),
  };
}

function computeOverlapLayout(events) {
  const sorted = [...events].sort((left, right) => {
    if (left.startMinutes !== right.startMinutes) {
      return left.startMinutes - right.startMinutes;
    }
    return left.endMinutes - right.endMinutes;
  });

  const positioned = sorted.map((event) => ({ ...event, overlapIndex: 0, overlapCount: 1 }));
  const active = [];

  for (const event of positioned) {
    for (let index = active.length - 1; index >= 0; index -= 1) {
      // Tolerate minor nominal overlaps (up to 20 mins) between consecutive periods
      if (active[index].endMinutes <= event.startMinutes + 20) {
        active.splice(index, 1);
      }
    }

    const usedIndexes = new Set(active.map((item) => item.overlapIndex));
    let overlapIndex = 0;
    while (usedIndexes.has(overlapIndex)) {
      overlapIndex += 1;
    }
    event.overlapIndex = overlapIndex;

    const cluster = [...active, event];
    const overlapCount = Math.max(...cluster.map((item) => item.overlapIndex)) + 1;
    cluster.forEach((item) => {
      item.overlapCount = Math.max(item.overlapCount, overlapCount);
    });

    active.push(event);
  }

  return positioned;
}

export default function StudentTimetable() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedItem, setSelectedItem] = useState(null);
  const [state, setState] = useState({ loading: true, error: "", items: [], exams: [] });

  const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];
  const weekLabel = useMemo(() => buildWeekRangeLabel(weekDays), [weekDays]);
  const dayStartMinutes = timeToMinutes(DAY_START);
  const dayEndMinutes = timeToMinutes(DAY_END);
  const timelineHeight = ((dayEndMinutes - dayStartMinutes) / 60) * PIXELS_PER_HOUR;

  async function load(baseDate = selectedDate) {
    const days = getWeekDays(baseDate);
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const [items, exams] = await Promise.all([
        fetchStudentTimetable({
          date_from: toDateInputValue(days[0]),
          date_to: toDateInputValue(days[6]),
        }),
        fetchStudentExams(),
      ]);
      setState({ loading: false, error: "", items, exams });
    } catch (err) {
      setState({
        loading: false,
        error: err?.response?.data?.detail || "Không tải được thời khóa biểu tuần.",
        items: [],
        exams: [],
      });
    }
  }

  useEffect(() => {
    load(selectedDate);
  }, [selectedDate]);

  const eventsByDay = useMemo(() => {
    const grouped = Array.from({ length: 7 }, () => []);

    state.items.forEach((item) => {
      const itemDate = parseDate(item.date);
      if (!itemDate) return;
      const dayIndex = Math.round((itemDate.getTime() - weekStart.getTime()) / 86400000);
      if (dayIndex < 0 || dayIndex > 6) return;
      grouped[dayIndex].push(
        normalizeEvent(
          {
            ...item,
            kind: "class",
            displayDate: item.date,
          },
          dayStartMinutes,
          dayEndMinutes,
        ),
      );
    });

    state.exams.forEach((exam) => {
      const examDate = parseDate(exam.exam_date);
      if (!examDate || examDate < weekStart || examDate > weekEnd) return;
      const dayIndex = Math.round((examDate.getTime() - weekStart.getTime()) / 86400000);
      grouped[dayIndex].push(
        normalizeEvent(
          {
            ...exam,
            kind: "exam",
            status: "published",
            session_type: "exam",
            displayDate: exam.exam_date,
          },
          dayStartMinutes,
          dayEndMinutes,
        ),
      );
    });

    return grouped.map((events) => computeOverlapLayout(events));
  }, [dayEndMinutes, dayStartMinutes, state.exams, state.items, weekStart, weekEnd]);

  const hasAnySchedule = eventsByDay.some((events) => events.length > 0);
  const todayKey = toDateInputValue(new Date());

  if (state.loading) return <LoadingState label="Đang tải thời khóa biểu tuần..." />;
  if (state.error) return <ErrorState message={state.error} onRetry={() => load(selectedDate)} />;

  return (
    <div className="section-stack">
      <div className="page-header timetable-hero">
        <div>
          <div className="eyebrow">Lịch tuần theo thời gian thực</div>
          <h2 className="page-title">Thời khóa biểu sinh viên</h2>
          <p className="page-subtitle">
            Lịch được hiển thị theo timeline thật từ 07:00 đến 21:30, block môn học nằm đúng giờ bắt đầu và kết thúc như lịch portal đại học.
          </p>
        </div>
        <div className="hero-note">
          <strong>{weekLabel}</strong>
          <span>Card môn học được đặt theo thời gian thực, không còn phụ thuộc vào ca cố định.</span>
        </div>
      </div>

      <div className="panel timetable-toolbar">
        <div className="button-row">
          <button className="secondary-button" type="button" onClick={() => setSelectedDate(new Date())}>
            Hôm nay
          </button>
          <button className="secondary-button" type="button" onClick={() => setSelectedDate(new Date(selectedDate.getTime() - 7 * 86400000))}>
            Tuần trước
          </button>
          <button className="secondary-button" type="button" onClick={() => setSelectedDate(new Date(selectedDate.getTime() + 7 * 86400000))}>
            Tuần sau
          </button>
          <button className="secondary-button" type="button" onClick={() => window.print()}>
            In lịch
          </button>
          <button className="secondary-button" type="button" onClick={() => navigate(-1)}>
            Trở về
          </button>
        </div>
        <label className="field-group timetable-date-picker">
          <span>Chọn ngày trong tuần</span>
          <input
            type="date"
            value={toDateInputValue(selectedDate)}
            onChange={(event) => {
              const nextDate = parseDate(event.target.value);
              if (nextDate) {
                setSelectedDate(nextDate);
              }
            }}
          />
        </label>
      </div>

      <div className="panel timetable-legend">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.key} className="legend-chip">
            <span className={`legend-dot ${item.className}`} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {hasAnySchedule ? (
        <div className="table-card timetable-board timeline-board">
          <div className="timeline-grid">
            <div className="timeline-header-corner" />
            {weekDays.map((day, index) => (
              <div key={DAY_LABELS[index]} className={`timeline-day-header ${toDateInputValue(day) === todayKey ? "is-today" : ""}`}>
                <strong>{DAY_LABELS[index]}</strong>
                <span>{formatDayHeader(day)}</span>
              </div>
            ))}

            <div className="timeline-time-column" style={{ height: `${timelineHeight}px` }}>
              {TIME_GUIDES.map((timeLabel) => {
                const top = minutesToTop(timeToMinutes(timeLabel) - dayStartMinutes);
                return (
                  <div key={timeLabel} className="timeline-time-label" style={{ top: `${top}px` }}>
                    <span>{timeLabel}</span>
                  </div>
                );
              })}
            </div>

            {weekDays.map((day, dayIndex) => (
              <div
                key={`${DAY_LABELS[dayIndex]}-column`}
                className={`timeline-day-column ${toDateInputValue(day) === todayKey ? "is-today" : ""}`}
                style={{ height: `${timelineHeight}px` }}
              >
                {TIME_GUIDES.map((timeLabel) => {
                  const top = minutesToTop(timeToMinutes(timeLabel) - dayStartMinutes);
                  return <div key={timeLabel} className="timeline-guide-line" style={{ top: `${top}px` }} />;
                })}

                {eventsByDay[dayIndex].map((item) => {
                  const width = `calc(${100 / item.overlapCount}% - 8px)`;
                  const left = `calc(${(100 / item.overlapCount) * item.overlapIndex}% + 4px)`;
                  return (
                    <article
                      key={`${item.kind}-${item.id || item.timetable_entry_id}-${dayIndex}`}
                      className={`timeline-event-card ${resolveLegendClass(item)}`}
                      style={{
                        top: `${minutesToTop(item.startMinutes)}px`,
                        height: `${minutesToTop(item.durationMinutes)}px`,
                        left,
                        width,
                      }}
                      onClick={() => setSelectedItem(item)}
                    >
                      <div className="timeline-event-title">{item.course_name}</div>
                      <div className="timeline-event-meta">{formatTimeRange(item.start_time, item.end_time)}</div>
                      {(item.room || item.location) ? <div className="timeline-event-meta timeline-event-meta-wrap">{item.room || item.location}</div> : null}
                      {item.teacher_name || item.teacher_external_id ? (
                        <div className="timeline-event-meta timeline-event-meta-wrap">{item.teacher_name || item.teacher_external_id}</div>
                      ) : null}

                      <div className="schedule-card-tooltip timeline-event-tooltip">
                        <div className="schedule-tooltip-title">{item.course_name}</div>
                        <div className="schedule-tooltip-row">
                          <span>Mã lớp học phần</span>
                          <strong>{item.section_code || "--"}</strong>
                        </div>
                        <div className="schedule-tooltip-row">
                          <span>Giảng viên</span>
                          <strong>{item.teacher_name || item.teacher_external_id || "--"}</strong>
                        </div>
                        <div className="schedule-tooltip-row">
                          <span>Phòng</span>
                          <strong>{item.room || item.location || "--"}</strong>
                        </div>
                        <div className="schedule-tooltip-row">
                          <span>Thời gian</span>
                          <strong>{formatTimeRange(item.start_time, item.end_time)}</strong>
                        </div>
                        <div className="schedule-tooltip-row">
                          <span>Loại lịch</span>
                          <strong>{formatSessionType(item)}</strong>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="table-card schedule-empty-state">
          <div className="empty-illustration">Lịch</div>
          <h3>Tuần này chưa có lịch hiển thị</h3>
          <p>
            Không tìm thấy buổi học hoặc lịch thi trong khoảng từ {formatDayHeader(weekStart)} đến {formatDayHeader(weekEnd)}.
            Bạn có thể chuyển sang tuần khác hoặc quay về hôm nay để kiểm tra lại.
          </p>
          <div className="button-row">
            <button className="primary-button" type="button" onClick={() => setSelectedDate(new Date())}>
              Về tuần hiện tại
            </button>
            <button className="secondary-button" type="button" onClick={() => setSelectedDate(new Date(selectedDate.getTime() + 7 * 86400000))}>
              Xem tuần sau
            </button>
          </div>
        </div>
      )}

      {selectedItem ? (
        <div className="modal-backdrop" onClick={() => setSelectedItem(null)}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="page-header">
              <div>
                <h3 className="page-title">Chi tiết lịch học</h3>
                <p className="page-subtitle">{selectedItem.displayDate ? formatLongDate(parseDate(selectedItem.displayDate)) : ""}</p>
              </div>
              <button className="secondary-button" type="button" onClick={() => setSelectedItem(null)}>
                Đóng
              </button>
            </div>
            <div className="plan-context-grid">
              <div><strong>Môn học</strong><div>{selectedItem.course_name}</div></div>
              <div><strong>Mã lớp học phần</strong><div>{selectedItem.section_code || "--"}</div></div>
              <div><strong>Giảng viên</strong><div>{selectedItem.teacher_name || selectedItem.teacher_external_id || "--"}</div></div>
              <div><strong>Phòng</strong><div>{selectedItem.room || selectedItem.location || "--"}</div></div>
              <div><strong>Thời gian</strong><div>{formatTimeRange(selectedItem.start_time, selectedItem.end_time)}</div></div>
              <div><strong>Loại lịch</strong><div>{formatSessionType(selectedItem)}</div></div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
