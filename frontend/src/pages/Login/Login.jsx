import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { studentLogin, parentLogin } from '../../services/api';
import styles from './Login.module.css';

// Generate random CAPTCHA text
function generateCaptchaText() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let text = '';
  for (let i = 0; i < 5; i++) {
    text += chars[Math.floor(Math.random() * chars.length)];
  }
  return text;
}

// Draw CAPTCHA on canvas
function drawCaptcha(canvas, text) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  // Background
  ctx.fillStyle = '#f0f4f8';
  ctx.fillRect(0, 0, w, h);

  // Noise lines
  for (let i = 0; i < 5; i++) {
    ctx.strokeStyle = `hsl(${Math.random() * 360}, 40%, 75%)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.random() * w, Math.random() * h);
    ctx.bezierCurveTo(
      Math.random() * w, Math.random() * h,
      Math.random() * w, Math.random() * h,
      Math.random() * w, Math.random() * h
    );
    ctx.stroke();
  }

  // Noise dots
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `hsl(${Math.random() * 360}, 30%, 70%)`;
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Text
  ctx.font = 'bold 28px Inter, Arial, sans-serif';
  ctx.textBaseline = 'middle';
  const totalWidth = ctx.measureText(text).width;
  let startX = (w - totalWidth) / 2;

  for (let i = 0; i < text.length; i++) {
    ctx.save();
    const x = startX + ctx.measureText(text.substring(0, i)).width + 12 * i / text.length;
    const y = h / 2 + (Math.random() - 0.5) * 10;
    const angle = (Math.random() - 0.5) * 0.4;
    ctx.translate(x + 6, y);
    ctx.rotate(angle);
    ctx.fillStyle = `hsl(${200 + Math.random() * 60}, 60%, ${30 + Math.random() * 20}%)`;
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
  }
}

export default function Login() {
  const [activeTab, setActiveTab] = useState('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  // Student form
  const [mssv, setMssv] = useState('');
  const [password, setPassword] = useState('');

  // Parent form
  const [pHoTen, setPHoTen] = useState('');
  const [pMssv, setPMssv] = useState('');
  const [pNgaySinh, setPNgaySinh] = useState('');
  const [pSdt, setPSdt] = useState('');

  // CAPTCHA
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
  }, [refreshCaptcha]);

  // Redraw when tab changes
  useEffect(() => {
    setTimeout(() => {
      if (captchaRef.current && captchaText) {
        drawCaptcha(captchaRef.current, captchaText);
      }
    }, 50);
  }, [activeTab, captchaText]);

  const handleStudentLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!mssv.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ thông tin.');
      return;
    }
    if (captchaInput.toUpperCase() !== captchaText) {
      setError('Mã CAPTCHA không chính xác.');
      refreshCaptcha();
      return;
    }

    setLoading(true);
    try {
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

  const handleParentLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!pHoTen.trim() || !pMssv.trim() || !pNgaySinh.trim() || !pSdt.trim()) {
      setError('Vui lòng nhập đầy đủ thông tin.');
      return;
    }
    if (captchaInput.toUpperCase() !== captchaText) {
      setError('Mã CAPTCHA không chính xác.');
      refreshCaptcha();
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
          {/* Header */}
          <div className={styles.loginHeader}>
            <div className={styles.loginLogo}>🎓</div>
            <div className={styles.loginTitle}>IUH Portal</div>
            <div className={styles.loginSubtitle}>Cổng thông tin sinh viên</div>
          </div>

          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'student' ? styles.tabActive : ''}`}
              onClick={() => { setActiveTab('student'); setError(''); }}
            >
              🎒 Sinh viên
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'parent' ? styles.tabActive : ''}`}
              onClick={() => { setActiveTab('parent'); setError(''); }}
            >
              👨‍👩‍👧 Phụ huynh
            </button>
          </div>

          {/* Form */}
          <div className={styles.formBody}>
            {error && (
              <div className={styles.formError}>⚠️ {error}</div>
            )}

            {activeTab === 'student' ? (
              <form onSubmit={handleStudentLogin}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Mã số sinh viên</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    placeholder="Nhập MSSV (VD: 21110001)"
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

                {/* CAPTCHA */}
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
                    🔄
                  </button>
                </div>

                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={loading}
                >
                  {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </button>

                <div className={styles.loginHint}>
                  <strong>Demo:</strong> MSSV: <strong>21110001</strong> | Mật khẩu: <strong>123456</strong>
                </div>
              </form>
            ) : (
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
                    placeholder="DD/MM/YYYY (VD: 15/03/2003)"
                    value={pNgaySinh}
                    onChange={(e) => setPNgaySinh(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Số điện thoại sinh viên</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    placeholder="Nhập SĐT sinh viên"
                    value={pSdt}
                    onChange={(e) => setPSdt(e.target.value)}
                  />
                </div>

                {/* CAPTCHA */}
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
                    🔄
                  </button>
                </div>

                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={loading}
                >
                  {loading ? 'Đang xác thực...' : 'Đăng nhập phụ huynh'}
                </button>

                <div className={styles.loginHint}>
                  <strong>Demo:</strong> Tên: <strong>Nguyễn Văn An</strong> | MSSV: <strong>21110001</strong> | Ngày sinh: <strong>15/03/2003</strong> | SĐT: <strong>0901234567</strong>
                </div>
              </form>
            )}
          </div>

          {/* Parent note */}
          {activeTab === 'student' && (
            <div className={styles.parentNote}>
              Phụ huynh muốn theo dõi kết quả học tập?{' '}
              <span className={styles.parentNoteLink} onClick={() => setActiveTab('parent')}>
                Đăng nhập tại đây →
              </span>
            </div>
          )}
        </div>

        <div className={styles.loginFooter}>
          © 2025 IUH Student Portal — Trường ĐH Công nghiệp TP.HCM
        </div>
      </div>
    </div>
  );
}
