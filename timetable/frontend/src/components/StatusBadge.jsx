const STATUS_LABELS = {
  present: "Co mat",
  absent: "Vang",
  late: "Muon",
  excused: "Co phep",
  draft: "Nhap",
  open: "Dang mo",
  closed: "Da dong",
  active: "Hoat dong",
  warning: "Canh bao",
  ok: "On dinh",
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
