import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { login } from "../services/authApi";
import { AUTH_ERROR_MESSAGES } from "../services/authErrors";

const roleOptions = [
  { value: "teacher", label: "Giảng viên", shortLabel: "GV", hint: "Điểm danh và quản lý lớp" },
  { value: "student", label: "Sinh viên", shortLabel: "SV", hint: "Lịch học, lịch thi, chuyên cần" },
  { value: "admin", label: "Quản trị", shortLabel: "QT", hint: "Điều phối học kỳ và dữ liệu" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { authNotice, clearAuthNotice, loginSuccess, loading, setLoading } = useAuth();
  const [form, setForm] = useState({ role: "teacher", username: "", password: "" });
  const [error, setError] = useState(authNotice || "");
  const activeRole = roleOptions.find((option) => option.value === form.role) || roleOptions[0];

  const [captchaText, setCaptchaText] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const canvasRef = useRef(null);

  const generateCaptcha = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Loại bỏ ký tự dễ nhầm lẫn như O, 0, I, 1
    let result = "";
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCaptchaText(result);
    setCaptchaInput("");
  };

  const drawCaptcha = (text) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Reset background cực sạch, sáng sủa
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Bo viền nhẹ cho khung canvas để trông thẩm mỹ hơn
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // --- 1. Vẽ chữ CAPTCHA trước ---
    ctx.textBaseline = "middle";
    const charsList = text.split("");
    const space = canvas.width / (charsList.length + 1);

    charsList.forEach((char, index) => {
      ctx.save();
      // Vị trí chữ cân đối, không lệch nhiều
      const x = space * (index + 1) + (Math.random() * 4 - 2);
      const y = canvas.height / 2 + (Math.random() * 4 - 2);

      // Font chữ to, đậm và hiện đại
      const fontSize = 30;
      ctx.font = `bold ${fontSize}px "Outfit", "Inter", -apple-system, sans-serif`;

      // Palette màu tối, có độ tương phản cực kỳ cao với nền sáng
      const premiumColors = ["#0f172a", "#1e293b", "#334155", "#0284c7", "#0f766e", "#4338ca", "#b91c1c"];
      ctx.fillStyle = premiumColors[Math.floor(Math.random() * premiumColors.length)];

      // Độ nghiêng cực nhỏ (chỉ ±6 độ) để cực kỳ dễ nhận diện bằng mắt thường
      const angle = (Math.random() * 12 - 6) * Math.PI / 180;
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillText(char, -fontSize / 3, 0);
      ctx.restore();
    });

    // --- 2. Vẽ một ít nhiễu đè LÊN chữ (độ nhiễu vừa phải) ---
    // 5 đường cong Bezier mảnh trung bình đè lên chữ
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.bezierCurveTo(
        Math.random() * canvas.width, Math.random() * canvas.height,
        Math.random() * canvas.width, Math.random() * canvas.height,
        Math.random() * canvas.width, Math.random() * canvas.height
      );
      const lineColors = ["#475569", "#0284c7", "#0d9488", "#b91c1c", "#4f46e5"]; // Màu đậm rõ nét
      ctx.strokeStyle = lineColors[Math.floor(Math.random() * lineColors.length)];
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // 50 chấm tròn nhỏ đè lên chữ
    for (let i = 0; i < 50; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 0.8 + 0.8, 0, 2 * Math.PI);
      ctx.fillStyle = "rgba(71, 85, 105, 0.5)"; // Độ đậm 50%
      ctx.fill();
    }
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  useEffect(() => {
    if (captchaText) {
      drawCaptcha(captchaText);
    }
  }, [captchaText]);

  const handleDemoClick = (username) => {
    let role = "teacher";
    let password = username;
    if (username === "23630781") {
      role = "student";
    } else if (username === "admin") {
      role = "admin";
      password = "admin";
    }
    setForm({ role, username, password });
    setCaptchaInput(captchaText); // Tự động điền đúng mã CAPTCHA hiện tại luôn!
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    clearAuthNotice();

    if (captchaInput.trim().toLowerCase() !== captchaText.toLowerCase()) {
      setError("Mã xác thực (CAPTCHA) không chính xác.");
      generateCaptcha();
      return;
    }

    setLoading(true);
    try {
      const data = await login(form);
      loginSuccess(data);
      navigate(`/${data.user.role}/dashboard`, { replace: true });
    } catch (err) {
      setError(err?.message || AUTH_ERROR_MESSAGES.invalid_auth_response);
      generateCaptcha();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-hero" aria-label="IUH Timetable">
        <div className="login-hero-brand">
          <div className="login-logo">TKB</div>
          <div>
            <p className="login-kicker">IUH Timetable</p>
            <h1>Quản lý thời khóa biểu</h1>
          </div>
        </div>
        <div className="login-hero-copy">
          <span>Lịch học</span>
          <span>Điểm danh</span>
          <span>Lịch thi</span>
        </div>
      </section>

      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-card-header">
          <div>
            <p className="login-kicker">Đăng nhập hệ thống</p>
            <h2>Chào mừng trở lại</h2>
          </div>
          <span className="login-role-chip">{activeRole.label}</span>
        </div>

        <div className="role-switch" role="tablist" aria-label="Chọn vai trò đăng nhập">
          {roleOptions.map((option) => (
            <button
              aria-selected={form.role === option.value}
              className={`role-option ${form.role === option.value ? "active" : ""}`}
              key={option.value}
              onClick={() => setForm((prev) => ({ ...prev, role: option.value }))}
              role="tab"
              type="button"
            >
              <span className="role-icon">{option.shortLabel}</span>
              <span>
                <strong>{option.label}</strong>
                <small>{option.hint}</small>
              </span>
            </button>
          ))}
        </div>

        <div className="login-form-grid">
          <label className="field-group login-field">
            <span>Tên đăng nhập</span>
            <input
              autoComplete="username"
              value={form.username}
              onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
              placeholder={form.role === "student" ? "Nhập mã số sinh viên" : "Nhập username"}
              required
            />
          </label>

          <label className="field-group login-field">
            <span>Mật khẩu</span>
            <input
              autoComplete="current-password"
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="Nhập mật khẩu"
              required
            />
          </label>

          <div className="login-captcha-section">
            <label className="field-group login-field">
              <span>Mã xác thực</span>
              <input
                value={captchaInput}
                onChange={(event) => setCaptchaInput(event.target.value)}
                placeholder="Mã xác thực"
                required
              />
            </label>
            <div className="captcha-container">
              <canvas
                ref={canvasRef}
                width="160"
                height="50"
                onClick={generateCaptcha}
                title="Nhấp để đổi mã CAPTCHA khác"
                style={{ cursor: "pointer", borderRadius: "10px", border: "1px solid var(--border)" }}
              />
              <button
                type="button"
                className="secondary-button refresh-captcha-btn"
                onClick={generateCaptcha}
                title="Đổi mã CAPTCHA"
              >
                🔄
              </button>
            </div>
          </div>
        </div>

        {error ? <div className="state-card state-error login-error">{error}</div> : null}

        <button className="primary-button login-submit" disabled={loading} type="submit">
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>

        <div className="login-demo-list" aria-label="Tài khoản demo">
          <span>Demo</span>
          <button type="button" className="login-demo-chip" onClick={() => handleDemoClick("gvungdung")}>gvungdung</button>
          <button type="button" className="login-demo-chip" onClick={() => handleDemoClick("gvaiml")}>gvaiml</button>
          <button type="button" className="login-demo-chip" onClick={() => handleDemoClick("23630781")}>23630781</button>
          <button type="button" className="login-demo-chip" onClick={() => handleDemoClick("admin")}>admin</button>
        </div>
      </form>

      <div className="login-mobile-brand">
        <div className="login-logo">TKB</div>
        <div>
          <p className="login-kicker">IUH Timetable</p>
          <strong>Quản lý thời khóa biểu</strong>
        </div>
      </div>
    </div>
  );
}
