import { Component } from 'react'

export class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  componentDidCatch(error, info) { console.error('Dashboard display failed', error, info.componentStack) }

  render() {
    if (this.state.failed) {
      return (
        <main className="shell">
          <section className="card error-card" role="alert">
            <h1>Unable to display this snapshot</h1>
            <p>No activity reading is available. Reload to request the data again.</p>
            <button type="button" className="evidence-action" onClick={() => window.location.reload()}>Reload dashboard</button>
          </section>
        </main>
      )
    }
    return this.props.children
  }
}
