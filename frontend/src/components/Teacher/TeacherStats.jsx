import styles from './TeacherStats.module.css';

const CARD_META = [
  { key: 'assigned_courses', label: 'Môn phụ trách', accent: 'blue' },
  { key: 'managed_students', label: 'Sinh viên quản lý', accent: 'green' },
  { key: 'graded_entries', label: 'Đã chấm điểm', accent: 'gold' },
  { key: 'pending_entries', label: 'Chờ hoàn tất', accent: 'red' },
];

export default function TeacherStats({ summary }) {
  return (
    <div className={styles.grid}>
      {CARD_META.map((card) => (
        <article key={card.key} className={`${styles.card} ${styles[card.accent]}`}>
          <div className={styles.value}>{summary?.[card.key] ?? 0}</div>
          <div className={styles.label}>{card.label}</div>
        </article>
      ))}
    </div>
  );
}
