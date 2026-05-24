import StatusBadge from "../../../components/StatusBadge";
import { EmptyState } from "../../../components/DataState";

export default function CourseSectionsTable({ course }) {
  return (
    <div className="table-card">
      <div className="page-header">
        <div>
          <h2 className="page-title">Lớp học phần thực tế của môn đã chọn</h2>
          <p className="page-subtitle">
            {course ? `${course.course_code} - ${course.course_name}` : "Chọn một môn ở bảng bên trên để xem chi tiết lớp học phần."}
          </p>
        </div>
      </div>

      {!course ? (
        <EmptyState message="Hãy chọn một môn trong bảng kế hoạch để xem lớp học phần thực tế." />
      ) : course.sections?.length ? (
        <table className="interactive-table">
          <thead>
            <tr>
              <th>Mã lớp HP</th>
              <th>Lớp danh nghĩa</th>
              <th>Sĩ số</th>
              <th>Giảng viên</th>
              <th>Lịch học</th>
              <th>Lịch thi</th>
              <th>Trạng thái</th>
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
        <EmptyState message="Môn này chưa có lớp học phần thực tế trong học kỳ đã chọn." />
      )}
    </div>
  );
}
