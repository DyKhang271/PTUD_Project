import styles from './CourseRosterPanel.module.css';

export default function CourseRosterPanel({
  courses,
  selectedCourseKey,
  onSelectCourse,
  students,
  loading,
  importing,
  searchText,
  onSearchTextChange,
  onEditStudent,
  onImportCsv,
  onDownloadTemplate,
}) {
  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarEyebrow}>Phân công</div>
          <h3>Môn học phụ trách</h3>
        </div>
        <div className={styles.courseList}>
          {courses.map((course) => {
            const courseKey = `${course.course_code}__${course.term}`;
            const isActive = courseKey === selectedCourseKey;

            return (
              <button
                key={courseKey}
                className={`${styles.courseCard} ${isActive ? styles.courseCardActive : ''}`}
                onClick={() => onSelectCourse(courseKey)}
                type="button"
              >
                <div className={styles.courseCode}>{course.course_code}</div>
                <div className={styles.courseName}>{course.course_name}</div>
                <div className={styles.courseMeta}>
                  <span>{course.term}</span>
                  <span>{course.student_count} SV</span>
                </div>
                <div className={styles.courseFooter}>
                  <span>Đã chấm: {course.graded_count}</span>
                  <span>Còn lại: {course.pending_count}</span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className={styles.content}>
        <div className={styles.contentHeader}>
          <div>
            <div className={styles.sidebarEyebrow}>Bảng điểm lớp học phần</div>
            <h3>Danh sách sinh viên</h3>
          </div>
          <div className={styles.toolbar}>
            <input
              className={styles.search}
              type="text"
              value={searchText}
              onChange={(e) => onSearchTextChange(e.target.value)}
              placeholder="Tìm MSSV hoặc họ tên"
            />
            <button type="button" className={styles.templateButton} onClick={onDownloadTemplate}>
              Tải mẫu CSV
            </button>
            <label className={styles.importButton}>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const [file] = e.target.files || [];
                  if (file) {
                    onImportCsv(file);
                  }
                  e.target.value = '';
                }}
              />
              {importing ? 'Đang nhập...' : 'Nhập từ CSV'}
            </label>
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>MSSV</th>
                <th>Họ tên</th>
                <th>Lớp</th>
                <th>Thường kỳ 1</th>
                <th>Thường kỳ 2</th>
                <th>Thực hành 1</th>
                <th>Thực hành 2</th>
                <th>Quá trình</th>
                <th>Giữa kỳ</th>
                <th>Cuối kỳ</th>
                <th>Tổng kết (10)</th>
                <th>Tổng kết (4)</th>
                <th>Xếp loại</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="15" className={styles.emptyCell}>Đang tải danh sách sinh viên...</td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan="15" className={styles.emptyCell}>
                    Chưa có sinh viên phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={`${student.mssv}-${student.class_section_code}`}>
                    <td>{student.mssv}</td>
                    <td>
                      <div className={styles.nameCell}>{student.ho_ten}</div>
                    </td>
                    <td>{student.lop}</td>
                    <td>{student.diem_thuong_ky_1 ?? '-'}</td>
                    <td>{student.diem_thuong_ky_2 ?? '-'}</td>
                    <td>{student.diem_thuc_hanh_1 ?? '-'}</td>
                    <td>{student.diem_thuc_hanh_2 ?? '-'}</td>
                    <td>{student.diem_qt ?? '-'}</td>
                    <td>{student.diem_gk ?? '-'}</td>
                    <td>{student.diem_ck ?? '-'}</td>
                    <td>{student.diem_tk_10 ?? '-'}</td>
                    <td>{student.diem_tk_4 ?? '-'}</td>
                    <td>{student.xep_loai ?? '-'}</td>
                    <td>
                      <span className={styles.status}>{student.trang_thai}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.editButton}
                        onClick={() => onEditStudent(student)}
                      >
                        {student.diem_tk_10 == null ? 'Nhập điểm' : 'Sửa điểm'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
