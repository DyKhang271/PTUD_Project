import { useEffect, useMemo, useState } from 'react';
import {
  downloadTimetableCsvScaffold,
  getCourseSections,
  getTimetableDebugSummary,
  getTimetableSourceTerms,
  importCoreSections,
  uploadTimetableCsv,
} from '../../services/api';
import styles from './AdminDashboard.module.css';

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function extractFilename(response, fallback) {
  const disposition = response.headers['content-disposition'] || response.headers['Content-Disposition'];
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
}

function formatTermOption(term) {
  return `${term.term_name || term.term_code} (${term.term_code}) • ${term.course_count || 0} lớp • ${term.student_count || 0} SV`;
}

function SummaryList({ title, items, emptyText = 'Không có dữ liệu.' }) {
  return (
    <div className={styles.card}>
      <div className={styles.sectionHeader}>
        <h3>{title}</h3>
      </div>
      {items?.length ? (
        <div className={styles.listBlock}>
          {items.map((item, index) => (
            <div key={`${title}-${index}`} className={styles.listItem}>
              {typeof item === 'string' ? item : JSON.stringify(item)}
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyCell}>{emptyText}</div>
      )}
    </div>
  );
}

export default function AdminTimetableImport({ showToast }) {
  const [terms, setTerms] = useState([]);
  const [selectedTermCode, setSelectedTermCode] = useState('');
  const [courseSections, setCourseSections] = useState([]);
  const [debugSummary, setDebugSummary] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [pageError, setPageError] = useState('');
  const [loadingTerms, setLoadingTerms] = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [importingSections, setImportingSections] = useState(false);
  const [downloadingScaffold, setDownloadingScaffold] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);

  const selectedTerm = useMemo(
    () => terms.find((term) => term.term_code === selectedTermCode) || null,
    [terms, selectedTermCode],
  );

  const loadTerms = async () => {
    setLoadingTerms(true);
    setPageError('');
    try {
      const response = await getTimetableSourceTerms();
      const nextTerms = response.data?.terms || [];
      setTerms(nextTerms);
      setSelectedTermCode((current) => {
        if (current && nextTerms.some((term) => term.term_code === current)) {
          return current;
        }
        return response.data?.latest_term_code || nextTerms[0]?.term_code || '';
      });
    } catch (error) {
      const message = error?.response?.data?.detail || 'Không tải được danh sách học kỳ từ timetable service.';
      setPageError(message);
    } finally {
      setLoadingTerms(false);
    }
  };

  const loadCourseSections = async (termCode) => {
    if (!termCode) {
      setCourseSections([]);
      return;
    }
    setLoadingSections(true);
    try {
      const response = await getCourseSections(termCode);
      setCourseSections(response.data || []);
    } catch (error) {
      showToast?.(error?.response?.data?.detail || 'Không tải được danh sách lớp học phần.');
      setCourseSections([]);
    } finally {
      setLoadingSections(false);
    }
  };

  const loadDebugSummary = async (termCode) => {
    if (!termCode) {
      setDebugSummary(null);
      return;
    }
    setLoadingSummary(true);
    try {
      const response = await getTimetableDebugSummary(termCode);
      setDebugSummary(response.data);
    } catch (error) {
      showToast?.(error?.response?.data?.detail || 'Không tải được debug summary.');
      setDebugSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    loadTerms();
  }, []);

  useEffect(() => {
    if (!selectedTermCode) return;
    loadCourseSections(selectedTermCode);
    loadDebugSummary(selectedTermCode);
  }, [selectedTermCode]);

  const handleImportSections = async () => {
    if (!selectedTermCode) {
      showToast?.('Vui lòng chọn học kỳ trước khi import lớp học phần.');
      return;
    }
    setImportingSections(true);
    setImportResult(null);
    try {
      const response = await importCoreSections(selectedTermCode);
      setImportResult(response.data);
      showToast?.('Đã import lớp học phần từ timetable service.');
      await Promise.all([loadCourseSections(selectedTermCode), loadDebugSummary(selectedTermCode), loadTerms()]);
    } catch (error) {
      showToast?.(error?.response?.data?.detail || 'Import lớp học phần thất bại.');
    } finally {
      setImportingSections(false);
    }
  };

  const handleDownloadScaffold = async () => {
    if (!selectedTermCode) {
      showToast?.('Vui lòng chọn học kỳ trước khi tải scaffold CSV.');
      return;
    }
    setDownloadingScaffold(true);
    try {
      const response = await downloadTimetableCsvScaffold(selectedTermCode);
      const filename = extractFilename(response, `timetable_entries_scaffold_${selectedTermCode}.csv`);
      downloadBlob(response.data, filename);
      showToast?.('Đã tải CSV scaffold theo lớp học phần.');
    } catch (error) {
      showToast?.(error?.response?.data?.detail || 'Không tải được file scaffold CSV.');
    } finally {
      setDownloadingScaffold(false);
    }
  };

  const handleUploadCsv = async () => {
    if (!selectedFile) {
      showToast?.('Vui lòng chọn file CSV trước khi upload.');
      return;
    }
    setUploadingCsv(true);
    setUploadResult(null);
    try {
      const response = await uploadTimetableCsv(selectedFile);
      setUploadResult(response.data);
      showToast?.('Upload CSV thời khóa biểu thành công.');
      await loadDebugSummary(selectedTermCode);
    } catch (error) {
      showToast?.(error?.response?.data?.detail || 'Upload CSV thời khóa biểu thất bại.');
    } finally {
      setUploadingCsv(false);
    }
  };

  const summaryCards = [
    { label: 'Lớp học phần', value: debugSummary?.course_sections_count ?? 0 },
    { label: 'Liên kết sinh viên', value: debugSummary?.course_section_students_count ?? 0 },
    { label: 'Timetable entries', value: debugSummary?.timetable_entries_count ?? 0 },
    { label: 'Published', value: debugSummary?.timetable_entries_by_status?.published ?? 0 },
  ];

  return (
    <>
      <div className={styles.headerRow}>
        <div className={styles.headerTitleArea}>
          <h2>Import thời khóa biểu từ Timetable Service</h2>
          <div className={styles.headerSubtitle}>
            Chọn học kỳ thật, import lớp học phần, tải scaffold CSV và upload lịch học hàng loạt.
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondaryBtn} onClick={() => loadDebugSummary(selectedTermCode)} disabled={loadingSummary || !selectedTermCode}>
            {loadingSummary ? 'Đang tải summary...' : 'Làm mới summary'}
          </button>
          <button className={styles.primaryBtn} onClick={handleImportSections} disabled={importingSections || !selectedTermCode}>
            {importingSections ? 'Đang import...' : 'Import lớp học phần'}
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.panelGrid}>
          <div className={styles.panelField}>
            <label>Học kỳ nguồn</label>
            <select
              value={selectedTermCode}
              onChange={(event) => setSelectedTermCode(event.target.value)}
              disabled={loadingTerms || !terms.length}
            >
              <option value="">Chọn học kỳ...</option>
              {terms.map((term) => (
                <option key={term.term_code} value={term.term_code}>
                  {formatTermOption(term)}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.panelMeta}>
            <div><strong>Term code:</strong> {selectedTerm?.term_code || '-'}</div>
            <div><strong>Term name:</strong> {selectedTerm?.term_name || '-'}</div>
            <div><strong>Course count:</strong> {selectedTerm?.course_count ?? 0}</div>
            <div><strong>Student count:</strong> {selectedTerm?.student_count ?? 0}</div>
          </div>
        </div>
        {pageError && <div className={styles.errorBanner}>{pageError}</div>}
      </div>

      <div className={styles.actionGrid}>
        <div className={styles.card}>
          <div className={styles.sectionHeader}>
            <h3>CSV Scaffold</h3>
          </div>
          <div className={styles.actionPanel}>
            <p>Dùng file scaffold có sẵn section_code thật để admin chỉ cần điền thứ, giờ, phòng và tuần học.</p>
            <button className={styles.secondaryBtn} onClick={handleDownloadScaffold} disabled={downloadingScaffold || !selectedTermCode}>
              {downloadingScaffold ? 'Đang tải...' : 'Tải CSV mẫu theo lớp học phần'}
            </button>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.sectionHeader}>
            <h3>Upload CSV thời khóa biểu</h3>
          </div>
          <div className={styles.actionPanel}>
            <input
              className={styles.fileInput}
              type="file"
              accept=".csv"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
            />
            <div className={styles.fileHint}>
              {selectedFile ? `Đã chọn: ${selectedFile.name}` : 'Chưa chọn file CSV nào.'}
            </div>
            <button className={styles.primaryBtn} onClick={handleUploadCsv} disabled={uploadingCsv || !selectedFile}>
              {uploadingCsv ? 'Đang upload...' : 'Upload CSV thời khóa biểu'}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.summaryGrid}>
        {summaryCards.map((card) => (
          <div key={card.label} className={styles.summaryCard}>
            <div className={styles.summaryLabel}>{card.label}</div>
            <div className={styles.summaryValue}>{card.value}</div>
          </div>
        ))}
      </div>

      {importResult && (
        <div className={styles.card}>
          <div className={styles.sectionHeader}>
            <h3>Kết quả import lớp học phần</h3>
          </div>
          <div className={styles.resultGrid}>
            <div>Imported sections: <strong>{importResult.imported_sections ?? 0}</strong></div>
            <div>Sections created: <strong>{importResult.sections_created ?? 0}</strong></div>
            <div>Sections updated: <strong>{importResult.sections_updated ?? 0}</strong></div>
            <div>Students linked: <strong>{importResult.students_linked ?? 0}</strong></div>
            <div>Teachers cached: <strong>{importResult.teachers_cached ?? 0}</strong></div>
          </div>
          {!!importResult.warnings?.length && <SummaryList title="Warnings" items={importResult.warnings} />}
          {!!importResult.errors?.length && <SummaryList title="Errors" items={importResult.errors} />}
        </div>
      )}

      {uploadResult && (
        <div className={styles.card}>
          <div className={styles.sectionHeader}>
            <h3>Kết quả upload CSV</h3>
          </div>
          <div className={styles.resultGrid}>
            <div>Filename: <strong>{uploadResult.filename}</strong></div>
            <div>Received rows: <strong>{uploadResult.received_rows}</strong></div>
            <div>Created: <strong>{uploadResult.created}</strong></div>
            <div>Updated: <strong>{uploadResult.updated}</strong></div>
            <div>Skipped: <strong>{uploadResult.skipped}</strong></div>
          </div>
          {!!uploadResult.missing_sections?.length && <SummaryList title="Missing sections" items={uploadResult.missing_sections} />}
          {!!uploadResult.invalid_rows?.length && (
            <SummaryList
              title="Invalid rows"
              items={uploadResult.invalid_rows.map((row) => `Row ${row.row} - ${row.section_code || '-'}: ${row.error}`)}
            />
          )}
          {!!uploadResult.warnings?.length && <SummaryList title="Warnings" items={uploadResult.warnings} />}
          {!!uploadResult.errors?.length && <SummaryList title="Errors" items={uploadResult.errors} />}
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.sectionHeader}>
          <h3>Danh sách lớp học phần</h3>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Section code</th>
                <th>Course code</th>
                <th>Course name</th>
                <th>Teacher</th>
                <th>Student count</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loadingSections ? (
                <tr><td colSpan="6" className={styles.emptyCell}>Đang tải lớp học phần...</td></tr>
              ) : courseSections.length ? (
                courseSections.map((section) => (
                  <tr key={section.id}>
                    <td><strong>{section.section_code}</strong></td>
                    <td>{section.course_code}</td>
                    <td>{section.course_name}</td>
                    <td>{section.teacher_external_id || '-'}</td>
                    <td>{section.student_count ?? 0}</td>
                    <td>{section.status || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="6" className={styles.emptyCell}>Chưa có lớp học phần cho học kỳ này.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.sectionHeader}>
          <h3>Debug summary</h3>
        </div>
        {loadingSummary ? (
          <div className={styles.emptyCell}>Đang tải debug summary...</div>
        ) : debugSummary ? (
          <>
            <div className={styles.resultGrid}>
              <div>Course sections: <strong>{debugSummary.course_sections_count ?? 0}</strong></div>
              <div>Student links: <strong>{debugSummary.course_section_students_count ?? 0}</strong></div>
              <div>Timetable entries: <strong>{debugSummary.timetable_entries_count ?? 0}</strong></div>
              <div>Published entries: <strong>{debugSummary.timetable_entries_by_status?.published ?? 0}</strong></div>
            </div>
            <SummaryList
              title="Duplicate sections"
              items={(debugSummary.duplicate_sections || []).map((item) => `${item.section_code} (${item.count})`)}
              emptyText="Không có lớp học phần trùng."
            />
            <div className={styles.sectionHeader}>
              <h3>Latest timetable entries</h3>
            </div>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Section</th>
                    <th>Course</th>
                    <th>Day</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Room</th>
                    <th>Weeks</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {debugSummary.latest_timetable_entries?.length ? (
                    debugSummary.latest_timetable_entries.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.section_code}</td>
                        <td>{entry.course_name}</td>
                        <td>{entry.day_of_week}</td>
                        <td>{entry.start_time || '-'}</td>
                        <td>{entry.end_time || '-'}</td>
                        <td>{entry.room || '-'}</td>
                        <td>{entry.weeks || '-'}</td>
                        <td>{entry.status}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="8" className={styles.emptyCell}>Chưa có timetable entries cho học kỳ này.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className={styles.emptyCell}>Chưa có summary cho học kỳ này.</div>
        )}
      </div>
    </>
  );
}
