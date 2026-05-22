import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { getToken, setToken, clearToken } from '../lib/auth'
import { api } from '../lib/api'
import type { User } from '../types/models'
import type { AuthResponse, MeResponse } from '../types/api'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
}

export interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [token, setTokenState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount: check localStorage for existing token and validate it
  useEffect(() => {
    const savedToken = getToken()
    if (!savedToken) {
      setIsLoading(false)
      return
    }

    setTokenState(savedToken)

    api.get<MeResponse>('/auth/me')
      .then((data) => {
        setUser({
          id: data.id,
          username: data.username,
          isAdmin: data.isAdmin,
          isFrozen: data.isFrozen,
          createdAt: data.createdAt,
        })
      })
      .catch(() => {
        // Token invalid or expired — clear it silently
        clearToken()
        setTokenState(null)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const data = await api.post<AuthResponse>('/auth/login', { username, password })
    setToken(data.token)
    setTokenState(data.token)
    setUser({
      id: data.user.id,
      username: data.user.username,
      isAdmin: data.user.isAdmin,
      isFrozen: data.user.isFrozen ?? false,
      createdAt: data.user.createdAt,
    })
    navigate('/dashboard')
  }, [navigate])

  const register = useCallback(async (username: string, password: string) => {
    const data = await api.post<AuthResponse>('/auth/register', { username, password })
    setToken(data.token)
    setTokenState(data.token)
    setUser({
      id: data.user.id,
      username: data.user.username,
      isAdmin: data.user.isAdmin,
      isFrozen: data.user.isFrozen ?? false,
      createdAt: data.user.createdAt,
    })
    navigate('/dashboard')
  }, [navigate])

  const logout = useCallback(() => {
    clearToken()
    setTokenState(null)
    setUser(null)
    navigate('/login')
  }, [navigate])

  const refreshUser = useCallback(async () => {
    const data = await api.get<MeResponse>('/auth/me')
    setUser({
      id: data.id,
      username: data.username,
      isAdmin: data.isAdmin,
      isFrozen: data.isFrozen,
      createdAt: data.createdAt,
    })
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}
