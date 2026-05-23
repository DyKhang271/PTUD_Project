export function LoadingState({ label = "Đang tải dữ liệu..." }) {
  return <div className="state-card">{label}</div>;
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state-card state-error">
      <p>{message || "Có lỗi xảy ra khi tải dữ liệu."}</p>
      {onRetry ? (
        <button className="secondary-button" onClick={onRetry}>
          Tải lại
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ message = "Chưa có dữ liệu." }) {
  return <div className="state-card">{message}</div>;
}
