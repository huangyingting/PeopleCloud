import { Component, type ErrorInfo, type ReactNode } from 'react'

export class AppBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('PeopleCloud application boundary', error, info.componentStack)
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="fatal-screen">
          <span className="brand-seal">人</span>
          <h1>星图暂时无法展开</h1>
          <p>页面遇到未预期的问题。刷新通常可以恢复；人物数据不会因刷新而丢失。</p>
          <button type="button" onClick={() => window.location.reload()}>重新加载</button>
        </main>
      )
    }
    return this.props.children
  }
}
