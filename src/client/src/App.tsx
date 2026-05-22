import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './hooks/useAuth'
import { SettingsProvider } from './context/SettingsContext'
import Layout from './components/Layout'
import GuestPage from './pages/GuestPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import LearnPage from './pages/LearnPage'
import ProgressPage from './pages/ProgressPage'
import SettingsPage from './pages/SettingsPage'
import AdminPage from './pages/AdminPage'
import LoadingSkeleton from './components/LoadingSkeleton'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <LoadingSkeleton type="card" count={3} />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function GuestGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <LoadingSkeleton type="card" count={3} />
  if (user) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingSkeleton type="card" count={3} />
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<GuestGuard><LoginPage /></GuestGuard>} />
        <Route path="/register" element={<GuestGuard><LoginPage /></GuestGuard>} />
        <Route path="*" element={<GuestGuard><GuestPage /></GuestGuard>} />
      </Routes>
    )
  }

  return (
    <SettingsProvider>
      <Routes>
        <Route element={<AuthGuard><Layout /></AuthGuard>}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/learn" element={<LearnPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {user.isAdmin && <Route path="/admin" element={<AdminPage />} />}
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SettingsProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
