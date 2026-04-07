import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAvailableAccounts,
  parentLogin,
  studentLogin,
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

  ctx.fillStyle = '#f0f4f8';
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 5; i += 1) {
    ctx.strokeStyle = `hsl(${Math.random() * 360}, 40%, 75%)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.random() * width, Math.random() * height);
    ctx.bezierCurveTo(
      Math.random() * width,
      Math.random() * height,
      Math.random() * width,
      Math.random() * height,
      Math.random() * width,
      Math.random() * height,
    );
    ctx.stroke();
  }

  for (let i = 0; i < 40; i += 1) {
    ctx.fillStyle = `hsl(${Math.random() * 360}, 30%, 70%)`;
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.font = 'bold 28px Inter, Arial, sans-serif';
  ctx.textBaseline = 'middle';
  const totalWidth = ctx.measureText(text).width;
  const startX = (width - totalWidth) / 2;

  for (let i = 0; i < text.length; i += 1) {
    ctx.save();
    const x = startX + ctx.measureText(text.substring(0, i)).width + (12 * i) / text.length;
    const y = height / 2 + (Math.random() - 0.5) * 10;
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
  const [accounts, setAccounts] = useState([]);
  const navigate = useNavigate();
  const { login } = useAuth();

  const [mssv, setMssv] = useState('');
  const [password, setPassword] = useState('');

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
  }, [refreshCaptcha]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (captchaRef.current && captchaText) {
        drawCaptcha(captchaRef.current, captchaText);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [activeTab, captchaText]);

  const fillStudentAccount = (account) => {
    setMssv(account.mssv);
    setPassword(account.password);
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
          <div className={styles.loginHeader}>
            <div className={styles.loginLogo}>🎓</div>
            <div className={styles.loginTitle}>IUH Portal</div>
            <div className={styles.loginSubtitle}>Cổng thông tin sinh viên</div>
          </div>

          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'student' ? styles.tabActive : ''}`}
              onClick={() => {
                setActiveTab('student');
                setError('');
              }}
            >
              🎒 Sinh viên
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'parent' ? styles.tabActive : ''}`}
              onClick={() => {
                setActiveTab('parent');
                setError('');
              }}
            >
              👨‍👩‍👧 Phụ huynh
            </button>
          </div>

          <div className={styles.formBody}>
            {error && <div className={styles.formError}>⚠️ {error}</div>}

            {activeTab === 'student' ? (
              <form onSubmit={handleStudentLogin}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Mã số sinh viên</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    placeholder="Nhập MSSV"
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
                  <strong>2 tài khoản sinh viên hiện có</strong>
                  <div className={styles.accountList}>
                    {accounts.map((account) => (
                      <button
                        key={account.mssv}
                        type="button"
                        className={styles.accountItem}
                        onClick={() => fillStudentAccount(account)}
                      >
                        <span className={styles.accountName}>{account.ho_ten}</span>
                        <span className={styles.accountMeta}>
                          {account.mssv} • mật khẩu: {account.password}
                        </span>
                      </button>
                    ))}
                  </div>
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

          {activeTab === 'student' && (
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
