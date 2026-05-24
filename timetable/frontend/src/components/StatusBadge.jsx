const STATUS_LABELS = {
  present: "Có mặt",
  absent: "Vắng",
  late: "Đi trễ",
  excused: "Có phép",
  unknown: "Chưa ghi nhận",
  published: "Published",
  draft: "Draft",
  cancelled: "Cancelled",
  open: "Open",
  closed: "Closed",
  active: "Hoạt động",
  warning: "Cảnh báo",
  ok: "Ổn định",
  opened: "Đã mở",
  missing: "Chưa mở",
  under_opened: "Mở thiếu lớp",
  extra: "Mở ngoài CT khung",
  ready: "Đã đủ dữ liệu",
  missing_teacher: "Thiếu giảng viên",
  missing_schedule: "Thiếu lịch học",
  missing_exam: "Thiếu lịch thi",
  success: "Thành công",
};

export default function StatusBadge({ status }) {
  return <span className={`status-badge status-${status}`}>{STATUS_LABELS[status] || status}</span>;
}
