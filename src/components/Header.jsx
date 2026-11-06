import { Link, NavLink } from 'react-router-dom'
import { PlusCircle, LayoutDashboard, LogIn, LogOut, Menu, Heart, Users, ClipboardList, Handshake } from 'lucide-react'
import { useState } from 'react'

export default function Header({ user, profile, onSignOut }) {
  const [open, setOpen] = useState(false)
  const role = String(profile?.role || '').trim().toLowerCase()
  const canManagePartners = Boolean(user) && ['admin', 'partner'].includes(role)

  return <header className="topbar">
    <Link className="brand" to="/" onClick={() => setOpen(false)}>
      <img className="brand-logo" src="/mrsa-logo.svg" alt="MrSa Properties"/>
      <span className="brand-copy"><b>MrSa Properties</b><small>BUY • SELL • DISCOVER</small></span>
    </Link>
    <button className="mobile-menu" aria-label="Toggle navigation" onClick={() => setOpen(!open)}><Menu size={21}/></button>
    <nav className={open ? 'nav-open' : ''}>
      <NavLink to="/properties" onClick={() => setOpen(false)}>Properties</NavLink>
      <NavLink to="/saved" onClick={() => setOpen(false)}><Heart size={15}/> Saved</NavLink>
      <a href="/#why-mrsa" onClick={() => setOpen(false)}>Why MrSa</a>
      <a href="/#faq" onClick={() => setOpen(false)}>FAQ</a>
      <a href="/#contact" onClick={() => setOpen(false)}>Contact</a>
      {user && <NavLink to="/post" onClick={() => setOpen(false)}><PlusCircle size={16}/> Post property</NavLink>}
      {user && <NavLink to={role === 'admin' ? '/admin' : role === 'partner' ? '/partners' : '/dashboard'} onClick={() => setOpen(false)}><LayoutDashboard size={16}/> Dashboard</NavLink>}
      {user && ['admin', 'agent'].includes(role) && <NavLink to="/crm" onClick={() => setOpen(false)}><Users size={16}/> Enquiries</NavLink>}
      {user && role === 'admin' && <NavLink to="/activity" onClick={() => setOpen(false)}><ClipboardList size={16}/> Activity</NavLink>}
    </nav>
    <div className="nav-actions">
      {canManagePartners && <Link className="btn btn-primary channel-partners-link" to="/partners" onClick={() => setOpen(false)}><Handshake size={16}/> Channel Partners</Link>}
      {user ? <><span className="userlabel">{user.email}</span><button className="btn btn-ghost" onClick={onSignOut}><LogOut size={16}/> Logout</button></> : <Link className="btn btn-primary" to="/login"><LogIn size={16}/> Login / Register</Link>}
    </div>
  </header>
}
