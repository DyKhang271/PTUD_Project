import { useState, useEffect } from 'react';
import { getAdminStudents, createAdminStudent, updateAdminStudentPassword } from '../../services/api';
import styles from './AdminDashboard.module.css';

export default function AdminDashboard() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ mssv: '', password: '', ho_ten: '', ngay_sinh: '' });

  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ mssv: '', new_password: '' });

  const [toast, setToast] = useState('');

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await getAdminStudents();
      setStudents(res.data);
    } catch {
      showToast('Lỗi khi tải danh sách sinh viên');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await createAdminStudent(addForm);
      if (res.data.success) {
        showToast('Thêm sinh viên thành công');
        setShowAddModal(false);
        setAddForm({ mssv: '', password: '', ho_ten: '', ngay_sinh: '' });
        fetchStudents();
      } else {
        showToast(res.data.message);
      }
    } catch {
      showToast('Lỗi khi thêm sinh viên');
    }
  };

  const handlePwdSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await updateAdminStudentPassword(pwdForm.mssv, pwdForm.new_password);
      if (res.data.success) {
        showToast('Đổi mật khẩu thành công');
        setShowPwdModal(false);
        setPwdForm({ mssv: '', new_password: '' });
      } else {
        showToast(res.data.message);
      }
    } catch {
      showToast('Lỗi khi đổi mật khẩu');
    }
  };

  return (
    <div className={styles.adminContainer}>
      <div className={styles.headerRow}>
        <h2>Danh sách Sinh viên</h2>
        <button className={styles.primaryBtn} onClick={() => setShowAddModal(true)}>
          + Cấp tài khoản mới
        </button>
      </div>

      <div className={styles.card}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>MSSV</th>
                <th>Họ và tên</th>
                <th>Ngày sinh</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className={styles.emptyCell}>Đang tải dữ liệu...</td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan="5" className={styles.emptyCell}>Chưa có dữ liệu sinh viên</td>
                </tr>
              ) : (
                students.map(stu => (
                  <tr key={stu.mssv}>
                    <td><strong>{stu.mssv}</strong></td>
                    <td>{stu.ho_ten}</td>
                    <td>{stu.ngay_sinh}</td>
                    <td>
                      <span className={`${styles.badge} ${stu.trang_thai === 'Đang học' ? styles.badgeSuccess : styles.badgeNeutral}`}>
                        {stu.trang_thai}
                      </span>
                    </td>
                    <td>
                      <button 
                        className={styles.actionBtn}
                        onClick={() => {
                          setPwdForm({ mssv: stu.mssv, new_password: '' });
                          setShowPwdModal(true);
                        }}
                      >
                        🔑 Đổi mật khẩu
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>Cấp tài khoản sinh viên mới</h3>
            <form onSubmit={handleAddSubmit}>
              <div className={styles.formGroup}>
                <label>Mã số sinh viên (MSSV)</label>
                <input required type="text" value={addForm.mssv} onChange={e => setAddForm({...addForm, mssv: e.target.value})} />
              </div>
              <div className={styles.formGroup}>
                <label>Họ và tên</label>
                <input required type="text" value={addForm.ho_ten} onChange={e => setAddForm({...addForm, ho_ten: e.target.value})} />
              </div>
              <div className={styles.formGroup}>
                <label>Ngày sinh (DD/MM/YYYY)</label>
                <input required type="text" value={addForm.ngay_sinh} onChange={e => setAddForm({...addForm, ngay_sinh: e.target.value})} />
              </div>
              <div className={styles.formGroup}>
                <label>Mật khẩu khởi tạo</label>
                <input required type="text" value={addForm.password} onChange={e => setAddForm({...addForm, password: e.target.value})} />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowAddModal(false)}>Hủy</button>
                <button type="submit" className={styles.submitBtn}>Tạo tài khoản</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPwdModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>Đổi mật khẩu sinh viên</h3>
            <div className={styles.modalSubtitle}>Đang chọn MSSV: <strong>{pwdForm.mssv}</strong></div>
            <form onSubmit={handlePwdSubmit}>
              <div className={styles.formGroup}>
                <label>Mật khẩu mới</label>
                <input required type="text" value={pwdForm.new_password} onChange={e => setPwdForm({...pwdForm, new_password: e.target.value})} />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowPwdModal(false)}>Hủy</button>
                <button type="submit" className={styles.submitBtn}>Cập nhật</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}
