export function LoadingState({ label = "Đang tải dữ liệu..." }) {
  return (
    <div className="empty-state" style={{ minHeight: "260px" }}>
      <div className="spinner"></div>
      <div style={{ fontWeight: 600, color: "var(--text-secondary)", marginTop: "12px" }}>{label}</div>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="empty-state state-error" style={{ borderColor: "var(--danger)", background: "var(--danger-bg)", minHeight: "220px" }}>
      <div style={{ fontSize: "2.5rem" }}>⚠️</div>
      <div style={{ fontWeight: 700, color: "var(--danger)", fontSize: "1.1rem" }}>Đã xảy ra lỗi</div>
      <p style={{ color: "var(--danger)", fontSize: "0.95rem", maxWidth: "450px" }}>{message || "Có lỗi xảy ra khi tải dữ liệu."}</p>
      {onRetry ? (
        <button className="secondary-button" style={{ border: "1px solid var(--danger)", color: "var(--danger)", background: "transparent" }} onClick={onRetry}>
          Thử lại
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ message = "Chưa có dữ liệu." }) {
  return (
    <div className="empty-state">
      <div style={{ fontSize: "2.5rem" }}>📂</div>
      <p style={{ fontSize: "0.95rem", fontWeight: 500, color: "var(--text-secondary)", maxWidth: "400px" }}>{message}</p>
    </div>
  );
}
