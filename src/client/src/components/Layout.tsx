import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { path: '/dashboard', label: '学习概览', icon: '📊' },
  { path: '/learn', label: '学习闯关', icon: '📖' },
  { path: '/progress', label: '学习进度', icon: '📈' },
  { path: '/settings', label: '设置', icon: '⚙️' },
  { path: '/admin', label: '用户管理', icon: '👥' },
]

function NavLink({
  item,
  active,
}: {
  item: (typeof navItems)[number]
  active: boolean
}) {
  return (
    <Link
      to={item.path}
      className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors border-l-2 ${
        active
          ? 'bg-blue-50 text-blue-700 border-blue-600'
          : 'text-gray-600 hover:bg-gray-100 border-transparent'
      }`}
    >
      <span>{item.icon}</span>
      {item.label}
    </Link>
  )
}

function MobileTab({
  item,
  active,
}: {
  item: (typeof navItems)[number]
  active: boolean
}) {
  return (
    <Link
      to={item.path}
      className={`flex flex-col items-center py-2 px-3 text-xs ${
        active ? 'text-blue-600' : 'text-gray-400'
      }`}
    >
      <span className="text-xl">{item.icon}</span>
      {item.label}
    </Link>
  )
}

export default function Layout() {
  const location = useLocation()
  const { user, logout } = useAuth()

  const visibleItems = navItems.filter(
    (item) => item.path !== '/admin' || user?.isAdmin
  )

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="hidden md:flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shrink-0">
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="text-2xl">📖</span>
          <h1 className="text-lg font-bold text-gray-800">CET-4背单词</h1>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {user?.username || '用户'}
          </span>
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
            {user?.username?.charAt(0).toUpperCase() || '?'}
          </div>
          <button
            onClick={logout}
            className="text-sm text-gray-400 hover:text-red-500 transition-colors"
            title="登出"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 shrink-0">
          <nav className="flex flex-col gap-1 pt-4">
            {visibleItems.map((item) => (
              <NavLink
                key={item.path}
                item={item}
                active={location.pathname === item.path}
              />
            ))}
          </nav>
          <div className="mt-auto px-4 pb-4">
            <button
              onClick={logout}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              退出登录
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-auto pb-20 md:pb-6">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <Outlet />
          </div>
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex justify-around">
          {visibleItems.map((item) => (
            <MobileTab
              key={item.path}
              item={item}
              active={location.pathname === item.path}
            />
          ))}
        </div>
      </nav>
    </div>
  )
}
