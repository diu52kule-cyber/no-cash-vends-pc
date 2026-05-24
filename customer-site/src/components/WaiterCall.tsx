export function WaiterCallBtn({ onClick }: { onClick: () => void }) {
  return (
    <button className="waiter-btn" onClick={onClick} aria-label="Call waiter" title="Call waiter">
      🛎
    </button>
  );
}
