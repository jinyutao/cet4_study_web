import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import type { AdminUserListResponse, AdminActionResponse } from '../types/api'
import type { AdminUserItem, PaginationMeta } from '../types/models'

type FilterValue = 'all' | 'admin' | 'frozen' | 'active'

const INITIAL_PAGINATION: PaginationMeta = { page: 1, pageSize: 20, total: 0, totalPages: 0 }

const FILTER_TABS: { key: FilterValue; label: string; count: number }[] = [
  { key: 'all', label: '全部', count: 0 },
  { key: 'admin', label: '管理员', count: 0 },
  { key: 'frozen', label: '已冻结', count: 0 },
  { key: 'active', label: '活跃', count: 0 },
]

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUserItem[]>([])
  const [pagination, setPagination] = useState<PaginationMeta>(INITIAL_PAGINATION)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterValue>('all')
  const [sortBy] = useState('created_at')
  const [sortOrder] = useState('desc')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<AdminUserListResponse>('/admin/users', {
        page,
        pageSize: 20,
        search: search || undefined,
        filter,
        sortBy,
        sortOrder,
      })
      setUsers(data.users)
      setPagination(data.pagination)
    } catch (err) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : '加载用户列表失败'
      setError(msg)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [page, search, filter, sortBy, sortOrder])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleResetPassword = async (user: AdminUserItem) => {
    if (!window.confirm(`确认重置用户 "${user.username}" 的密码？`)) return
    setActionLoading(user.id)
    try {
      const res = await api.put<AdminActionResponse>(`/admin/users/${user.id}/reset-password`)
      alert(`用户 "${res.username}" 密码已重置为: ${res.newPassword}`)
    } catch (err) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : '重置密码失败'
      alert(msg)
    } finally {
      setActionLoading(null)
    }
  }

  const handleFreeze = async (user: AdminUserItem) => {
    const action = user.isFrozen ? '解冻' : '冻结'
    if (!window.confirm(`确认${action}用户 "${user.username}"？${user.isFrozen ? '' : '\n冻结后用户将无法登录'}`)) return
    setActionLoading(user.id)
    try {
      await api.put<AdminActionResponse>(`/admin/users/${user.id}/freeze`, { isFrozen: !user.isFrozen })
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isFrozen: !u.isFrozen } : u)))
    } catch (err) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : '操作失败'
      alert(msg)
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleAdmin = async (user: AdminUserItem) => {
    const action = user.isAdmin ? '取消' : '设置为'
    if (!window.confirm(`确认${action}管理员权限给 "${user.username}"？`)) return
    setActionLoading(user.id)
    try {
      await api.put<AdminActionResponse>(`/admin/users/${user.id}/set-admin`, { isAdmin: !user.isAdmin })
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isAdmin: !u.isAdmin } : u)))
    } catch (err) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : '操作失败'
      alert(msg)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (user: AdminUserItem) => {
    if (!window.confirm(`确认永久删除用户 "${user.username}"？\n该用户的所有学习数据将一并清除，此操作不可恢复。`)) return
    setActionLoading(user.id)
    try {
      await api.delete<AdminActionResponse>(`/admin/users/${user.id}`)
      setUsers((prev) => prev.filter((u) => u.id !== user.id))
    } catch (err) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : '删除失败'
      alert(msg)
    } finally {
      setActionLoading(null)
    }
  }

  const isBusy = (userId: number) => actionLoading === userId

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h2 className="text-xl font-bold text-gray-800">用户管理</h2>
        <p className="text-sm text-gray-500 mt-0.5">管理系统用户与权限</p>
      </header>

      <div className="relative">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="搜索用户名..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 transition-colors"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
      </div>

      <div className="flex gap-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setFilter(tab.key)
              setPage(1)
            }}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              filter === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && !loading && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-600">
          {error}
          <button
            onClick={fetchUsers}
            className="ml-3 underline hover:no-underline"
          >
            重试
          </button>
        </div>
      )}

      {loading && (
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && users.length === 0 && (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
          <p className="text-gray-400">未找到匹配的用户</p>
        </div>
      )}

      {!loading && !error && users.length > 0 && (
        <>
          <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">用户名</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600 whitespace-nowrap">角色</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600 whitespace-nowrap">状态</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap hidden lg:table-cell">注册时间</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap hidden lg:table-cell">最后活跃</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600 whitespace-nowrap hidden xl:table-cell">轮次</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600 whitespace-nowrap hidden xl:table-cell">掌握</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{user.username}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {user.isAdmin ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">管理员</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">用户</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {user.isFrozen ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">已冻结</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">正常</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap hidden lg:table-cell">{formatDate(user.createdAt)}</td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap hidden lg:table-cell">{formatDate(user.lastActiveAt)}</td>
                      <td className="px-4 py-3 text-center text-gray-500 whitespace-nowrap hidden xl:table-cell">{user.currentRound}</td>
                      <td className="px-4 py-3 text-center text-gray-500 whitespace-nowrap hidden xl:table-cell">{user.masteredCount}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleResetPassword(user)}
                            disabled={isBusy(user.id)}
                            className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg transition-colors"
                          >
                            重置密码
                          </button>
                          <button
                            onClick={() => handleFreeze(user)}
                            disabled={isBusy(user.id)}
                            className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                              user.isFrozen
                                ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                                : 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                            }`}
                          >
                            {user.isFrozen ? '解冻' : '冻结'}
                          </button>
                          <button
                            onClick={() => handleToggleAdmin(user)}
                            disabled={isBusy(user.id)}
                            className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                              user.isAdmin
                                ? 'text-orange-600 bg-orange-50 hover:bg-orange-100'
                                : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                            }`}
                          >
                            {user.isAdmin ? '取消管理' : '管理员'}
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            disabled={isBusy(user.id)}
                            className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 rounded-lg transition-colors"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="md:hidden space-y-3">
            {users.map((user) => (
              <div key={user.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-800">{user.username}</span>
                  <div className="flex items-center gap-2">
                    {user.isAdmin && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">管理员</span>
                    )}
                    {user.isFrozen ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">已冻结</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">正常</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3 text-xs text-gray-400">
                  <div>注册: {formatDate(user.createdAt)}</div>
                  <div>活跃: {formatDate(user.lastActiveAt)}</div>
                  <div>轮次: {user.currentRound}</div>
                  <div>掌握: {user.masteredCount} 词</div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => handleResetPassword(user)}
                    disabled={isBusy(user.id)}
                    className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    重置密码
                  </button>
                  <button
                    onClick={() => handleFreeze(user)}
                    disabled={isBusy(user.id)}
                    className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                      user.isFrozen
                        ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                        : 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                    }`}
                  >
                    {user.isFrozen ? '解冻' : '冻结'}
                  </button>
                  <button
                    onClick={() => handleToggleAdmin(user)}
                    disabled={isBusy(user.id)}
                    className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                      user.isAdmin
                        ? 'text-orange-600 bg-orange-50 hover:bg-orange-100'
                        : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                    }`}
                  >
                    {user.isAdmin ? '取消管理' : '管理员'}
                  </button>
                  <button
                    onClick={() => handleDelete(user)}
                    disabled={isBusy(user.id)}
                    className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 rounded-lg transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 pb-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← 上一页
            </button>
            <span className="text-sm text-gray-500">
              第 {pagination.page} 页，共 {pagination.totalPages} 页（{pagination.total} 人）
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages || loading}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              下一页 →
            </button>
          </div>
        </>
      )}
    </div>
  )
}
