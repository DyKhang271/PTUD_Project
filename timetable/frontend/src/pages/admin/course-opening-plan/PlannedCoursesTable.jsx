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
          <h2 className="page-title">Mon du kien mo theo chuong trinh khung</h2>
          <p className="page-subtitle">Nhan vao tung mon de xem cac lop hoc phan thuc te da mo trong hoc ky da chon.</p>
        </div>
      </div>

      {courses.length ? (
        <table className="interactive-table">
          <thead>
            <tr>
              <th>Ma mon</th>
              <th>Ten mon</th>
              <th>So tin chi</th>
              <th>Loai mon</th>
              <th>So sinh vien can hoc</th>
              <th>So lop de xuat</th>
              <th>So lop da mo</th>
              <th>Trang thai</th>
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
        <EmptyState message="Chua co du lieu ke hoach mo lop cho lua chon nay." />
      )}
    </div>
  );
}
