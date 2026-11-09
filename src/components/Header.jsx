import { Link, NavLink } from 'react-router-dom'
import { PlusCircle, LayoutDashboard, LogIn, LogOut, Menu, Heart, Users, ClipboardList, Handshake, Banknote, House, Building2, Briefcase } from 'lucide-react'
import { useState } from 'react'
export default function Header({user, profile, onSignOut}) {
 const [open,setOpen]=useState(false)
 return <><header className="topbar"><Link className="brand" to="/" onClick={()=>setOpen(false)}><img className="brand-logo" src="/mrsa-logo.png" alt="MrSa Properties" /><span className="brand-copy"><b>MrSa Properties</b><small>BUY • SELL • DISCOVER</small></span></Link>
 <button className="mobile-menu" type="button" aria-label="Toggle navigation" aria-expanded={open} aria-controls="site-navigation" onClick={()=>setOpen(!open)}><Menu size={21}/></button>
 <nav id="site-navigation" className={open?'nav-open':''}><NavLink to="/properties" onClick={()=>setOpen(false)}>Properties</NavLink><NavLink to="/saved" onClick={()=>setOpen(false)}><Heart size={15}/> Saved</NavLink><NavLink to="/loan-assistance" onClick={()=>setOpen(false)}>Loan Assistance</NavLink><NavLink to="/careers" onClick={()=>setOpen(false)}>Careers</NavLink>{user&&<NavLink to="/post" onClick={()=>setOpen(false)}><PlusCircle size={16}/> Post property</NavLink>}{user&&<NavLink to={profile?.role==='admin'?'/admin':profile?.role==='partner'?'/partners':'/dashboard'} onClick={()=>setOpen(false)}><LayoutDashboard size={16}/> Dashboard</NavLink>}{user&&['admin','agent'].includes(profile?.role)&&<NavLink to='/crm' onClick={()=>setOpen(false)}><Users size={16}/> Enquiries</NavLink>}{user&&profile?.role==='admin'&&<NavLink to='/admin/loan-enquiries' onClick={()=>setOpen(false)}><Banknote size={16}/> Loan leads</NavLink>}{user&&profile?.role==='admin'&&<NavLink to='/activity' onClick={()=>setOpen(false)}><ClipboardList size={16}/> Activity</NavLink>}{user&&['admin','partner'].includes(profile?.role)&&<NavLink to='/partners' onClick={()=>setOpen(false)}><Handshake size={16}/> Channel Partners</NavLink>}</nav>
 <div className="nav-actions">{user?<><span className="userlabel">{user.email}</span><button className="btn btn-ghost" onClick={onSignOut}><LogOut size={16}/> Logout</button></>:<Link className="btn btn-primary" to="/login"><LogIn size={16}/> Login / Register</Link>}</div>
 </header>
 <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
  <NavLink to="/" end><House size={19}/><span>Home</span></NavLink>
  <NavLink to="/properties"><Building2 size={19}/><span>Properties</span></NavLink>
  <NavLink to="/careers"><Briefcase size={19}/><span>Career</span></NavLink>
  <NavLink to="/saved"><Heart size={19}/><span>Saved</span></NavLink>
  <button className={open ? 'more-active' : ''} type="button" aria-label="More navigation options" aria-expanded={open} aria-controls="site-navigation" onClick={()=>setOpen(!open)}><Menu size={19}/><span>More</span></button>
 </nav></>
}
