import { useMemo, useState } from 'react';
import styles from './GradeEditorModal.module.css';

function parseScore(value) {
  if (value === '') {
    return null;
  }
  return Number(value);
}

function buildPreview(form) {
  const scores = {
    diem_thuong_ky_1: parseScore(form.diem_thuong_ky_1),
    diem_thuong_ky_2: parseScore(form.diem_thuong_ky_2),
    diem_thuc_hanh_1: parseScore(form.diem_thuc_hanh_1),
    diem_thuc_hanh_2: parseScore(form.diem_thuc_hanh_2),
    diem_qt: parseScore(form.diem_qt),
    diem_gk: parseScore(form.diem_gk),
    diem_ck: parseScore(form.diem_ck),
  };

  if (Object.values(scores).some((value) => value !== null && (value < 0 || value > 10))) {
    return { error: 'Điểm phải nằm trong khoảng từ 0 đến 10.' };
  }

  const processScores = [
    scores.diem_thuong_ky_1,
    scores.diem_thuong_ky_2,
    scores.diem_thuc_hanh_1,
    scores.diem_thuc_hanh_2,
  ].filter((value) => value !== null);

  const diemQt = processScores.length
    ? Number((processScores.reduce((sum, value) => sum + value, 0) / processScores.length).toFixed(2))
    : scores.diem_qt;

  if ([diemQt, scores.diem_gk, scores.diem_ck].some((value) => value === null)) {
    const hasPartialScore = Object.values(scores).some((value) => value !== null);
    return {
      diemQt,
      finalScore: null,
      gpa4: null,
      letter: null,
      status: hasPartialScore ? 'Đang nhập dở' : 'Chưa có điểm',
    };
  }

  const finalScore = Number((diemQt * 0.2 + scores.diem_gk * 0.3 + scores.diem_ck * 0.5).toFixed(2));
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
    diemQt,
    finalScore,
    gpa4,
    letter,
    status: finalScore >= 5 ? 'Đạt' : 'Rớt',
  };
}

function buildInitialForm(record) {
  return {
    diem_thuong_ky_1: record?.diem_thuong_ky_1 ?? '',
    diem_thuong_ky_2: record?.diem_thuong_ky_2 ?? '',
    diem_thuc_hanh_1: record?.diem_thuc_hanh_1 ?? '',
    diem_thuc_hanh_2: record?.diem_thuc_hanh_2 ?? '',
    diem_qt: record?.diem_qt ?? '',
    diem_gk: record?.diem_gk ?? '',
    diem_ck: record?.diem_ck ?? '',
  };
}

export default function GradeEditorModal({ record, saving, onClose, onSubmit }) {
  const [form, setForm] = useState(() => buildInitialForm(record));

  const preview = useMemo(() => buildPreview(form), [form]);

  if (!record) {
    return null;
  }

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (preview.error) {
      return;
    }

    onSubmit({
      mssv: record.mssv,
      term: record.term,
      class_section_code: record.class_section_code,
      diem_thuong_ky_1: parseScore(form.diem_thuong_ky_1),
      diem_thuong_ky_2: parseScore(form.diem_thuong_ky_2),
      diem_thuc_hanh_1: parseScore(form.diem_thuc_hanh_1),
      diem_thuc_hanh_2: parseScore(form.diem_thuc_hanh_2),
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
              <span>Điểm thường kỳ 1</span>
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={form.diem_thuong_ky_1}
                onChange={(e) => updateField('diem_thuong_ky_1', e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Điểm thường kỳ 2</span>
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={form.diem_thuong_ky_2}
                onChange={(e) => updateField('diem_thuong_ky_2', e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Điểm thực hành 1</span>
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={form.diem_thuc_hanh_1}
                onChange={(e) => updateField('diem_thuc_hanh_1', e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Điểm thực hành 2</span>
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={form.diem_thuc_hanh_2}
                onChange={(e) => updateField('diem_thuc_hanh_2', e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span>Điểm quá trình tổng hợp</span>
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={form.diem_qt}
                onChange={(e) => updateField('diem_qt', e.target.value)}
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
                onChange={(e) => updateField('diem_gk', e.target.value)}
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
                onChange={(e) => updateField('diem_ck', e.target.value)}
              />
            </label>
          </div>

          <div className={styles.note}>
            Nếu có nhập điểm thường kỳ hoặc điểm thực hành, hệ thống sẽ tự tính điểm quá trình
            bằng trung bình các cột này. Nếu để trống, hệ thống sẽ dùng ô “Điểm quá trình tổng
            hợp”. Tổng kết vẫn áp dụng trọng số: quá trình 20%, giữa kỳ 30%, cuối kỳ 50%.
          </div>

          <div className={styles.preview}>
            <div className={styles.previewCard}>
              <span>Điểm quá trình</span>
              <strong>{preview.diemQt ?? '--'}</strong>
            </div>
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
