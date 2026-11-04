import { Navigate } from 'react-router-dom'
export default function Protected({user, children, admin=false, profile}) {
  if (!user) return <Navigate to="/login" replace/>
  if (admin && profile?.role !== 'admin') return <Navigate to="/dashboard" replace/>
  return children
}