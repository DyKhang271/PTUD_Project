import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getGradesSummary, getStudent } from '../../services/api';
import styles from './Profile.module.css';

export default function Profile() {
  const { user } = useAuth();
  const [student, setStudent] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.mssv) return;

    setLoading(true);
    Promise.all([getStudent(user.mssv), getGradesSummary(user.mssv)])
      .then(([studentRes, summaryRes]) => {
        setStudent(studentRes.data);
        setSummary(summaryRes.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Không thể tải hồ sơ. Vui lòng thử lại.');
        setLoading(false);
      });
  }, [user?.mssv]);

  if (loading) {
    return (
      <div className={styles.profile}>
        <div className={styles.loadingCenter}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.profile}>
        <div className="errorMessage">⚠️ {error}</div>
      </div>
    );
  }

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    return parts[parts.length - 1]?.[0] || '?';
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Đang học':
        return styles.statusActive;
      case 'Bảo lưu':
        return styles.statusPaused;
      case 'Tốt nghiệp':
        return styles.statusGrad;
      default:
        return styles.statusActive;
    }
  };

  return (
    <div className={styles.profile}>
      <div className={styles.profileGrid}>
        <div className={styles.cardLeft}>
          <div className={styles.avatarWrapper}>
            <div className={styles.avatar}>{getInitials(student.ho_ten)}</div>
            <div className={styles.avatarBadge}>✓</div>
          </div>
          <div className={styles.profileName}>{student.ho_ten}</div>
          <div className={styles.profileMssv}>{student.mssv}</div>
          <div className={`${styles.statusBadge} ${getStatusStyle(student.trang_thai)}`}>
            ● {student.trang_thai}
          </div>
          <div className={styles.divider} />
          <div className={styles.gpaSection}>
            <div className={styles.gpaStat}>
              <div className={styles.gpaValue}>{summary?.gpa_tich_luy?.toFixed(2)}</div>
              <div className={styles.gpaLabel}>GPA tích lũy</div>
            </div>
            <div className={styles.gpaStat}>
              <div className={styles.gpaValue}>{summary?.xep_loai}</div>
              <div className={styles.gpaLabel}>Xếp loại</div>
            </div>
          </div>
        </div>

        <div className={styles.cardRight}>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionIcon}>📋</span>
              <span className={styles.sectionTitle}>Thông tin cá nhân</span>
            </div>
            <div className={styles.sectionBody}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Họ và tên</span>
                <span className={styles.infoValue}>{student.ho_ten}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Ngày sinh</span>
                <span className={styles.infoValue}>{student.ngay_sinh}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Giới tính</span>
                <span className={styles.infoValue}>{student.gioi_tinh}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>MSSV</span>
                <span className={styles.infoValue}>{student.mssv}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Lớp</span>
                <span className={styles.infoValue}>{student.lop}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Khóa học</span>
                <span className={styles.infoValue}>{student.khoa_hoc}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Khoa</span>
                <span className={styles.infoValue}>{student.khoa}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Ngành</span>
                <span className={styles.infoValue}>{student.nganh}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Trình độ</span>
                <span className={styles.infoValue}>{student.education_level}</span>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionIcon}>📞</span>
              <span className={styles.sectionTitle}>Thông tin liên hệ</span>
            </div>
            <div className={styles.sectionBody}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Email sinh viên</span>
                <span className={styles.infoValue}>{student.email}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Số điện thoại</span>
                <span className={styles.infoValue}>{student.sdt}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Địa chỉ thường trú</span>
                <span className={styles.infoValue}>{student.dia_chi_thuong_tru}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Địa chỉ tạm trú</span>
                <span className={styles.infoValue}>{student.dia_chi_tam_tru}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
