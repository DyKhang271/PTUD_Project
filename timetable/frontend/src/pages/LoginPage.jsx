import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../services/authApi";
import { useAuth } from "../contexts/AuthContext";

const roleOptions = [
  { value: "teacher", label: "Giảng viên" },
  { value: "student", label: "Sinh viên" },
  { value: "admin", label: "Quản trị" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { loginSuccess, setLoading } = useAuth();
  const [form, setForm] = useState({ role: "teacher", username: "", password: "" });
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(form);
      loginSuccess(data);
      navigate(`/${data.user.role}/dashboard`, { replace: true });
    } catch (err) {
      setError(err?.response?.data?.detail || "Đăng nhập thất bại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card form-grid" onSubmit={handleSubmit}>
        <div>
          <div className="helper-text">MVP frontend cho timetable</div>
          <h1>Đăng nhập</h1>
          <p className="page-subtitle">Đăng nhập bằng tài khoản đang có trên Student Portal để nhận JWT riêng của timetable.</p>
        </div>

        <label className="field-group">
          <span>Vai trò</span>
          <select value={form.role} onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}>
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-group">
          <span>Tên đăng nhập</span>
          <input
            value={form.username}
            onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
            placeholder="MSSV hoặc username"
          />
        </label>

        <label className="field-group">
          <span>Mật khẩu</span>
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            placeholder="Nhập mật khẩu"
          />
        </label>

        {error ? <div className="state-card state-error">{error}</div> : null}

        <button className="primary-button" type="submit">
          Đăng nhập
        </button>
      </form>
    </div>
  );
}
