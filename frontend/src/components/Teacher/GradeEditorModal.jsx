import { useEffect, useMemo, useState } from 'react';
import styles from './GradeEditorModal.module.css';

function parseScore(value) {
  if (value === '') {
    return null;
  }
  return Number(value);
}

function buildPreview({ diem_qt, diem_gk, diem_ck }) {
  const qt = parseScore(diem_qt);
  const gk = parseScore(diem_gk);
  const ck = parseScore(diem_ck);

  if ([qt, gk, ck].some((value) => value !== null && (value < 0 || value > 10))) {
    return { error: 'Điểm phải nằm trong khoảng từ 0 đến 10.' };
  }

  if ([qt, gk, ck].some((value) => value === null)) {
    return {
      finalScore: null,
      gpa4: null,
      letter: null,
      status: qt !== null || gk !== null || ck !== null ? 'Đang nhập dở' : 'Chưa có điểm',
    };
  }

  const finalScore = Number((qt * 0.2 + gk * 0.3 + ck * 0.5).toFixed(2));
  let gpa4 = 0;
  let letter = 'F';

  if (finalScore >= 9) {
    gpa4 = 4;
    letter = 'A+';
  } else if (finalScore >= 8.5) {
    gpa4 = 4;
    letter = 'A';
  } else if (finalScore >= 8) {
    gpa4 = 3.5;
    letter = 'B+';
  } else if (finalScore >= 7) {
    gpa4 = 3;
    letter = 'B';
  } else if (finalScore >= 6.5) {
    gpa4 = 2.5;
    letter = 'C+';
  } else if (finalScore >= 5.5) {
    gpa4 = 2;
    letter = 'C';
  } else if (finalScore >= 5) {
    gpa4 = 1.5;
    letter = 'D+';
  } else if (finalScore >= 4) {
    gpa4 = 1;
    letter = 'D';
  }

  return {
    finalScore,
    gpa4,
    letter,
    status: finalScore >= 5 ? 'Đạt' : 'Rớt',
  };
}

export default function GradeEditorModal({ record, saving, onClose, onSubmit }) {
  const [form, setForm] = useState({
    diem_qt: '',
    diem_gk: '',
    diem_ck: '',
  });

  useEffect(() => {
    if (!record) {
      return;
    }
    setForm({
      diem_qt: record.diem_qt ?? '',
      diem_gk: record.diem_gk ?? '',
      diem_ck: record.diem_ck ?? '',
    });
  }, [record]);

  const preview = useMemo(() => buildPreview(form), [form]);

  if (!record) {
    return null;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (preview.error) {
      return;
    }
    onSubmit({
      mssv: record.mssv,
      term: record.term,
      class_section_code: record.class_section_code,
      diem_qt: parseScore(form.diem_qt),
      diem_gk: parseScore(form.diem_gk),
      diem_ck: parseScore(form.diem_ck),
    });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.eyebrow}>Phiếu cập nhật điểm</div>
            <h3>{record.ho_ten}</h3>
            <div className={styles.meta}>
              {record.mssv} • {record.course_name} • {record.term}
            </div>
          </div>
          <button type="button" className={styles.close} onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span>Điểm quá trình</span>
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={form.diem_qt}
                onChange={(e) => setForm((prev) => ({ ...prev, diem_qt: e.target.value }))}
              />
            </label>
            <label className={styles.field}>
              <span>Điểm giữa kỳ</span>
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={form.diem_gk}
                onChange={(e) => setForm((prev) => ({ ...prev, diem_gk: e.target.value }))}
              />
            </label>
            <label className={styles.field}>
              <span>Điểm cuối kỳ</span>
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={form.diem_ck}
                onChange={(e) => setForm((prev) => ({ ...prev, diem_ck: e.target.value }))}
              />
            </label>
          </div>

          <div className={styles.note}>
            Trọng số đang áp dụng: QT 20% • GK 30% • CK 50%. Khi lưu, dữ liệu sẽ được ghi vào file JSON cục bộ và làm mới bảng điểm sinh viên.
          </div>

          <div className={styles.preview}>
            <div className={styles.previewCard}>
              <span>Tổng kết hệ 10</span>
              <strong>{preview.finalScore ?? '--'}</strong>
            </div>
            <div className={styles.previewCard}>
              <span>Điểm hệ 4</span>
              <strong>{preview.gpa4 ?? '--'}</strong>
            </div>
            <div className={styles.previewCard}>
              <span>Xếp loại chữ</span>
              <strong>{preview.letter ?? '--'}</strong>
            </div>
            <div className={styles.previewCard}>
              <span>Trạng thái</span>
              <strong>{preview.status ?? '--'}</strong>
            </div>
          </div>

          {preview.error && <div className={styles.error}>{preview.error}</div>}

          <div className={styles.actions}>
            <button type="button" className={styles.cancel} onClick={onClose}>Hủy</button>
            <button type="submit" className={styles.submit} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu điểm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
