export function StatusBanner({ kind = 'info', title, children }) {
  return (
    <div className={`banner banner--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <strong>{title}</strong>
      <span>{children}</span>
    </div>
  )
}
