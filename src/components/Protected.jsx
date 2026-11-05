import { Navigate } from 'react-router-dom'

export default function Protected({ user, children, admin = false, staff = false, profile }) {
  if (!user) return <Navigate to="/login" replace />
  if (admin && profile?.role !== 'admin') return <Navigate to="/dashboard" replace />
  if (staff && !['admin', 'agent'].includes(profile?.role)) return <Navigate to="/dashboard" replace />
  return children
}
