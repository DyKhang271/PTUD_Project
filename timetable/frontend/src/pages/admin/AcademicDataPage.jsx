import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { EmptyState, ErrorState, LoadingState } from "../../components/DataState";
import {
  fetchAcademicImportBatches,
  fetchAcademicImportDebugSummary,
  fetchAcademicImportOptions,
  importAcademicSchedulingSource,
  importCourseSections,
} from "../../services/adminApi";

const initialForm = {
  term_code: "",
  program_name: "",
  cohort: "",
  curriculum_semester: "",
  strict_curriculum_match: false,
};

const initialSyncForm = {
  class_name: "",
  student_id: "",
  limit: 100,
};

function buildEmptyReason(result) {
  const debug = result?.debug;
  if (!debug) {
    return "Khong tim thay lop hoc phan phu hop voi bo loc.";
  }
  if (!debug.matched_students_final) {
    return "Khong co sinh vien nao khop voi nganh va khoa da chon.";
  }
  if (!debug.transcript_courses_in_term) {
    return "Khong co mon hoc nao trong hoc ky da chon.";
  }
  if (debug.strict_curriculum_match && !debug.imported_courses_count) {
    return "Strict mode da loai het mon vi khong trung voi ky tham chieu.";
  }
  return "Khong tim thay lop hoc phan phu hop voi bo loc.";
}

