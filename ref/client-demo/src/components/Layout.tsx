import { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

const navItems = [
  { path: '/dashboard', label: '首页', icon: '📊' },
  { path: '/learn', label: '学习', icon: '📖' },
  { path: '/progress', label: '统计', icon: '📈' },
  { path: '/settings', label: '设置', icon: '⚙️' },
  { path: '/admin', label: '管理', icon: '🔧' },
]

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Top bar - hidden on mobile with bottom nav */}
      <header className="hidden md:flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="text-2xl">📖</span>
          <h1 className="text-lg font-bold text-gray-800">CET-4 背单词</h1>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">金宇涛</span>
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
            J
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar - PC */}
        <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 p-4">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const active = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="max-w-4xl mx-auto px-4 py-6">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom tab bar - mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex justify-around">
          {navItems.map((item) => {
            const active = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center py-2 px-3 text-xs ${
                  active ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
