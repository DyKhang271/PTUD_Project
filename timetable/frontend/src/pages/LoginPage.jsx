import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { login } from "../services/authApi";
import { AUTH_ERROR_MESSAGES } from "../services/authErrors";

const roleOptions = [
  { value: "teacher", label: "Giang vien" },
  { value: "student", label: "Sinh vien" },
  { value: "admin", label: "Quan tri" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { authNotice, clearAuthNotice, loginSuccess, setLoading } = useAuth();
  const [form, setForm] = useState({ role: "teacher", username: "", password: "" });
  const [error, setError] = useState(authNotice || "");

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
      <form className="login-card form-grid" onSubmit={handleSubmit}>
        <div>
          <div className="helper-text">Timetable login</div>
          <h1>Dang nhap</h1>
          <p className="page-subtitle">Timetable dang dung truc tiep JWT do Student Portal cap.</p>
        </div>

        <label className="field-group">
          <span>Vai tro</span>
          <select value={form.role} onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}>
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-group">
          <span>Ten dang nhap</span>
          <input
            value={form.username}
            onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
            placeholder="MSSV hoac username"
          />
        </label>

        <label className="field-group">
          <span>Mat khau</span>
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            placeholder="Nhap mat khau"
          />
        </label>

        {error ? <div className="state-card state-error">{error}</div> : null}

        <button className="primary-button" type="submit">
          Dang nhap
        </button>
      </form>
    </div>
  );
}
