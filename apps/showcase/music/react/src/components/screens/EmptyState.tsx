/** The one empty state, so five screens cannot each draw a different one. */
export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="empty">
      <span className="material-symbols-outlined empty__icon" aria-hidden="true">
        music_off
      </span>
      <p className="empty__message">{message}</p>
      {hint ? <p className="empty__hint">{hint}</p> : null}
    </div>
  );
}
