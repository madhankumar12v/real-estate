import { Link, NavLink } from 'react-router-dom'
import { Home, PlusCircle, LayoutDashboard, LogIn, LogOut } from 'lucide-react'
export default function Header({user, profile, onSignOut}) {
  return <header className="topbar"><Link className="brand" to="/"><span className="brandmark"><Home size={21}/></span><span>TN <b>PROPERTY HUB</b><small>BUY • SELL • DISCOVER</small></span></Link>
    <nav><NavLink to="/properties">Properties</NavLink>{user && <NavLink to="/post"><PlusCircle size={16}/> Post property</NavLink>}{user && <NavLink to={profile?.role==='admin'?'/admin':'/dashboard'}><LayoutDashboard size={16}/> Dashboard</NavLink>}</nav>
    <div className="nav-actions">{user ? <><span className="userlabel">{user.email}</span><button className="btn btn-ghost" onClick={onSignOut}><LogOut size={16}/> Logout</button></> : <Link className="btn btn-primary" to="/login"><LogIn size={16}/> Login / Register</Link>}</div>
  </header>
}