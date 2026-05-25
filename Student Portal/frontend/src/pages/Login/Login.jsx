import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  adminLogin,
  getAvailableAccounts,
  getAvailableTeachers,
  parentLogin,
  studentLogin,
  teacherLogin,
} from '../../services/api';
import styles from './Login.module.css';

function generateCaptchaText() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let text = '';
  for (let i = 0; i < 5; i += 1) {
    text += chars[Math.floor(Math.random() * chars.length)];
  }
  return text;
}

function drawCaptcha(canvas, text) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // Reset background cực sạch, sáng sủa
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  // Bo viền nhẹ cho khung canvas để trông thẩm mỹ hơn
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, width, height);

  // --- 1. Vẽ chữ CAPTCHA trước ---
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 28px "Outfit", "Inter", -apple-system, sans-serif';
  const totalWidth = ctx.measureText(text).width;
  const startX = (width - totalWidth) / 2;

  for (let i = 0; i < text.length; i += 1) {
    ctx.save();
    // Vị trí chữ cân đối
    const x = startX + ctx.measureText(text.substring(0, i)).width + (12 * i) / text.length;
    const y = height / 2 + (Math.random() - 0.5) * 6;
    
    // Độ nghiêng cực nhỏ (chỉ ±6 độ) để cực kỳ dễ nhận diện bằng mắt thường
    const angle = (Math.random() - 0.5) * 0.2;
    ctx.translate(x + 6, y);
    ctx.rotate(angle);

    // Palette màu tối, tương phản cực kỳ cao với nền sáng
    const premiumColors = ['#0f172a', '#1e293b', '#334155', '#0284c7', '#0f766e', '#4338ca', '#b91c1c'];
    ctx.fillStyle = premiumColors[Math.floor(Math.random() * premiumColors.length)];
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
  }

  // --- 2. Vẽ một ít nhiễu đè LÊN chữ (độ nhiễu vừa phải) ---
  // 5 đường cong Bezier mảnh trung bình đè lên chữ
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * width, Math.random() * height);
    ctx.bezierCurveTo(
      Math.random() * width, Math.random() * height,
      Math.random() * width, Math.random() * height,
      Math.random() * width, Math.random() * height,
    );
    const lineColors = ['#475569', '#0284c7', '#0d9488', '#b91c1c', '#4f46e5']; // Màu đậm rõ nét
    ctx.strokeStyle = lineColors[Math.floor(Math.random() * lineColors.length)];
    ctx.lineWidth = 1.6; // Độ dày 1.6px
    ctx.stroke();
  }

  // 50 chấm tròn nhỏ đè lên chữ
  for (let i = 0; i < 50; i += 1) {
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 0.8 + 0.8, 0, Math.PI * 2); // Bán kính nhỏ ngẫu nhiên
    ctx.fillStyle = 'rgba(71, 85, 105, 0.5)'; // Độ đậm 50%
    ctx.fill();
  }
}

