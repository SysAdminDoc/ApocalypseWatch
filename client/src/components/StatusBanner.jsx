export function StatusBanner({ kind = 'info', title, children }) {
  return (
    <div className={`banner banner--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span className="banner-icon" aria-hidden="true" />
      <span className="banner-content">
        <strong>{title}</strong>
        <span>{children}</span>
      </span>
    </div>
  )
}
