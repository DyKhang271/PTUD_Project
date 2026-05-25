import CustomSelect from "../../../components/CustomSelect";

export default function PlanFilters({
  filters,
  faculties,
  programs,
  cohorts,
  terms,
  semesters,
  onChange,
  onImportCurriculum,
  onImportSections,
  onSuggestPlan,
  onBulkCreate,
  actionLoading,
  disabled,
}) {
  const facultyOptions = [
    { value: "", label: "Chọn khoa" },
    ...faculties.map((f) => ({ value: f.id, label: f.name }))
  ];

  const programOptions = [
    { value: "", label: "Chọn chương trình" },
    ...programs.map((p) => ({ value: p.id, label: p.name }))
  ];

  const cohortOptions = [
    { value: "", label: "Chọn khóa tuyển" },
    ...cohorts.map((c) => ({ value: c.id, label: c.code }))
  ];

  const semesterOptions = [
    { value: "", label: "Chọn học kỳ CT khung" },
    ...semesters.map((s) => ({ value: s, label: `Học kỳ ${s}` }))
  ];

  const termOptions = [
    { value: "", label: "Chọn học kỳ thực tế" },
    ...terms.map((t) => ({
      value: t.term_code,
      label: `${t.term_name} - ${t.term_code} - ${t.course_count || 0} môn - ${t.student_count || 0} SV`
    }))
  ];

  return (
    <div className="panel section-stack">
      <div className="page-header">
        <div>
          <h2 className="page-title">Kế hoạch mở lớp học phần</h2>
          <p className="page-subtitle">
            Lập kế hoạch mở lớp theo khoa, chương trình, khóa học, học kỳ CT khung và học kỳ thực tế.
          </p>
        </div>
      </div>

      <div className="plan-filter-grid">
        <label className="field-group">
          <span>Khoa</span>
          <CustomSelect
            value={filters.faculty_id}
            onChange={(val) => onChange("faculty_id", val)}
            options={facultyOptions}
            placeholder="Chọn khoa"
          />
        </label>

        <label className="field-group">
          <span>Chương trình / Ngành</span>
          <CustomSelect
            value={filters.program_id}
            onChange={(val) => onChange("program_id", val)}
            options={programOptions}
            disabled={!filters.faculty_id}
            placeholder="Chọn chương trình"
          />
        </label>

        <label className="field-group">
          <span>Khóa tuyển</span>
          <CustomSelect
            value={filters.cohort_id}
            onChange={(val) => onChange("cohort_id", val)}
            options={cohortOptions}
            disabled={!filters.program_id}
            placeholder="Chọn khóa tuyển"
          />
        </label>

        <label className="field-group">
          <span>Học kỳ CT khung</span>
          <CustomSelect
            value={filters.curriculum_semester}
            onChange={(val) => onChange("curriculum_semester", val)}
            options={semesterOptions}
            disabled={!filters.cohort_id}
            placeholder="Chọn học kỳ CT khung"
          />
        </label>

        <label className="field-group">
          <span>Học kỳ thực tế</span>
          <CustomSelect
            value={filters.term_code}
            onChange={(val) => onChange("term_code", val)}
            options={termOptions}
            placeholder="Chọn học kỳ thực tế"
          />
        </label>
      </div>


      <div className="button-row">
        <button className="secondary-button" type="button" onClick={onImportCurriculum} disabled={actionLoading.importCurriculum}>
          {actionLoading.importCurriculum ? "Đang đồng bộ CT khung..." : "Đồng bộ CT khung từ Student Portal"}
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={onImportSections}
          disabled={!filters.term_code || actionLoading.importSections}
        >
          {actionLoading.importSections ? "Đang đồng bộ lớp HP..." : "Đồng bộ lớp HP học kỳ này"}
        </button>
        <button className="primary-button" type="button" onClick={onSuggestPlan} disabled={disabled || actionLoading.suggestPlan}>
          {actionLoading.suggestPlan ? "Đang đề xuất..." : "Đề xuất mở lớp"}
        </button>
        <button className="primary-button" type="button" onClick={onBulkCreate} disabled={disabled || actionLoading.bulkCreate}>
          {actionLoading.bulkCreate ? "Đang tạo lớp..." : "Tạo lớp HP cho các môn còn thiếu"}
        </button>
      </div>
    </div>
  );
}