export default function Login() {
  const [activeTab, setActiveTab] = useState('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const navigate = useNavigate();
  const { login } = useAuth();

  const [mssv, setMssv] = useState('');
  const [password, setPassword] = useState('');

  const [teacherUsername, setTeacherUsername] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');

  const [pHoTen, setPHoTen] = useState('');
  const [pMssv, setPMssv] = useState('');
  const [pNgaySinh, setPNgaySinh] = useState('');
  const [pSdt, setPSdt] = useState('');

  const [captchaText, setCaptchaText] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const captchaRef = useRef(null);

  const refreshCaptcha = useCallback(() => {
    const text = generateCaptchaText();
    setCaptchaText(text);
    setCaptchaInput('');
    if (captchaRef.current) {
      drawCaptcha(captchaRef.current, text);
    }
  }, []);

  useEffect(() => {
    refreshCaptcha();
    getAvailableAccounts()
      .then((res) => setAccounts(res.data))
      .catch(() => setAccounts([]));
    getAvailableTeachers()
      .then((res) => setTeachers(res.data))
      .catch(() => setTeachers([]));
  }, [refreshCaptcha]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (captchaRef.current && captchaText) {
        drawCaptcha(captchaRef.current, captchaText);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [activeTab, captchaText]);

  const verifyCaptcha = () => {
    if (captchaInput.toUpperCase() !== captchaText) {
      setError('Mã CAPTCHA không chính xác.');
      refreshCaptcha();
      return false;
    }
    return true;
  };

  const fillStudentAccount = (account) => {
    setMssv(account.mssv);
    setPassword(account.password_hint || account.mssv);
    setError('');
  };

  const fillTeacherAccount = (teacher) => {
    setTeacherUsername(teacher.username);
    setTeacherPassword(teacher.password_hint || teacher.username);
    setError('');
  };

  const fillParentAccount = (account) => {
    setPHoTen(account.ho_ten);
    setPMssv(account.mssv);
    setPNgaySinh(account.ngay_sinh);
    setPSdt(account.sdt);
    setError('');
  };

  const handleStudentLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!mssv.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ thông tin.');
      return;
    }
    if (!verifyCaptcha()) {
      return;
    }

    setLoading(true);

    try {
      if (mssv.trim() === 'admin') {
        const res = await adminLogin('admin', password);
        if (res.data.success) {
          login(res.data.admin, 'admin');
          navigate('/admin');
          return;
        }
        setError(res.data.message);
        refreshCaptcha();
        return;
      }

      const res = await studentLogin(mssv.trim(), password);
      if (res.data.success) {
        login(res.data.student, 'student');
        navigate('/dashboard');
      } else {
        setError(res.data.message);
        refreshCaptcha();
      }
    } catch {
      setError('Lỗi kết nối server. Vui lòng thử lại.');
      refreshCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleTeacherLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!teacherUsername.trim() || !teacherPassword.trim()) {
      setError('Vui lòng nhập đầy đủ thông tin giảng viên.');
      return;
    }
    if (!verifyCaptcha()) {
      return;
    }

    setLoading(true);
    try {
      const res = await teacherLogin(teacherUsername.trim(), teacherPassword);
      if (res.data.success) {
        login(res.data.teacher, 'teacher');
        navigate('/teacher');
      } else {
        setError(res.data.message);
        refreshCaptcha();
      }
    } catch {
      setError('Lỗi kết nối server. Vui lòng thử lại.');
      refreshCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleParentLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!pHoTen.trim() || !pMssv.trim() || !pNgaySinh.trim() || !pSdt.trim()) {
      setError('Vui lòng nhập đầy đủ thông tin.');
      return;
    }
    if (!verifyCaptcha()) {
      return;
    }

    setLoading(true);
    try {
      const res = await parentLogin(pHoTen.trim(), pMssv.trim(), pNgaySinh.trim(), pSdt.trim());
      if (res.data.success) {
        login(res.data.student, 'parent');
        navigate('/dashboard');
      } else {
        setError(res.data.message);
        refreshCaptcha();
      }
    } catch {
      setError('Lỗi kết nối server. Vui lòng thử lại.');
      refreshCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <div className={styles.loginHeader}>
            <div className={styles.loginLogo}>🎓</div>
            <div className={styles.loginTitle}>IUH Portal</div>
            <div className={styles.loginSubtitle}>Cổng thông tin sinh viên và giảng viên</div>
          </div>

          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'student' ? styles.tabActive : ''}`}
              onClick={() => {
                setActiveTab('student');
                setError('');
              }}
            >
              Sinh viên / Quản trị
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'teacher' ? styles.tabActive : ''}`}
              onClick={() => {
                setActiveTab('teacher');
                setError('');
              }}
            >
              Giảng viên
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'parent' ? styles.tabActive : ''}`}
              onClick={() => {
                setActiveTab('parent');
                setError('');
              }}
            >
              Phụ huynh
            </button>
          </div>

          <div className={styles.formBody}>
            {error && <div className={styles.formError}>⚠️ {error}</div>}

            {activeTab === 'student' && (
              <form onSubmit={handleStudentLogin}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Mã đăng nhập</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    placeholder="Nhập MSSV hoặc admin"
                    value={mssv}
                    onChange={(e) => setMssv(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Mật khẩu</label>
                  <input
                    className={styles.formInput}
                    type="password"
                    placeholder="Nhập mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <label className={styles.formLabel}>Mã xác thực</label>
                <div className={styles.captchaRow}>
                  <canvas
                    ref={captchaRef}
                    width={150}
                    height={50}
                    className={styles.captchaCanvas}
                    title="Click để tạo mã mới"
                    onClick={refreshCaptcha}
                  />
                  <input
                    className={styles.captchaInput}
                    type="text"
                    placeholder="Nhập mã"
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    maxLength={5}
                  />
                  <button
                    type="button"
                    className={styles.captchaRefresh}
                    onClick={refreshCaptcha}
                    title="Tạo mã mới"
                  >
                    ↻
                  </button>
                </div>

                <button type="submit" className={styles.submitBtn} disabled={loading}>
                  {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </button>

                <div className={styles.loginHint}>
                  <strong>Tài khoản demo</strong>
                  <div className={styles.accountList}>
                    {[...accounts, { mssv: 'admin', password_hint: 'admin', ho_ten: 'Quản trị viên hệ thống' }].map((account) => (
                      <button
                        key={account.mssv}
                        type="button"
                        className={styles.accountItem}
                        onClick={() => fillStudentAccount(account)}
                      >
                        <span className={styles.accountName}>{account.ho_ten}</span>
                        <span className={styles.accountMeta}>
                          {account.mssv === 'admin' ? 'Tài khoản: admin' : account.mssv} • mật khẩu demo: {account.password_hint || account.mssv}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            )}

            {activeTab === 'teacher' && (
              <form onSubmit={handleTeacherLogin}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Tài khoản giảng viên</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    placeholder="Ví dụ: gvungdung"
                    value={teacherUsername}
                    onChange={(e) => setTeacherUsername(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Mật khẩu</label>
                  <input
                    className={styles.formInput}
                    type="password"
                    placeholder="Nhập mật khẩu"
                    value={teacherPassword}
                    onChange={(e) => setTeacherPassword(e.target.value)}
                  />
                </div>

                <label className={styles.formLabel}>Mã xác thực</label>
                <div className={styles.captchaRow}>
                  <canvas
                    ref={captchaRef}
                    width={150}
                    height={50}
                    className={styles.captchaCanvas}
                    title="Click để tạo mã mới"
                    onClick={refreshCaptcha}
                  />
                  <input
                    className={styles.captchaInput}
                    type="text"
                    placeholder="Nhập mã"
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    maxLength={5}
                  />
                  <button
                    type="button"
                    className={styles.captchaRefresh}
                    onClick={refreshCaptcha}
                    title="Tạo mã mới"
                  >
                    ↻
                  </button>
                </div>

                <button type="submit" className={styles.submitBtn} disabled={loading}>
                  {loading ? 'Đang xác thực...' : 'Vào không gian giảng viên'}
                </button>

                <div className={`${styles.loginHint} ${styles.teacherHint}`}>
                  <strong>Tài khoản giảng viên đang được cấu hình</strong>
                  <div className={styles.accountList}>
                    {teachers.map((teacher) => (
                      <button
                        key={teacher.username}
                        type="button"
                        className={styles.accountItem}
                        onClick={() => fillTeacherAccount(teacher)}
                      >
                        <span className={styles.accountName}>{teacher.name}</span>
                        <span className={styles.accountMeta}>
                          {teacher.username} • {teacher.department}
                        </span>
                        <span className={styles.accountCourses}>
                          Mật khẩu demo: {teacher.password_hint || teacher.username} • {teacher.courses.join(' • ')}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            )}

            {activeTab === 'parent' && (
              <form onSubmit={handleParentLogin}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Họ và tên sinh viên</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    placeholder="Nhập họ tên sinh viên"
                    value={pHoTen}
                    onChange={(e) => setPHoTen(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Mã số sinh viên</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    placeholder="Nhập MSSV"
                    value={pMssv}
                    onChange={(e) => setPMssv(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Ngày sinh sinh viên</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={pNgaySinh}
                    onChange={(e) => setPNgaySinh(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Số điện thoại sinh viên</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    placeholder="Nhập số điện thoại"
                    value={pSdt}
                    onChange={(e) => setPSdt(e.target.value)}
                  />
                </div>

                <label className={styles.formLabel}>Mã xác thực</label>
                <div className={styles.captchaRow}>
                  <canvas
                    ref={captchaRef}
                    width={150}
                    height={50}
                    className={styles.captchaCanvas}
                    title="Click để tạo mã mới"
                    onClick={refreshCaptcha}
                  />
                  <input
                    className={styles.captchaInput}
                    type="text"
                    placeholder="Nhập mã"
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    maxLength={5}
                  />
                  <button
                    type="button"
                    className={styles.captchaRefresh}
                    onClick={refreshCaptcha}
                    title="Tạo mã mới"
                  >
                    ↻
                  </button>
                </div>

                <button type="submit" className={styles.submitBtn} disabled={loading}>
                  {loading ? 'Đang xác thực...' : 'Đăng nhập phụ huynh'}
                </button>

                <div className={styles.loginHint}>
                  <strong>Thông tin phụ huynh dùng để tra cứu</strong>
                  <div className={styles.accountList}>
                    {accounts.map((account) => (
                      <button
                        key={`${account.mssv}-parent`}
                        type="button"
                        className={styles.accountItem}
                        onClick={() => fillParentAccount(account)}
                      >
                        <span className={styles.accountName}>{account.ho_ten}</span>
                        <span className={styles.accountMeta}>
                          {account.mssv} • {account.ngay_sinh} • {account.sdt}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            )}
          </div>

          {activeTab !== 'parent' && (
            <div className={styles.parentNote}>
              Phụ huynh muốn theo dõi kết quả học tập?
              {' '}
              <span className={styles.parentNoteLink} onClick={() => setActiveTab('parent')}>
                Đăng nhập tại đây →
              </span>
            </div>
          )}
        </div>

        <div className={styles.loginFooter}>
          © 2026 IUH Student Portal - Trường ĐH Công nghiệp TP.HCM
        </div>
      </div>
    </div>
  );
}
