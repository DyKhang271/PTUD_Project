const STATUS_LABELS = {
  present: "Có mặt",
  absent: "Vắng",
  late: "Đi muộn",
  excused: "Có phép",
  unknown: "Chưa ghi nhận",
  draft: "Draft",
  open: "Open",
  closed: "Closed",
  active: "Hoat dong",
  warning: "Cảnh báo",
  ok: "Ổn định",
  opened: "Da mo",
  missing: "Chua mo",
  under_opened: "Mo thieu lop",
  extra: "Mo ngoai CT khung",
  ready: "Da du du lieu",
  missing_teacher: "Thieu giang vien",
  missing_schedule: "Thieu lich hoc",
  missing_exam: "Thieu lich thi",
  success: "Thanh cong",
};

export default function StatusBadge({ status }) {
  return <span className={`status-badge status-${status}`}>{STATUS_LABELS[status] || status}</span>;
}
