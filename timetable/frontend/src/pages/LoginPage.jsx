import { useState } from "react";
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

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    clearAuthNotice();
    setLoading(true);
    try {
      const data = await login(form);
      loginSuccess(data);
      navigate(`/${data.user.role}/dashboard`, { replace: true });
    } catch (err) {
      setError(err?.message || AUTH_ERROR_MESSAGES.invalid_auth_response);
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
            />
          </label>
        </div>

        {error ? <div className="state-card state-error login-error">{error}</div> : null}

        <button className="primary-button login-submit" disabled={loading} type="submit">
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>

        <div className="login-demo-list" aria-label="Tài khoản demo">
          <span>Demo</span>
          <code>gvungdung</code>
          <code>gvaiml</code>
          <code>23630781</code>
          <code>admin</code>
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
