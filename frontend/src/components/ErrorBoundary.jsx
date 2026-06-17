import { Component } from 'react'

/**
 * Wraps a feature so a runtime error inside it never crashes the whole app.
 * Renders a small inline fallback (or nothing) instead of a white screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Log for debugging; do not rethrow
    console.error('[ErrorBoundary]', this.props.name || '', error, info)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.silent) return null
      return (
        this.props.fallback || (
          <div className="text-center text-white/30 text-sm py-6">
            Something went wrong loading this section.
          </div>
        )
      )
    }
    return this.props.children
  }
}
