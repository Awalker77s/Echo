import { Navigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'

export function ProtectedRoute({ children }: { children: JSX.Element }) {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/auth" replace />
  return children
}
