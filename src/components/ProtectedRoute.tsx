import type { PropsWithChildren } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { isAuthed, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 rounded-full bg-[#dbd4ff]" style={{ animation: 'breathe 1.8s ease-in-out infinite' }} />
      </div>
    )
  }

  if (!isAuthed) return <Navigate to="/login" replace />
  return <>{children}</>
}
