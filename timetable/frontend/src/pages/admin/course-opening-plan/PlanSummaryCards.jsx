const SUMMARY_ITEMS = [
  { key: "planned_courses", label: "Tổng số môn cần mở theo CT khung" },
  { key: "opened_courses", label: "Số môn đã mở lớp" },
  { key: "missing_courses", label: "Số môn chưa mở lớp" },
  { key: "extra_courses", label: "Số môn mở ngoài CT khung" },
  { key: "total_sections", label: "Tổng số lớp học phần đã mở" },
  { key: "missing_teacher_sections", label: "Số lớp thiếu giảng viên" },
  { key: "missing_schedule_sections", label: "Số lớp thiếu lịch học" },
  { key: "missing_exam_sections", label: "Số lớp thiếu lịch thi" },
];

export default function PlanSummaryCards({ plan }) {
  if (!plan) {
    return null;
  }

  return (
    <div className="section-stack">
      <div className="panel">
        <div className="plan-context-grid">
          <div>
            <div className="helper-text">Khoa quản lý</div>
            <strong>{plan.faculty || "--"}</strong>
          </div>
          <div>
            <div className="helper-text">Chương trình</div>
            <strong>{plan.program || "--"}</strong>
          </div>
          <div>
            <div className="helper-text">Khóa học</div>
            <strong>{plan.cohort || "--"}</strong>
          </div>
          <div>
            <div className="helper-text">Học kỳ CT khung</div>
            <strong>{plan.curriculum_semester ? `Học kỳ ${plan.curriculum_semester}` : "--"}</strong>
          </div>
          <div>
            <div className="helper-text">Học kỳ thực tế</div>
            <strong>{plan.term_code || "--"}</strong>
          </div>
        </div>
      </div>

      <div className="cards-grid">
        {SUMMARY_ITEMS.map((item) => (
          <div key={item.key} className="panel metric-card">
            <h3>{plan.summary?.[item.key] ?? 0}</h3>
            <p>{item.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
