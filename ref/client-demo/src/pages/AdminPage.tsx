import { useState } from 'react'

interface User {
  id: number
  username: string
  email: string
  is_admin: boolean
  frozen: boolean
  created_at: string
}

const mockUsers: User[] = [
  { id: 1, username: 'admin', email: 'admin@example.com', is_admin: true, frozen: false, created_at: '2025-01-15' },
  { id: 2, username: 'zhangsan', email: 'zhangsan@example.com', is_admin: false, frozen: false, created_at: '2025-02-20' },
  { id: 3, username: 'lisi', email: 'lisi@example.com', is_admin: false, frozen: true, created_at: '2025-03-10' },
  { id: 4, username: 'wangwu', email: 'wangwu@example.com', is_admin: false, frozen: false, created_at: '2025-03-22' },
  { id: 5, username: 'zhaoliu', email: 'zhaoliu@example.com', is_admin: false, frozen: false, created_at: '2025-04-01' },
]

export default function AdminPage() {
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<User[]>(mockUsers)

  const filtered = users.filter(
    (u) =>
      u.username.includes(search.toLowerCase()) ||
      u.email.includes(search.toLowerCase())
  )

  const handleResetPassword = (user: User) => {
    const ok = window.confirm(`确认重置用户 "${user.username}" 的密码？`)
    if (ok) {
      alert(`已为用户 "${user.username}" 重置密码为默认值`)
    }
  }

  const handleFreeze = (user: User) => {
    const action = user.frozen ? '解冻' : '冻结'
    const ok = window.confirm(`确认${action}用户 "${user.username}"？${user.frozen ? '' : '冻结后用户将无法登录'}`)
    if (ok) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, frozen: !u.frozen } : u
        )
      )
    }
  }

  const handleDelete = (user: User) => {
    const ok = window.confirm(`确认永久删除用户 "${user.username}"？\n该用户的所有学习数据将一并清除，此操作不可恢复。`)
    if (ok) {
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
    }
  }

  const handleToggleAdmin = (user: User) => {
    const action = user.is_admin ? '取消' : '设置为'
    const ok = window.confirm(`确认${action}管理员权限给 "${user.username}"？`)
    if (ok) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, is_admin: !u.is_admin } : u
        )
      )
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <header>
        <h2 className="text-xl font-bold text-gray-800">用户管理</h2>
        <p className="text-sm text-gray-500 mt-0.5">管理系统用户与权限</p>
      </header>

      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索用户名或邮箱..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-colors"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
          🔍
        </span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                  用户名
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap hidden sm:table-cell">
                  邮箱
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                  管理员
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                  状态
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap hidden md:table-cell">
                  注册时间
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-gray-400"
                  >
                    未找到匹配的用户
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                      {user.username}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap hidden sm:table-cell">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {user.is_admin ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          是
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          否
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {user.frozen ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                          已冻结
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600">
                          正常
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap hidden md:table-cell">
                      {user.created_at}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <button
                          onClick={() => handleResetPassword(user)}
                          className="px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          重置密码
                        </button>
                        <button
                          onClick={() => handleFreeze(user)}
                          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            user.frozen
                              ? 'text-green-600 bg-green-50 hover:bg-green-100'
                              : 'text-orange-600 bg-orange-50 hover:bg-orange-100'
                          }`}
                        >
                          {user.frozen ? '解冻' : '冻结'}
                        </button>
                        <button
                          onClick={() => handleToggleAdmin(user)}
                          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            user.is_admin
                              ? 'text-orange-600 bg-orange-50 hover:bg-orange-100'
                              : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                          }`}
                        >
                          {user.is_admin ? '取消管理' : '设置管理'}
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
