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
  return (
    <div className="panel section-stack">
      <div className="page-header">
        <div>
          <h2 className="page-title">Ke hoach mo lop hoc phan</h2>
          <p className="page-subtitle">
            Lap ke hoach mo lop theo khoa, chuong trinh, khoa hoc, hoc ky CT khung va hoc ky thuc te.
          </p>
        </div>
      </div>

      <div className="plan-filter-grid">
        <label className="field-group">
          <span>Khoa</span>
          <select value={filters.faculty_id} onChange={(event) => onChange("faculty_id", event.target.value)}>
            <option value="">Chon khoa</option>
            {faculties.map((faculty) => (
              <option key={faculty.id} value={faculty.id}>
                {faculty.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field-group">
          <span>Chuong trinh / Nganh</span>
          <select value={filters.program_id} onChange={(event) => onChange("program_id", event.target.value)} disabled={!filters.faculty_id}>
            <option value="">Chon chuong trinh</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field-group">
          <span>Khoa</span>
          <select value={filters.cohort_id} onChange={(event) => onChange("cohort_id", event.target.value)} disabled={!filters.program_id}>
            <option value="">Chon khoa hoc</option>
            {cohorts.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.code}
              </option>
            ))}
          </select>
        </label>

        <label className="field-group">
          <span>Hoc ky CT khung</span>
          <select
            value={filters.curriculum_semester}
            onChange={(event) => onChange("curriculum_semester", event.target.value)}
            disabled={!filters.cohort_id}
          >
            <option value="">Chon hoc ky CT khung</option>
            {semesters.map((semester) => (
              <option key={semester} value={semester}>
                Hoc ky {semester}
              </option>
            ))}
          </select>
        </label>

        <label className="field-group">
          <span>Hoc ky thuc te</span>
          <select value={filters.term_code} onChange={(event) => onChange("term_code", event.target.value)}>
            <option value="">Chon hoc ky thuc te</option>
            {terms.map((term) => (
              <option key={term.term_code} value={term.term_code}>
                {term.term_name} - {term.term_code} - {term.course_count || 0} mon - {term.student_count || 0} SV
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="button-row">
        <button className="secondary-button" type="button" onClick={onImportCurriculum} disabled={actionLoading.importCurriculum}>
          {actionLoading.importCurriculum ? "Dang dong bo CT khung..." : "Dong bo CT khung tu Student Portal"}
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={onImportSections}
          disabled={!filters.term_code || actionLoading.importSections}
        >
          {actionLoading.importSections ? "Dang dong bo lop HP..." : "Dong bo lop HP hoc ky nay"}
        </button>
        <button className="primary-button" type="button" onClick={onSuggestPlan} disabled={disabled || actionLoading.suggestPlan}>
          {actionLoading.suggestPlan ? "Dang de xuat..." : "De xuat mo lop"}
        </button>
        <button className="primary-button" type="button" onClick={onBulkCreate} disabled={disabled || actionLoading.bulkCreate}>
          {actionLoading.bulkCreate ? "Dang tao lop..." : "Tao lop HP cho cac mon con thieu"}
        </button>
      </div>
    </div>
  );
}
