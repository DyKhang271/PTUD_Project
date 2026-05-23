const SUMMARY_ITEMS = [
  { key: "planned_courses", label: "Tong so mon can mo theo CT khung" },
  { key: "opened_courses", label: "So mon da mo lop" },
  { key: "missing_courses", label: "So mon chua mo lop" },
  { key: "extra_courses", label: "So mon mo ngoai CT khung" },
  { key: "total_sections", label: "Tong so lop hoc phan da mo" },
  { key: "missing_teacher_sections", label: "So lop thieu giang vien" },
  { key: "missing_schedule_sections", label: "So lop thieu lich hoc" },
  { key: "missing_exam_sections", label: "So lop thieu lich thi" },
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
            <div className="helper-text">Khoa</div>
            <strong>{plan.faculty || "--"}</strong>
          </div>
          <div>
            <div className="helper-text">Chuong trinh</div>
            <strong>{plan.program || "--"}</strong>
          </div>
          <div>
            <div className="helper-text">Khoa</div>
            <strong>{plan.cohort || "--"}</strong>
          </div>
          <div>
            <div className="helper-text">Hoc ky CT khung</div>
            <strong>{plan.curriculum_semester ? `Hoc ky ${plan.curriculum_semester}` : "--"}</strong>
          </div>
          <div>
            <div className="helper-text">Hoc ky thuc te</div>
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
