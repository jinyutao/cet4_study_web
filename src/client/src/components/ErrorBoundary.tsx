import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center max-w-md mx-auto mt-12">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-lg font-bold text-red-500 mb-2">出错了</h2>
          <p className="text-sm text-gray-500 mb-6">
            {this.state.error?.message || '页面发生了意外错误'}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
          >
            重试
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
