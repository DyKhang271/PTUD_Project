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
    return "Không tìm thấy lớp học phần phù hợp với bộ lọc đã chọn.";
  }
  if (!debug.matched_students_final) {
    return "Không có sinh viên nào khớp với ngành và khóa tuyển đã chọn.";
  }
  if (!debug.transcript_courses_in_term) {
    return "Không có môn học nào trong học kỳ đã chọn.";
  }
  if (debug.strict_curriculum_match && !debug.imported_courses_count) {
    return "Chế độ kiểm tra chặt đã loại toàn bộ môn vì không khớp học kỳ CTĐT tham chiếu.";
  }
  return "Không tìm thấy lớp học phần phù hợp với bộ lọc đã chọn.";
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
      setError("Vui lòng chọn học kỳ hợp lệ từ danh sách.");
      return;
    }
    if (!hasValidProgram) {
      setError("Vui lòng chọn ngành/chương trình hợp lệ từ danh sách.");
      return;
    }
    if (!hasValidCohort) {
      setError("Khóa tuyển đã chọn không thuộc ngành/chương trình hiện tại.");
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
      setError(err?.response?.data?.detail || "Không thể import dữ liệu học vụ từ Student Portal.");
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
      setSyncError("Cần chọn học kỳ trước khi đồng bộ.");
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
      setSyncError(err?.response?.data?.detail || "Không thể đồng bộ dữ liệu lớp học phần từ Student Portal.");
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

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h2 className="page-title">Dữ liệu học vụ</h2>
          <p className="page-subtitle">
            Dữ liệu học vụ là dữ liệu nền để xác định các lớp học phần cần quản lý trong học kỳ này trước khi xếp lịch học, lịch thi và điểm danh.
          </p>
        </div>
      </div>

      <div className="data-card section-stack">
        <div className="page-header">
          <div>
            <h3 className="page-title">Import ban đầu</h3>
            <p className="page-subtitle">Lấy danh sách lớp học phần thực tế theo học kỳ, ngành/chương trình và khóa tuyển.</p>
          </div>
        </div>

        <form className="inline-form" onSubmit={handleImport}>
          <label className="field-group">
            <span>Học kỳ</span>
            <input
              list="academic-data-term-options"
              value={form.term_code}
              onChange={(event) => setForm((current) => ({ ...current, term_code: event.target.value }))}
              placeholder="Tìm và chọn học kỳ"
              required
            />
            <datalist id="academic-data-term-options">
              {options.terms.map((term) => (
                <option key={term.value} value={term.value}>
                  {term.label}
                </option>
              ))}
            </datalist>
            {!form.term_code ? <small className="helper-text">Chọn học kỳ có dữ liệu để bắt đầu import.</small> : null}
          </label>

          <label className="field-group">
            <span>Ngành</span>
            <input
              list="academic-data-program-options"
              value={form.program_name}
              onChange={(event) => setForm((current) => ({ ...current, program_name: event.target.value }))}
              placeholder="Tìm và chọn ngành/chương trình"
              required
            />
            <datalist id="academic-data-program-options">
              {options.programs.map((program) => (
                <option key={program.name} value={program.name} />
              ))}
            </datalist>
          </label>

          <label className="field-group">
            <span>Khóa tuyển</span>
            <input
              list="academic-data-cohort-options"
              value={form.cohort}
              onChange={(event) => setForm((current) => ({ ...current, cohort: event.target.value }))}
              placeholder={form.program_name ? "Ví dụ: 2023" : "Chọn ngành trước"}
              disabled={!form.program_name}
            />
            <datalist id="academic-data-cohort-options">
              {cohortOptions.map((cohort) => (
                <option key={cohort} value={cohort} />
              ))}
            </datalist>
            <small className="helper-text">Để trống để import tất cả khóa tuyển trong ngành/chương trình này.</small>
          </label>

          <button className="primary-button" type="submit" disabled={loading || !form.term_code || !form.program_name}>
            {loading ? "Đang import..." : "Import dữ liệu học vụ"}
          </button>
        </form>

        <div className="section-stack">
          <button className="link-button" type="button" onClick={() => setShowAdvanced((current) => !current)}>
            {showAdvanced ? "Ẩn tùy chọn nâng cao" : "Ẩn/hiện tùy chọn nâng cao"}
          </button>
          {showAdvanced ? (
            <div className="inline-form">
              <label className="field-group">
                <span>Học kỳ CTĐT tham chiếu</span>
                <input
                  type="number"
                  min="1"
                  value={form.curriculum_semester}
                  onChange={(event) => setForm((current) => ({ ...current, curriculum_semester: event.target.value }))}
                  placeholder="Ví dụ: 4"
                />
                <small className="helper-text">
                  Dùng để đối chiếu chương trình đào tạo khi import dữ liệu học vụ.
                </small>
              </label>
              <label className="field-group">
                <span>Chế độ kiểm tra chặt</span>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.strict_curriculum_match}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, strict_curriculum_match: event.target.checked }))
                    }
                  />
                  <span>Chỉ import môn khớp đúng học kỳ CTĐT</span>
                </label>
                <small className="helper-text">
                  Nếu bật, hệ thống chỉ import các môn khớp đúng với học kỳ chương trình tham chiếu.
                </small>
              </label>
            </div>
          ) : null}
        </div>
      </div>

      {error ? <ErrorState message={error} /> : null}

      {result ? (
        <>
          {isEmpty ? <div className="badge warning" style={{ display: "block", width: "100%", padding: "16px", borderRadius: "var(--radius-md)" }}><strong>⚠️ {emptyReason}</strong></div> : null}
          {warnings.length ? (
            <div className="badge warning" style={{ display: "block", width: "100%", padding: "16px", borderRadius: "var(--radius-md)" }}>
              <strong>⚠️ Cảnh báo import</strong>
              {warnings.map((warning) => (
                <p key={warning} style={{ marginTop: "4px", fontSize: "0.9rem" }}>{warning}</p>
              ))}
            </div>
          ) : null}

          <div className="cards-grid">
            <div className="stat-card">
              <h3>{result.status}</h3>
              <p>Trạng thái import</p>
            </div>
            <div className="stat-card">
              <h3>{result.summary?.sections ?? result.total_sections}</h3>
              <p>Lớp học phần import</p>
            </div>
            <div className="stat-card">
              <h3>{result.summary?.students ?? result.total_students}</h3>
              <p>Sinh viên liên kết</p>
            </div>
            <div className="stat-card">
              <h3>{result.summary?.teachers ?? result.teachers_upserted}</h3>
              <p>Giảng viên đồng bộ</p>
            </div>
          </div>
        </>
      ) : null}

      <div className="data-card section-stack">
        <div className="page-header">
          <div>
            <h3 className="page-title">Đồng bộ và đối soát</h3>
            <p className="page-subtitle">
              Dùng cho bước đối soát sau import, bổ sung lớp học phần, cập nhật liên kết và kiểm tra trùng lặp.
            </p>
          </div>
        </div>

        <form className="inline-form" onSubmit={handleSync}>
          <label className="field-group">
            <span>Học kỳ đồng bộ</span>
            <input value={activeTermCode || ""} readOnly />
          </label>
          <label className="field-group">
            <span>Lớp hành chính</span>
            <input
              value={syncForm.class_name}
              onChange={(event) => setSyncForm((current) => ({ ...current, class_name: event.target.value }))}
              placeholder="Lọc theo lớp hành chính"
            />
          </label>
          <label className="field-group">
            <span>Mã sinh viên</span>
            <input
              value={syncForm.student_id}
              onChange={(event) => setSyncForm((current) => ({ ...current, student_id: event.target.value }))}
              placeholder="Lọc theo sinh viên"
            />
          </label>
          <label className="field-group">
            <span>Giới hạn (Limit)</span>
            <input
              type="number"
              min="1"
              value={syncForm.limit}
              onChange={(event) => setSyncForm((current) => ({ ...current, limit: event.target.value }))}
            />
          </label>
          <button className="secondary-button" type="submit" disabled={syncLoading || !activeTermCode}>
            {syncLoading ? "Đang đồng bộ..." : "Đồng bộ thay đổi từ Student Portal"}
          </button>
        </form>

        {syncError ? <ErrorState message={syncError} /> : null}

        <div className="cards-grid">
          <div className="stat-card">
            <h3>{comparison?.course_sections_count ?? "--"}</h3>
            <p>Lớp học phần đang có trong hệ thống</p>
          </div>
          <div className="stat-card">
            <h3>{comparison?.course_section_students_count ?? "--"}</h3>
            <p>Liên kết sinh viên hiện tại</p>
          </div>
          <div className="stat-card">
            <h3>{comparison?.duplicate_sections?.length ?? 0}</h3>
            <p>Section trùng cần xử lý</p>
          </div>
          <div className="stat-card">
            <h3>{comparison?.timetable_entries_count ?? "--"}</h3>
            <p>Bản ghi lịch học hiện có</p>
          </div>
        </div>

        {syncResult ? (
          <div className="badge success" style={{ display: "block", width: "100%", padding: "16px", borderRadius: "var(--radius-md)", textAlign: "left" }}>
            <strong>✅ Kết quả đồng bộ thành công</strong>
            <p style={{ marginTop: "4px", fontSize: "0.95rem" }}>
              Section mới: {syncResult.sections_created} | Section cập nhật: {syncResult.sections_updated} | Sinh viên liên kết:{" "}
              {syncResult.students_linked ?? syncResult.linked_students}
            </p>
            {syncResult.warnings?.length ? <p style={{ marginTop: "4px", fontSize: "0.9rem", color: "var(--warning)" }}>Cảnh báo: {syncResult.warnings.join(" | ")}</p> : null}
          </div>
        ) : null}

        {comparisonLoading ? <LoadingState label="Đang tổng hợp đối soát dữ liệu..." /> : null}
      </div>

      <div className="data-card">
        <div className="page-header" style={{ marginBottom: "16px" }}>
          <div>
            <h3 className="page-title">Bảng chênh lệch vận hành</h3>
            <p className="page-subtitle">
              Theo dõi nhanh các lớp vừa import, section trùng lặp, thiếu giảng viên và các cảnh báo đồng bộ.
            </p>
          </div>
        </div>

        {sectionDiffRows.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Section</th>
                <th>Môn học</th>
                <th>Giảng viên</th>
                <th>Sinh viên</th>
                <th>Cảnh báo</th>
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
                  <td>
                    {row.issues.length ? (
                      row.issues.map((issue) => (
                        <span key={issue} className="badge danger" style={{ marginRight: "4px", fontSize: "0.75rem", padding: "4px 8px" }}>{issue}</span>
                      ))
                    ) : (
                      <span className="badge success" style={{ fontSize: "0.75rem", padding: "4px 8px" }}>Không</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : comparison?.duplicate_sections?.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Section code</th>
                <th>Vấn đề</th>
                <th>Số bản ghi</th>
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
          <EmptyState message="Chưa có bảng đối soát để hiển thị." />
        )}
      </div>

      <div className="data-card">
        <div className="page-header" style={{ marginBottom: "16px" }}>
          <div>
            <h3 className="page-title">Lịch sử import và công cụ nâng cao</h3>
            <p className="page-subtitle">Theo dõi các lần import gần đây và truy cập workflow mở lớp nâng cao khi cần.</p>
          </div>
          <Link className="secondary-button" to="/admin/academic-data/advanced/plan">
            Mở công cụ kế hoạch mở lớp
          </Link>
        </div>

        {historyLoading ? (
          <LoadingState label="Đang tải lịch sử import..." />
        ) : history.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Học kỳ</th>
                <th>Ngành</th>
                <th>Trạng thái</th>
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
                  <td>
                    <span className={`status-badge status-${item.status}`}>{item.status}</span>
                  </td>
                  <td>{item.section_count}</td>
                  <td>{item.warnings?.length ? item.warnings.join(" | ") : "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Chưa có lịch sử import học vụ." />
        )}
      </div>

      {debug ? (
        <div className="section-stack">
          <button className="link-button" type="button" onClick={() => setShowDebug((current) => !current)}>
            {showDebug ? "Ẩn technical debug" : "Hiện technical debug"}
          </button>
          {showDebug ? (
            <div className="data-card" style={{ marginTop: "12px" }}>
              <div className="cards-grid" style={{ marginBottom: "20px" }}>
                <div className="stat-card">
                  <h3>{debug.matched_students_by_program}</h3>
                  <p>Sinh vien khop nganh</p>
                </div>
                <div className="stat-card">
                  <h3>{debug.matched_students_by_cohort}</h3>
                  <p>Sinh vien khop khoa</p>
                </div>
                <div className="stat-card">
                  <h3>{debug.transcript_courses_in_term}</h3>
                  <p>Mon trong hoc ky</p>
                </div>
                <div className="stat-card">
                  <h3>{debug.imported_courses_count}</h3>
                  <p>Mon da import</p>
                </div>
              </div>
              <div className="section-stack" style={{ gap: "16px" }}>
                <div>
                  <strong>Mon trung CTDT tham chieu</strong>
                  <p style={{ color: "var(--text-secondary)", marginTop: "4px" }}>{debug.overlap_course_codes?.length ? debug.overlap_course_codes.join("; ") : "--"}</p>
                </div>
                <div>
                  <strong>Mon co trong transcript nhung khong thuoc ky tham chieu</strong>
                  <p style={{ color: "var(--text-secondary)", marginTop: "4px" }}>{debug.transcript_only_course_codes?.length ? debug.transcript_only_course_codes.join("; ") : "--"}</p>
                </div>
                <div>
                  <strong>Mon thuoc ky tham chieu nhung khong co trong transcript</strong>
                  <p style={{ color: "var(--text-secondary)", marginTop: "4px" }}>{debug.curriculum_only_course_codes?.length ? debug.curriculum_only_course_codes.join("; ") : "--"}</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
