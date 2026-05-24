import StatusBadge from "../../../components/StatusBadge";
import { EmptyState } from "../../../components/DataState";

function formatSectionCount(course) {
  return `${course.opened_sections || 0} / ${course.suggested_sections || 0}`;
}

export default function PlannedCoursesTable({ courses, selectedCourseCode, onSelectCourse }) {
  return (
    <div className="table-card">
      <div className="page-header">
        <div>
          <h2 className="page-title">Môn dự kiến mở theo chương trình khung</h2>
          <p className="page-subtitle">Nhấn vào từng môn để xem các lớp học phần thực tế đã mở trong học kỳ đã chọn.</p>
        </div>
      </div>

      {courses.length ? (
        <table className="interactive-table">
          <thead>
            <tr>
              <th>Mã môn</th>
              <th>Tên môn</th>
              <th>Số tín chỉ</th>
              <th>Loại môn</th>
              <th>Số sinh viên cần học</th>
              <th>Số lớp đề xuất</th>
              <th>Số lớp đã mở</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <tr
                key={`${course.course_code}-${course.status}`}
                className={selectedCourseCode === course.course_code ? "is-selected" : ""}
                onClick={() => onSelectCourse(course)}
              >
                <td>{course.course_code}</td>
                <td>
                  <button className="link-button" type="button" onClick={() => onSelectCourse(course)}>
                    {course.course_name}
                  </button>
                </td>
                <td>{course.credits ?? "--"}</td>
                <td>{course.course_type || "--"}</td>
                <td>{course.expected_students ?? 0}</td>
                <td>{course.suggested_sections ?? 0}</td>
                <td>{formatSectionCount(course)}</td>
                <td>
                  <StatusBadge status={course.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState message="Chưa có dữ liệu kế hoạch mở lớp cho lựa chọn này." />
      )}
    </div>
  );
}