export default function AcademicDataPage() {
  const [form, setForm] = useState(initialForm);
  const [syncForm, setSyncForm] = useState(initialSyncForm);
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [error, setError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [result, setResult] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [options, setOptions] = useState({ terms: [], programs: [] });
  const [comparison, setComparison] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const data = await fetchAcademicImportBatches();
      setHistory(data);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadOptions() {
    setOptionsLoading(true);
    try {
      const data = await fetchAcademicImportOptions();
      setOptions({
        terms: data?.terms || [],
        programs: data?.programs || [],
      });
    } catch {
      setOptions({ terms: [], programs: [] });
    } finally {
      setOptionsLoading(false);
    }
  }

  useEffect(() => {
    loadOptions();
    loadHistory();
  }, []);

  const selectedProgram = useMemo(
    () => options.programs.find((item) => item.name === form.program_name) || null,
    [options.programs, form.program_name],
  );

  const cohortOptions = useMemo(() => selectedProgram?.cohorts || [], [selectedProgram]);

  useEffect(() => {
    if (!form.cohort) {
      return;
    }
    if (!cohortOptions.includes(form.cohort)) {
      setForm((current) => ({ ...current, cohort: "" }));
    }
  }, [cohortOptions, form.cohort]);

  useEffect(() => {
    const activeTermCode = result?.term_code || form.term_code;
    if (!activeTermCode) {
      setComparison(null);
      return;
    }

    let cancelled = false;

    async function loadComparison() {
      setComparisonLoading(true);
      try {
        const data = await fetchAcademicImportDebugSummary(activeTermCode);
        if (!cancelled) {
          setComparison(data);
        }
      } catch {
        if (!cancelled) {
          setComparison(null);
        }
      } finally {
        if (!cancelled) {
          setComparisonLoading(false);
        }
      }
    }

    loadComparison();
    return () => {
      cancelled = true;
    };
  }, [form.term_code, result?.term_code]);

  async function handleImport(event) {
    event.preventDefault();
    const hasValidTerm = options.terms.some((item) => item.value === form.term_code);
    const hasValidProgram = options.programs.some((item) => item.name === form.program_name);
    const hasValidCohort = !form.cohort || cohortOptions.includes(form.cohort);

    if (!hasValidTerm) {
      setError("Vui long chon hoc ky hop le tu danh sach.");
      return;
    }
    if (!hasValidProgram) {
      setError("Vui long chon nganh hop le tu danh sach.");
      return;
    }
    if (!hasValidCohort) {
      setError("Khoa da chon khong thuoc nganh hien tai.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await importAcademicSchedulingSource({
        ...form,
        cohort: form.cohort || null,
        curriculum_semester: form.curriculum_semester ? Number(form.curriculum_semester) : null,
      });
      setResult(data);
      setShowDebug(data.status === "empty");
      await loadHistory();
    } catch (err) {
      setError(err?.response?.data?.detail || "Khong the import du lieu hoc vu tu Student Portal.");
      setResult(null);
      setShowDebug(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync(event) {
    event.preventDefault();
    const activeTermCode = result?.term_code || form.term_code;
    if (!activeTermCode) {
      setSyncError("Can chon hoc ky truoc khi dong bo.");
      return;
    }

    setSyncLoading(true);
    setSyncError("");
    try {
      const data = await importCourseSections({
        term: activeTermCode,
        class_name: syncForm.class_name || null,
        student_id: syncForm.student_id || null,
        limit: Number(syncForm.limit || 100),
      });
      setSyncResult(data);
      await loadComparisonSilently(activeTermCode);
    } catch (err) {
      setSyncError(err?.response?.data?.detail || "Khong the dong bo du lieu lop hoc phan tu Student Portal.");
      setSyncResult(null);
    } finally {
      setSyncLoading(false);
    }
  }

  async function loadComparisonSilently(termCode) {
    try {
      const data = await fetchAcademicImportDebugSummary(termCode);
      setComparison(data);
    } catch {
      setComparison(null);
    }
  }

  const debug = result?.debug;
  const isEmpty = result?.status === "empty";
  const emptyReason = isEmpty ? buildEmptyReason(result) : "";
  const warnings = result?.warnings || [];
  const activeTermCode = result?.term_code || form.term_code;
  const latestSections = result?.sections || [];
  const duplicateSectionCodes = new Set((comparison?.duplicate_sections || []).map((item) => item.section_code));
  const sectionDiffRows = latestSections.map((section) => {
    const issues = [];
    if (!section.teacher_external_id) {
      issues.push("Thieu giang vien");
    }
    if (duplicateSectionCodes.has(section.section_code)) {
      issues.push("Trung section");
    }
    if ((section.student_count || 0) === 0) {
      issues.push("Chua co sinh vien");
    }
    return {
      ...section,
      issues,
    };
  });

  if (optionsLoading) {
    return <LoadingState label="Dang tai cau hinh du lieu hoc vu..." />;
  }

  return (
    <div className="section-stack">
      <div className="page-header">
        <h2 className="page-title">Du lieu hoc vu</h2>
        <p className="page-subtitle">
          Import, doi soat va dong bo du lieu hoc vu tu Student Portal cho hoc ky thuc te.
        </p>
      </div>

      <div className="panel section-stack">
        <div className="page-header">
          <div>
            <h3 className="page-title">Import ban dau</h3>
            <p className="page-subtitle">Lay danh sach lop hoc phan thuc te theo hoc ky, nganh va khoa.</p>
          </div>
        </div>

        <form className="inline-form" onSubmit={handleImport}>
          <label className="field-group">
            <span>Hoc ky</span>
            <input
              list="academic-data-term-options"
              value={form.term_code}
              onChange={(event) => setForm((current) => ({ ...current, term_code: event.target.value }))}
              placeholder="Tim va chon hoc ky"
              required
            />
            <datalist id="academic-data-term-options">
              {options.terms.map((term) => (
                <option key={term.value} value={term.value}>
                  {term.label}
                </option>
              ))}
            </datalist>
            {!form.term_code ? <small className="helper-text">Vui long chon hoc ky tu danh sach co du lieu.</small> : null}
          </label>

          <label className="field-group">
            <span>Nganh</span>
            <input
              list="academic-data-program-options"
              value={form.program_name}
              onChange={(event) => setForm((current) => ({ ...current, program_name: event.target.value }))}
              placeholder="Tim va chon nganh"
              required
            />
            <datalist id="academic-data-program-options">
              {options.programs.map((program) => (
                <option key={program.name} value={program.name} />
              ))}
            </datalist>
          </label>

          <label className="field-group">
            <span>Khoa</span>
            <input
              list="academic-data-cohort-options"
              value={form.cohort}
              onChange={(event) => setForm((current) => ({ ...current, cohort: event.target.value }))}
              placeholder={form.program_name ? "Tim va chon khoa" : "Chon nganh truoc"}
              disabled={!form.program_name}
            />
            <datalist id="academic-data-cohort-options">
              {cohortOptions.map((cohort) => (
                <option key={cohort} value={cohort} />
              ))}
            </datalist>
            <small className="helper-text">Optional. Leave empty to import all cohorts in this program.</small>
          </label>

          <button className="primary-button" type="submit" disabled={loading || !form.term_code || !form.program_name}>
            {loading ? "Dang import..." : "Import du lieu hoc vu"}
          </button>
        </form>

        <div className="section-stack">
          <button className="link-button" type="button" onClick={() => setShowAdvanced((current) => !current)}>
            {showAdvanced ? "An tuy chon nang cao" : "Tuy chon nang cao"}
          </button>
          {showAdvanced ? (
            <div className="inline-form">
              <label className="field-group">
                <span>Reference semester</span>
                <input
                  type="number"
                  min="1"
                  value={form.curriculum_semester}
                  onChange={(event) => setForm((current) => ({ ...current, curriculum_semester: event.target.value }))}
                  placeholder="Mac dinh 4"
                />
                <small className="helper-text">
                  Only used for comparison/debug. It does not affect import unless strict mode is enabled.
                </small>
              </label>
              <label className="field-group">
                <span>Strict mode</span>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.strict_curriculum_match}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, strict_curriculum_match: event.target.checked }))
                    }
                  />
                  <span>Strict curriculum semester match</span>
                </label>
              </label>
            </div>
          ) : null}
        </div>
      </div>

      {error ? <ErrorState message={error} /> : null}

      {result ? (
        <>
          {isEmpty ? <div className="state-card state-warning"><strong>{emptyReason}</strong></div> : null}
          {warnings.length ? (
            <div className="state-card">
              <strong>Canh bao import</strong>
              {warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          <div className="cards-grid">
            <div className="panel metric-card">
              <h3>{result.status}</h3>
              <p>Trang thai import</p>
            </div>
            <div className="panel metric-card">
              <h3>{result.summary?.sections ?? result.total_sections}</h3>
              <p>Lop hoc phan import</p>
            </div>
            <div className="panel metric-card">
              <h3>{result.summary?.students ?? result.total_students}</h3>
              <p>Sinh vien lien ket</p>
            </div>
            <div className="panel metric-card">
              <h3>{result.summary?.teachers ?? result.teachers_upserted}</h3>
              <p>Giang vien dong bo</p>
            </div>
          </div>
        </>
      ) : null}

      <div className="panel section-stack">
        <div className="page-header">
          <div>
            <h3 className="page-title">Dong bo va doi soat</h3>
            <p className="page-subtitle">
              Dung cho buoc doi soat sau import, bo sung lop hoc phan, cap nhat lien ket va kiem tra trung lap.
            </p>
          </div>
        </div>

        <form className="inline-form" onSubmit={handleSync}>
          <label className="field-group">
            <span>Hoc ky dong bo</span>
            <input value={activeTermCode || ""} readOnly />
          </label>
          <label className="field-group">
            <span>Class name</span>
            <input
              value={syncForm.class_name}
              onChange={(event) => setSyncForm((current) => ({ ...current, class_name: event.target.value }))}
              placeholder="Loc theo lop"
            />
          </label>
          <label className="field-group">
            <span>Student ID</span>
            <input
              value={syncForm.student_id}
              onChange={(event) => setSyncForm((current) => ({ ...current, student_id: event.target.value }))}
              placeholder="Loc theo sinh vien"
            />
          </label>
          <label className="field-group">
            <span>Limit</span>
            <input
              type="number"
              min="1"
              value={syncForm.limit}
              onChange={(event) => setSyncForm((current) => ({ ...current, limit: event.target.value }))}
            />
          </label>
          <button className="secondary-button" type="submit" disabled={syncLoading || !activeTermCode}>
            {syncLoading ? "Dang dong bo..." : "Dong bo thay doi tu Student Portal"}
          </button>
        </form>

        {syncError ? <ErrorState message={syncError} /> : null}

        <div className="cards-grid">
          <div className="panel metric-card">
            <h3>{comparison?.course_sections_count ?? "--"}</h3>
            <p>Lop hoc phan dang co trong he thong</p>
          </div>
          <div className="panel metric-card">
            <h3>{comparison?.course_section_students_count ?? "--"}</h3>
            <p>Lien ket sinh vien hien tai</p>
          </div>
          <div className="panel metric-card">
            <h3>{comparison?.duplicate_sections?.length ?? 0}</h3>
            <p>Section trung can xu ly</p>
          </div>
          <div className="panel metric-card">
            <h3>{comparison?.timetable_entries_count ?? "--"}</h3>
            <p>Ban ghi lich hoc hien co</p>
          </div>
        </div>

        {syncResult ? (
          <div className="state-card state-success">
            <strong>Ket qua dong bo</strong>
            <p>
              Section moi: {syncResult.sections_created} | Section cap nhat: {syncResult.sections_updated} | Sinh vien lien ket:{" "}
              {syncResult.students_linked ?? syncResult.linked_students}
            </p>
            {syncResult.warnings?.length ? <p>Canh bao: {syncResult.warnings.join(" | ")}</p> : null}
          </div>
        ) : null}

        {comparisonLoading ? <LoadingState label="Dang tong hop doi soat du lieu..." /> : null}
      </div>

      <div className="table-card">
        <div className="page-header">
          <div>
            <h3 className="page-title">Bang chenh lech van hanh</h3>
            <p className="page-subtitle">
              Theo doi nhanh cac lop vua import, section trung lap, thieu giang vien va cac canh bao dong bo.
            </p>
          </div>
        </div>

        {sectionDiffRows.length ? (
          <table>
            <thead>
              <tr>
                <th>Section</th>
                <th>Mon hoc</th>
                <th>Giang vien</th>
                <th>Sinh vien</th>
                <th>Canh bao</th>
              </tr>
            </thead>
            <tbody>
              {sectionDiffRows.map((row) => (
                <tr key={row.section_code}>
                  <td>{row.section_code}</td>
                  <td>
                    <strong>{row.course_name}</strong>
                    <div className="helper-text">{row.course_code}</div>
                  </td>
                  <td>{row.teacher_full_name || row.teacher_external_id || "--"}</td>
                  <td>{row.student_count}</td>
                  <td>{row.issues.length ? row.issues.join(" | ") : "Khong"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : comparison?.duplicate_sections?.length ? (
          <table>
            <thead>
              <tr>
                <th>Section code</th>
                <th>Van de</th>
                <th>So ban ghi</th>
              </tr>
            </thead>
            <tbody>
              {comparison.duplicate_sections.map((item) => (
                <tr key={item.section_code}>
                  <td>{item.section_code}</td>
                  <td>Trung section trong he thong</td>
                  <td>{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Chua co bang doi soat de hien thi." />
        )}
      </div>

      <div className="table-card">
        <div className="page-header">
          <div>
            <h3 className="page-title">Lich su import va cong cu nang cao</h3>
            <p className="page-subtitle">Theo doi cac lan import gan day va truy cap workflow mo lop nang cao khi can.</p>
          </div>
          <Link className="secondary-button" to="/admin/academic-data/advanced/plan">
            Mo cong cu ke hoach mo lop
          </Link>
        </div>

        {historyLoading ? (
          <LoadingState label="Dang tai lich su import..." />
        ) : history.length ? (
          <table>
            <thead>
              <tr>
                <th>Thoi gian</th>
                <th>Hoc ky</th>
                <th>Nganh</th>
                <th>Trang thai</th>
                <th>Sections</th>
                <th>Warnings</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{item.imported_at}</td>
                  <td>{item.term_code}</td>
                  <td>{item.program_name || "--"}</td>
                  <td>{item.status}</td>
                  <td>{item.section_count}</td>
                  <td>{item.warnings?.length ? item.warnings.join(" | ") : "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Chua co lich su import hoc vu." />
        )}
      </div>

      {debug ? (
        <div className="section-stack">
          <button className="link-button" type="button" onClick={() => setShowDebug((current) => !current)}>
            {showDebug ? "An technical debug" : "Show technical debug"}
          </button>
          {showDebug ? (
            <div className="table-card">
              <div className="cards-grid">
                <div className="panel metric-card">
                  <h3>{debug.matched_students_by_program}</h3>
                  <p>Sinh vien khop nganh</p>
                </div>
                <div className="panel metric-card">
                  <h3>{debug.matched_students_by_cohort}</h3>
                  <p>Sinh vien khop khoa</p>
                </div>
                <div className="panel metric-card">
                  <h3>{debug.transcript_courses_in_term}</h3>
                  <p>Mon trong hoc ky</p>
                </div>
                <div className="panel metric-card">
                  <h3>{debug.imported_courses_count}</h3>
                  <p>Mon da import</p>
                </div>
              </div>
              <div className="section-stack">
                <div>
                  <strong>Mon trung CTDT tham chieu</strong>
                  <p>{debug.overlap_course_codes?.length ? debug.overlap_course_codes.join("; ") : "--"}</p>
                </div>
                <div>
                  <strong>Mon co trong transcript nhung khong thuoc ky tham chieu</strong>
                  <p>{debug.transcript_only_course_codes?.length ? debug.transcript_only_course_codes.join("; ") : "--"}</p>
                </div>
                <div>
                  <strong>Mon thuoc ky tham chieu nhung khong co trong transcript</strong>
                  <p>{debug.curriculum_only_course_codes?.length ? debug.curriculum_only_course_codes.join("; ") : "--"}</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
