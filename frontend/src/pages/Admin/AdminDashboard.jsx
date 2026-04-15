import { useState, useEffect, useRef } from 'react';
import { 
  getAdminStudents, createAdminStudent, updateAdminStudentPassword, updateAdminStudent, deleteAdminStudent, bulkImportAdminStudents,
  getSystemConfig, updateSystemConfig,
  getAdminTeachers, createAdminTeacher, updateAdminTeacherPassword, updateAdminTeacher, deleteAdminTeacher, bulkImportAdminTeachers,
  getAdminTeacherAssignments, assignCourseToTeacher, removeCourseFromTeacher,
  getAdminSchedule, createAdminSchedule, updateAdminSchedule, deleteAdminSchedule,
  getAdminNotifications, createAdminNotification, updateAdminNotification, deleteAdminNotification
} from '../../services/api';
import styles from './AdminDashboard.module.css';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('students');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Data state
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [config, setConfig] = useState({ grading_weights: { diem_qt: 0.2, diem_gk: 0.3, diem_ck: 0.5 } });

  // Student Modals
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [studentForm, setStudentForm] = useState({ mssv: '', password: '', ho_ten: '', ngay_sinh: '', gioi_tinh: 'Nam', lop: '', khoa: '', nganh: '', trang_thai: 'Đang học' });

  // Teacher Modals
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [isEditingTeacher, setIsEditingTeacher] = useState(false);
  const [teacherForm, setTeacherForm] = useState({ username: '', password: '', name: '', department: '', title: '' });

  // Schedule Modals
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ id: '', term: 'HK2 (2025 - 2026)', thu: 2, tiet_bat_dau: 1, tiet_ket_thuc: 3, mon: '', ma_mon: '', phong: '', giang_vien: '', mau: '#4a90d9' });

  // Notification Modals
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [isEditingNotif, setIsEditingNotif] = useState(false);
  const [notifForm, setNotifForm] = useState({ id: '', loai: '📢', tieu_de: '', noi_dung: '', thoi_gian: '', da_doc: false });

  // Shared Modals
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdTarget, setPwdTarget] = useState({ type: 'student', id: '' });
  const [pwdForm, setPwdForm] = useState({ new_password: '' });

  // Teacher Assignments
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [courseForm, setCourseForm] = useState({ course_code: '', course_name: '', term: 'HK2 (2025 - 2026)' });

  const fileInputRef = useRef(null);
  const [uploadType, setUploadType] = useState('student');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [stuRes, teacherRes, schedRes, notifRes, confRes] = await Promise.all([
        getAdminStudents(), getAdminTeachers(), getAdminSchedule(), getAdminNotifications(), getSystemConfig()
      ]);
      setStudents(stuRes.data || []);
      setTeachers(teacherRes.data || []);
      setSchedule(schedRes.data || []);
      setNotifications(notifRes.data || []);
      if (confRes.data && confRes.data.grading_weights) {
        setConfig(confRes.data);
      }
    } catch {
      showToast('Lỗi khi tải dữ liệu hệ thống.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData() }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // --- CSV Handlers ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const lines = text.split('\n').filter(l => l.trim() !== '');
      if (lines.length < 2) return showToast('File CSV không hợp lệ hoặc trống.');
      
      const headers = lines[0].split(',').map(h => h.trim());
      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj = {};
        headers.forEach((h, i) => { obj[h] = values[i] });
        return obj;
      });

      try {
        if (uploadType === 'student') {
          await bulkImportAdminStudents(data);
          showToast(`Đã import thành công danh sách sinh viên.`);
        } else {
          await bulkImportAdminTeachers(data);
          showToast(`Đã import thành công danh sách giảng viên.`);
        }
        fetchData();
      } catch {
        showToast('Có lỗi xảy ra khi gọi API Import.');
      }
    };
    reader.readAsText(file);
    e.target.value = null; // reset
  };

  const openCsvSelect = (type) => {
    setUploadType(type);
    if (fileInputRef.current) fileInputRef.current.click();
  };


  // --- Student Handlers ---
  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditingStudent) {
        await updateAdminStudent(studentForm.mssv, studentForm);
        showToast('Cập nhật Sinh viên thành công');
      } else {
        const res = await createAdminStudent(studentForm);
        if (!res.data.success) return showToast(res.data.message);
        showToast('Thêm Sinh viên thành công');
      }
      setShowStudentModal(false);
      fetchData();
    } catch {
      showToast('Lỗi thao tác Sinh viên');
    }
  };

  const handleDeleteStudent = async (mssv) => {
    if (!window.confirm('Bạn có chắc xoá/khoá hồ sơ Sinh viên này?')) return;
    try {
      await deleteAdminStudent(mssv);
      showToast('Xoá Sinh viên thành công');
      fetchData();
    } catch {
      showToast('Lỗi khi xoá.');
    }
  };

  // --- Teacher Handlers ---
  const handleTeacherSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditingTeacher) {
        await updateAdminTeacher(teacherForm.username, teacherForm);
        showToast('Cập nhật Giảng viên thành công');
      } else {
        const res = await createAdminTeacher(teacherForm);
        if (!res.data.success) return showToast(res.data.message);
        showToast('Thêm Giảng viên thành công');
      }
      setShowTeacherModal(false);
      fetchData();
    } catch {
      showToast('Lỗi thao tác Giảng viên');
    }
  };

  const handleDeleteTeacher = async (username) => {
    if (!window.confirm('Cảnh báo: Thao tác xoá vĩnh viễn Giảng viên. Có chắc chắn?')) return;
    try {
      await deleteAdminTeacher(username);
      showToast('Xoá Giảng viên thành công');
      fetchData();
    } catch {
      showToast('Lỗi khi xoá.');
    }
  };

  // --- Password Handlers ---
  const handlePwdSubmit = async (e) => {
    e.preventDefault();
    try {
      let res;
      if (pwdTarget.type === 'student') res = await updateAdminStudentPassword(pwdTarget.id, pwdForm.new_password);
      else res = await updateAdminTeacherPassword(pwdTarget.id, pwdForm.new_password);
      if (res.data.success) {
        showToast('Đổi mật khẩu thành công');
        setShowPwdModal(false);
      } else {
        showToast(res.data.message);
      }
    } catch {
      showToast('Lỗi khi đổi mật khẩu');
    }
  };

  // --- Teacher Assignment Handlers ---
  const handleOpenAssignModal = async (username) => {
    setAssignTarget(username);
    try {
      const res = await getAdminTeacherAssignments(username);
      setAssignments(res.data || []);
      setShowAssignModal(true);
    } catch { showToast('Lỗi tải môn dạy'); }
  };

  const handleAddAssignment = async (e) => {
    e.preventDefault();
    try {
      const res = await assignCourseToTeacher(assignTarget, courseForm);
      if (res.data.success) {
        const aRes = await getAdminTeacherAssignments(assignTarget);
        setAssignments(aRes.data || []);
        fetchData();
      }
      showToast(res.data.message);
    } catch { showToast('Lỗi phân công'); }
  };

  const handleRemoveAssignment = async (courseCode, term) => {
    if (!window.confirm(`Xoá môn ${courseCode}?`)) return;
    try {
      await removeCourseFromTeacher(assignTarget, courseCode, term);
      const aRes = await getAdminTeacherAssignments(assignTarget);
      setAssignments(aRes.data || []);
      fetchData();
    } catch { showToast('Lỗi xoá phân công'); }
  };

  // --- Schedule Handlers ---
  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditingSchedule) {
        await updateAdminSchedule(scheduleForm.id, scheduleForm);
        showToast('Cập nhật Lớp học thành công');
      } else {
        await createAdminSchedule(scheduleForm);
        showToast('Thêm Lớp học thành công');
      }
      setShowScheduleModal(false);
      fetchData();
    } catch {
      showToast('Lỗi thao tác TKB');
    }
  };
  
  const handleDeleteSchedule = async (id) => {
    if (!window.confirm('Xoá lớp học phần này khỏi TKB?')) return;
    try {
      await deleteAdminSchedule(id);
      showToast('Đã xoá lớp học phần');
      fetchData();
    } catch { showToast('Lỗi xoá TKB'); }
  };

  // --- Notification Handlers ---
  const handleNotifSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!notifForm.thoi_gian) notifForm.thoi_gian = new Date().toISOString();
      if (isEditingNotif) {
        await updateAdminNotification(notifForm.id, notifForm);
        showToast('Sửa thông báo thành công');
      } else {
        await createAdminNotification(notifForm);
        showToast('Đăng thông báo thành công');
      }
      setShowNotifModal(false);
      fetchData();
    } catch { showToast('Lỗi thao tác Thông báo'); }
  };

  const handleDeleteNotif = async (id) => {
    if (!window.confirm('Xoá thông báo này?')) return;
    try {
      await deleteAdminNotification(id);
      showToast('Đã xoá thông báo');
      fetchData();
    } catch { showToast('Lỗi xoá Thông báo'); }
  };

  // --- Settings Handlers ---
  const handleSaveConfig = async () => {
    try {
      const res = await updateSystemConfig(config);
      if (res.data.success) showToast('Lưu cấu hình thành công!');
      else showToast(res.data.message);
    } catch { showToast('Lỗi lưu cấu hình'); }
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTitle}>Admin Panel</div>
        <div className={`${styles.menuItem} ${activeTab === 'students' ? styles.menuItemActive : ''}`} onClick={() => setActiveTab('students')}>🎓 Sinh viên</div>
        <div className={`${styles.menuItem} ${activeTab === 'teachers' ? styles.menuItemActive : ''}`} onClick={() => setActiveTab('teachers')}>👨‍🏫 Giảng viên</div>
        <div className={`${styles.menuItem} ${activeTab === 'schedule' ? styles.menuItemActive : ''}`} onClick={() => setActiveTab('schedule')}>📅 Thời khoá biểu</div>
        <div className={`${styles.menuItem} ${activeTab === 'notifications' ? styles.menuItemActive : ''}`} onClick={() => setActiveTab('notifications')}>📢 Thông báo</div>
        <div className={`${styles.menuItem} ${activeTab === 'settings' ? styles.menuItemActive : ''}`} onClick={() => setActiveTab('settings')}>⚙️ Cấu hình hệ thống</div>
      </aside>

      <main className={styles.mainContent}>
        <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".csv" onChange={handleFileUpload} />

        {activeTab === 'students' && (
          <>
            <div className={styles.headerRow}>
              <div className={styles.headerTitleArea}>
                <h2>Danh sách Sinh viên</h2>
                <div className={styles.headerSubtitle}>Quản lý thông tin và tài khoản sinh viên toàn trường</div>
              </div>
              <div className={styles.headerActions}>
                <button className={styles.secondaryBtn} onClick={() => openCsvSelect('student')}>📁 Nhập CSV</button>
                <button className={styles.primaryBtn} onClick={() => { setIsEditingStudent(false); setStudentForm({ mssv: '', password: '', ho_ten: '', ngay_sinh: '', gioi_tinh: 'Nam', lop: '', khoa: '', nganh: '', trang_thai: 'Đang học' }); setShowStudentModal(true); }}>+ Thêm Sinh viên</button>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead><tr><th>MSSV</th><th>Họ tên</th><th>Ngày sinh</th><th>Lớp</th><th>Ngành</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
                  <tbody>
                    {loading ? <tr><td colSpan="7" className={styles.emptyCell}>Đang tải...</td></tr> : 
                      students.map(st => (
                        <tr key={st.mssv}>
                          <td><strong>{st.mssv}</strong></td><td>{st.ho_ten}</td><td>{st.ngay_sinh}</td><td>{st.lop || '-'}</td><td>{st.nganh || '-'}</td>
                          <td><span className={`${styles.badge} ${st.trang_thai === 'Đang học' ? styles.badgeSuccess : styles.badgeDanger}`}>{st.trang_thai}</span></td>
                          <td style={{ display:'flex', gap:'8px' }}>
                            <button className={`${styles.actionBtn} ${styles.editBtn}`} onClick={() => { setStudentForm({...st, password: ''}); setIsEditingStudent(true); setShowStudentModal(true); }}>Sửa</button>
                            <button className={styles.actionBtn} onClick={() => { setPwdTarget({type:'student', id:st.mssv}); setPwdForm({new_password:''}); setShowPwdModal(true); }}>🔑</button>
                            <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => handleDeleteStudent(st.mssv)}>Xoá</button>
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'teachers' && (
          <>
            <div className={styles.headerRow}>
              <div className={styles.headerTitleArea}>
                <h2>Danh sách Giảng viên</h2>
                <div className={styles.headerSubtitle}>Quản lý thông tin và tài khoản khoa / giảng viên</div>
              </div>
              <div className={styles.headerActions}>
                <button className={styles.secondaryBtn} onClick={() => openCsvSelect('teacher')}>📁 Nhập CSV</button>
                <button className={styles.primaryBtn} onClick={() => { setIsEditingTeacher(false); setTeacherForm({ username: '', password: '', name: '', department: '', title: '' }); setShowTeacherModal(true); }}>+ Thêm Giảng viên</button>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead><tr><th>Tài khoản</th><th>Họ tên</th><th>Học vị</th><th>Bộ môn</th><th>Lớp CT</th><th>Thao tác</th></tr></thead>
                  <tbody>
                    {loading ? <tr><td colSpan="6" className={styles.emptyCell}>Đang tải...</td></tr> :
                      teachers.map(tc => (
                        <tr key={tc.username}>
                          <td><strong>{tc.username}</strong></td><td>{tc.name}</td><td>{tc.title}</td><td>{tc.department}</td>
                          <td><span className={styles.badge} style={{ background:'#e0f2fe', color:'#0369a1' }}>{tc.assignments_count} lớp</span></td>
                          <td style={{ display:'flex', gap:'8px' }}>
                             <button className={styles.actionBtn} onClick={() => handleOpenAssignModal(tc.username)}>📚 Phân công</button>
                             <button className={`${styles.actionBtn} ${styles.editBtn}`} onClick={() => { setTeacherForm(tc); setIsEditingTeacher(true); setShowTeacherModal(true); }}>Sửa</button>
                             <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => handleDeleteTeacher(tc.username)}>Xoá</button>
                             <button className={styles.actionBtn} onClick={() => { setPwdTarget({type:'teacher', id:tc.username}); setPwdForm({new_password:''}); setShowPwdModal(true); }}>🔑</button>
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'schedule' && (
          <>
            <div className={styles.headerRow}>
              <div className={styles.headerTitleArea}>
                <h2>Quản lý Thời khoá biểu</h2>
                <div className={styles.headerSubtitle}>Điều phối phòng học, lớp học phần và giáo viên</div>
              </div>
              <div className={styles.headerActions}>
                <button className={styles.primaryBtn} onClick={() => { setIsEditingSchedule(false); setScheduleForm({ id: '', term: 'HK2 (2025 - 2026)', thu: 2, tiet_bat_dau: 1, tiet_ket_thuc: 3, mon: '', ma_mon: '', phong: '', giang_vien: '', mau: '#4a90d9' }); setShowScheduleModal(true); }}>+ Tạo Lớp Mới</button>
              </div>
            </div>

            {loading ? <div className={styles.card}><div className={styles.emptyCell}>Đang tải...</div></div> : Object.entries(
              schedule.reduce((acc, curr) => {
                const term = curr.term || 'HK2 (2025 - 2026)';
                if (!acc[term]) acc[term] = [];
                acc[term].push(curr);
                return acc;
              }, {})
            ).map(([term, items]) => (
              <div key={term} className={styles.card} style={{ marginBottom: '24px' }}>
                <div style={{ padding: '16px 24px', background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)', fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--primary)' }}>{term}</div>
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead><tr><th>Mã Môn</th><th>Tên Môn</th><th>Thời gian</th><th>Phòng</th><th>Giảng viên</th><th>Thao tác</th></tr></thead>
                    <tbody>
                      {items.map(sc => (
                        <tr key={sc.id}>
                          <td><strong>{sc.ma_mon}</strong></td>
                          <td><span style={{ color: sc.mau, fontWeight:'600' }}>{sc.mon}</span></td>
                          <td>Thứ {sc.thu} (Tiết {sc.tiet_bat_dau}-{sc.tiet_ket_thuc})</td>
                          <td>{sc.phong}</td>
                          <td>{sc.giang_vien}</td>
                          <td style={{ display:'flex', gap:'8px' }}>
                             <button className={`${styles.actionBtn} ${styles.editBtn}`} onClick={() => { setScheduleForm(sc); setIsEditingSchedule(true); setShowScheduleModal(true); }}>Sửa</button>
                             <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => handleDeleteSchedule(sc.id)}>Xoá</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {!loading && schedule.length === 0 && <div className={styles.card}><div className={styles.emptyCell}>Chưa có lớp học phần nào.</div></div>}
          </>
        )}

        {activeTab === 'notifications' && (
          <>
            <div className={styles.headerRow}>
              <div className={styles.headerTitleArea}>
                <h2>Quản lý Thông báo</h2>
                <div className={styles.headerSubtitle}>Đăng tải tin tức, cảnh báo, nhắc nhở tới mọi User</div>
              </div>
              <div className={styles.headerActions}>
                <button className={styles.primaryBtn} onClick={() => { setIsEditingNotif(false); setNotifForm({ id: '', loai: '📢', tieu_de: '', noi_dung: '', thoi_gian: '', da_doc: false }); setShowNotifModal(true); }}>+ Viết Thông báo</button>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead><tr><th>Loại</th><th>Tiêu đề</th><th>Nội dung</th><th>Ngày đăng</th><th>Thao tác</th></tr></thead>
                  <tbody>
                    {loading ? <tr><td colSpan="5" className={styles.emptyCell}>Đang tải...</td></tr> :
                      notifications.map(nf => (
                        <tr key={nf.id}>
                          <td style={{fontSize:'1.5rem'}}>{nf.loai}</td>
                          <td><strong>{nf.tieu_de}</strong></td>
                          <td style={{ maxWidth:'300px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{nf.noi_dung}</td>
                          <td>{new Date(nf.thoi_gian).toLocaleDateString('vi-VN')}</td>
                          <td style={{ display:'flex', gap:'8px' }}>
                             <button className={`${styles.actionBtn} ${styles.editBtn}`} onClick={() => { setNotifForm(nf); setIsEditingNotif(true); setShowNotifModal(true); }}>Sửa</button>
                             <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => handleDeleteNotif(nf.id)}>Xoá</button>
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'settings' && (
          <div className={styles.settingsCard}>
            <h3>Thuật toán Hệ số Điểm (Global)</h3>
            <div className={styles.settingGroup}>
              <div className={styles.settingInfo}><label>Điểm Quá Trình</label><p>Hệ số điểm thành phần (QT)</p></div>
              <div className={styles.settingInput}><input type="number" step="0.1" max="1" value={config.grading_weights?.diem_qt ?? 0.2} onChange={e => setConfig({...config, grading_weights: {...config.grading_weights, diem_qt: parseFloat(e.target.value)||0}})} /></div>
            </div>
            <div className={styles.settingGroup}>
              <div className={styles.settingInfo}><label>Điểm Giữa Kỳ</label><p>Hệ số kiểm tra giữa kỳ (GK)</p></div>
              <div className={styles.settingInput}><input type="number" step="0.1" max="1" value={config.grading_weights?.diem_gk ?? 0.3} onChange={e => setConfig({...config, grading_weights: {...config.grading_weights, diem_gk: parseFloat(e.target.value)||0}})} /></div>
            </div>
            <div className={styles.settingGroup}>
              <div className={styles.settingInfo}><label>Điểm Cuối Kỳ</label><p>Hệ số đánh giá cuối kỳ (CK)</p></div>
              <div className={styles.settingInput}><input type="number" step="0.1" max="1" value={config.grading_weights?.diem_ck ?? 0.5} onChange={e => setConfig({...config, grading_weights: {...config.grading_weights, diem_ck: parseFloat(e.target.value)||0}})} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button className={styles.primaryBtn} onClick={handleSaveConfig}>Lưu cấu hình Server</button>
            </div>
          </div>
        )}

      </main>

      {/* --- MODALS --- */}

      {showStudentModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>{isEditingStudent ? 'Sửa thông tin Sinh viên' : 'Thêm Sinh viên mới'}</h3>
            <form onSubmit={handleStudentSubmit}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}><label>MSSV</label><input required disabled={isEditingStudent} value={studentForm.mssv} onChange={e=>setStudentForm({...studentForm, mssv: e.target.value})} /></div>
                {!isEditingStudent && <div className={styles.formGroup}><label>Mật khẩu</label><input required value={studentForm.password} onChange={e=>setStudentForm({...studentForm, password: e.target.value})} /></div>}
                <div className={styles.formGroup}><label>Họ và Tên</label><input required value={studentForm.ho_ten} onChange={e=>setStudentForm({...studentForm, ho_ten: e.target.value})} /></div>
                <div className={styles.formGroup}><label>Ngày sinh (DD/MM/YYYY)</label><input required value={studentForm.ngay_sinh} onChange={e=>setStudentForm({...studentForm, ngay_sinh: e.target.value})} /></div>
                <div className={styles.formGroup}><label>Giới tính</label>
                  <select value={studentForm.gioi_tinh} onChange={e=>setStudentForm({...studentForm, gioi_tinh: e.target.value})}>
                    <option value="Nam">Nam</option><option value="Nữ">Nữ</option>
                  </select>
                </div>
                <div className={styles.formGroup}><label>Lớp học</label><input value={studentForm.lop} onChange={e=>setStudentForm({...studentForm, lop: e.target.value})} /></div>
                <div className={styles.formGroup}><label>Khoa quản lý</label><input value={studentForm.khoa} onChange={e=>setStudentForm({...studentForm, khoa: e.target.value})} /></div>
                <div className={styles.formGroup}><label>Chuyên ngành</label><input value={studentForm.nganh} onChange={e=>setStudentForm({...studentForm, nganh: e.target.value})} /></div>
                <div className={`${styles.formGroup} ${styles.fullWidth}`}><label>Trạng thái</label>
                  <select value={studentForm.trang_thai} onChange={e=>setStudentForm({...studentForm, trang_thai: e.target.value})}>
                    <option value="Đang học">Đang học</option>
                    <option value="Đã thôi học / Xóa">Đã thôi học / Xóa</option>
                  </select>
                </div>
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowStudentModal(false)}>Hủy</button>
                <button type="submit" className={styles.submitBtn}>Lưu lại</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTeacherModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>{isEditingTeacher ? 'Sửa thông tin Giảng viên' : 'Thêm Giảng viên mới'}</h3>
            <form onSubmit={handleTeacherSubmit}>
              <div className={styles.formGrid}>
                <div className={`${styles.formGroup} ${styles.fullWidth}`}><label>Tài khoản / Username</label><input required disabled={isEditingTeacher} value={teacherForm.username} onChange={e=>setTeacherForm({...teacherForm, username: e.target.value})} /></div>
                {!isEditingTeacher && <div className={`${styles.formGroup} ${styles.fullWidth}`}><label>Mật khẩu</label><input required value={teacherForm.password} onChange={e=>setTeacherForm({...teacherForm, password: e.target.value})} /></div>}
                <div className={`${styles.formGroup} ${styles.fullWidth}`}><label>Họ và Tên</label><input required value={teacherForm.name} onChange={e=>setTeacherForm({...teacherForm, name: e.target.value})} /></div>
                <div className={styles.formGroup}><label>Học vị (ThS. / TS.)</label><input required value={teacherForm.title} onChange={e=>setTeacherForm({...teacherForm, title: e.target.value})} /></div>
                <div className={styles.formGroup}><label>Bộ môn phụ trách</label><input required value={teacherForm.department} onChange={e=>setTeacherForm({...teacherForm, department: e.target.value})} /></div>
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowTeacherModal(false)}>Hủy</button>
                <button type="submit" className={styles.submitBtn}>Lưu lại</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showScheduleModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>{isEditingSchedule ? 'Sửa Lớp học phần' : 'Thêm Lớp mới'}</h3>
            <form onSubmit={handleScheduleSubmit}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}><label>Học kỳ</label><input required value={scheduleForm.term || ''} onChange={e=>setScheduleForm({...scheduleForm, term: e.target.value})} /></div>
                <div className={styles.formGroup}><label>Mã Lớp Học Phần</label><input required value={scheduleForm.ma_mon} onChange={e=>setScheduleForm({...scheduleForm, ma_mon: e.target.value})} /></div>
                <div className={styles.formGroup}><label>Tên Môn Học</label><input required value={scheduleForm.mon} onChange={e=>setScheduleForm({...scheduleForm, mon: e.target.value})} /></div>
                <div className={styles.formGroup}><label>Giảng Viên</label><input required value={scheduleForm.giang_vien} onChange={e=>setScheduleForm({...scheduleForm, giang_vien: e.target.value})} /></div>
                <div className={styles.formGroup}><label>Phòng</label><input required value={scheduleForm.phong} onChange={e=>setScheduleForm({...scheduleForm, phong: e.target.value})} /></div>
                <div className={styles.formGroup}><label>Ngày Học (Thứ)</label>
                  <select value={scheduleForm.thu} onChange={e=>setScheduleForm({...scheduleForm, thu: parseInt(e.target.value)})}>
                    {[2,3,4,5,6,7].map(t => <option key={t} value={t}>Thứ {t}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}><label>Màu hiển thị</label><input type="color" value={scheduleForm.mau} onChange={e=>setScheduleForm({...scheduleForm, mau: e.target.value})} /></div>
                <div className={styles.formGroup}><label>Tiết Bắt đầu</label><input type="number" min="1" max="15" value={scheduleForm.tiet_bat_dau} onChange={e=>setScheduleForm({...scheduleForm, tiet_bat_dau: e.target.value})} /></div>
                <div className={styles.formGroup}><label>Tiết Kết thúc</label><input type="number" min="1" max="15" value={scheduleForm.tiet_ket_thuc} onChange={e=>setScheduleForm({...scheduleForm, tiet_ket_thuc: e.target.value})} /></div>
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowScheduleModal(false)}>Hủy</button>
                <button type="submit" className={styles.submitBtn}>Lưu Lớp</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showNotifModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>{isEditingNotif ? 'Sửa Thông Báo' : 'Soạn Thông Báo Mới'}</h3>
            <form onSubmit={handleNotifSubmit}>
              <div className={styles.formGroup}>
                <label>Loại (Icon / Cảnh báo)</label>
                <select value={notifForm.loai} onChange={e=>setNotifForm({...notifForm, loai: e.target.value})}>
                  <option value="📢">📢 Tin Tức</option>
                  <option value="⚠️">⚠️ Cảnh báo</option>
                  <option value="📅">📅 Lịch Trình</option>
                  <option value="🎯">🎯 Mục tiêu</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Tiêu đề</label>
                <input required value={notifForm.tieu_de} onChange={e=>setNotifForm({...notifForm, tieu_de: e.target.value})} />
              </div>
              <div className={styles.formGroup}>
                <label>Nội dung chi tiết</label>
                <textarea rows="4" required value={notifForm.noi_dung} onChange={e=>setNotifForm({...notifForm, noi_dung: e.target.value})} />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowNotifModal(false)}>Hủy</button>
                <button type="submit" className={styles.submitBtn}>Phát hành</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPwdModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '400px' }}>
            <h3>Đặt lại Mật Khẩu</h3>
            <div className={styles.modalSubtitle}>ID Đích: <strong>{pwdTarget.id}</strong></div>
            <form onSubmit={handlePwdSubmit}>
              <div className={styles.formGroup}><label>Mật khẩu mới</label><input required value={pwdForm.new_password} onChange={e => setPwdForm({...pwdForm, new_password: e.target.value})} /></div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowPwdModal(false)}>Hủy</button>
                <button type="submit" className={styles.submitBtn}>Cập nhật</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent} style={{ maxWidth: '600px' }}>
            <h3>Phân công: {assignTarget}</h3>
            <form onSubmit={handleAddAssignment} style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--border-light)' }}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}><label>Mã Học Phần</label><input required value={courseForm.course_code} onChange={e => setCourseForm({...courseForm, course_code: e.target.value})} /></div>
                <div className={styles.formGroup}><label>Tên môn học</label><input required value={courseForm.course_name} onChange={e => setCourseForm({...courseForm, course_name: e.target.value})} /></div>
                <div className={`${styles.formGroup} ${styles.fullWidth}`}><label>Học kỳ</label><input required value={courseForm.term} onChange={e => setCourseForm({...courseForm, term: e.target.value})} /></div>
              </div>
              <button type="submit" className={styles.submitBtn} style={{ width: '100%' }}>Thêm lớp vào Profile Giảng viên</button>
            </form>

            <table className={styles.table}>
              <thead><tr><th>Mã Môn</th><th>Tên Môn</th><th>Học Kỳ</th><th>Hủy</th></tr></thead>
              <tbody>
                {assignments.map((a, idx) => (
                  <tr key={idx}><td>{a.course_code}</td><td>{a.course_name}</td><td>{a.term}</td>
                  <td><button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => handleRemoveAssignment(a.course_code, a.term)}>Xóa</button></td></tr>
                ))}
              </tbody>
            </table>
            
            <div className={styles.modalActions}><button type="button" className={styles.cancelBtn} onClick={() => setShowAssignModal(false)}>Đóng</button></div>
          </div>
        </div>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}
