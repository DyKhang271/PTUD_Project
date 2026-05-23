import StatusBadge from "../../../components/StatusBadge";
import { EmptyState } from "../../../components/DataState";

export default function CourseSectionsTable({ course }) {
  return (
    <div className="table-card">
      <div className="page-header">
        <div>
          <h2 className="page-title">Lop hoc phan thuc te cua mon da chon</h2>
          <p className="page-subtitle">
            {course ? `${course.course_code} - ${course.course_name}` : "Chon mot mon o bang ben tren de xem chi tiet lop hoc phan."}
          </p>
        </div>
      </div>

      {!course ? (
        <EmptyState message="Hay chon mot mon trong bang ke hoach de xem lop hoc phan thuc te." />
      ) : course.sections?.length ? (
        <table className="interactive-table">
          <thead>
            <tr>
              <th>Ma lop HP</th>
              <th>Lop danh nghia</th>
              <th>Si so</th>
              <th>Giang vien</th>
              <th>Lich hoc</th>
              <th>Lich thi</th>
              <th>Trang thai</th>
            </tr>
          </thead>
          <tbody>
            {course.sections.map((section) => (
              <tr key={section.section_id}>
                <td>{section.section_code}</td>
                <td>{section.class_name || "--"}</td>
                <td>{section.student_count ?? 0}</td>
                <td>{section.teacher_name || "--"}</td>
                <td>{section.schedule_label || "--"}</td>
                <td>{section.exam_label || "--"}</td>
                <td>
                  <StatusBadge status={section.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState message="Mon nay chua co lop hoc phan thuc te trong hoc ky da chon." />
      )}
    </div>
  );
}
