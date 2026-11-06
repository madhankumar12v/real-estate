import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, RefreshCw, ShieldCheck, Clock3, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function PartnersPage({ user, profile }) {
  const [partners, setPartners] = useState([])
  const [listings, setListings] = useState([])
  const [busy, setBusy] = useState(true)
  const [message, setMessage] = useState('')
  const admin = profile?.role === 'admin'
  const load = async () => {
    setBusy(true)
    setMessage('')
    const [partnerResult, listingResult] = await Promise.all([
      supabase.from('partners').select('id,name,slug,is_active,created_at').order('name'),
      (() => {
        let q = supabase.from('listings')
          .select('id,title,city,district,status,created_at,partner_id,partners(name)')
          .order('created_at', { ascending: false }).limit(300)
        if (!admin) q = q.eq('user_id', user.id)
        return q
      })()
    ])
    if (partnerResult.error || listingResult.error) {
      setMessage(partnerResult.error?.message || listingResult.error?.message || 'Unable to load partner records.')
    }
    setPartners(partnerResult.data || [])
    setListings(listingResult.data || [])
    setBusy(false)
  }
  useEffect(() => { load() }, [user?.id, admin])
  const togglePartner = async partner => {
    const { error } = await supabase.from('partners')
      .update({ is_active: !partner.is_active, updated_at: new Date().toISOString() })
      .eq('id', partner.id)
    setMessage(error?.message || (partner.is_active ? 'Partner deactivated.' : 'Partner activated.'))
    if (!error) load()
  }
  const counts = {
    total: listings.length,
    pending: listings.filter(item => item.status === 'pending').length,
    approved: listings.filter(item => item.status === 'approved').length,
    rejected: listings.filter(item => item.status === 'rejected').length
  }
  return <section className="section page-section partners-page">
    <div className="section-heading">
      <div><span className="eyebrow">MRSA PROPERTIES · CHANNEL PARTNERS</span><h1>{admin ? 'Channel Partner Management' : 'Channel Partner Portal'}</h1>
        <p className="muted">{admin ? 'Manage the channel partner directory and review partner-submitted properties.' : 'Submit properties under the correct partner name and track approval status.'}</p></div>
      <button className="btn btn-outline" onClick={load} disabled={busy}><RefreshCw size={15}/> Refresh</button>
    </div>
    {message && <p className="notice" role="status">{message}</p>}
    <div className="admin-stats">
      <div><b>{partners.length}</b><span>Channel partners</span></div>
      <div><b>{counts.total}</b><span>Submissions visible</span></div>
      <div><b>{counts.pending}</b><span>Awaiting approval</span></div>
      <div><b>{counts.approved}</b><span>Approved listings</span></div>
    </div>
    <div className="section-heading"><div><h2>Channel Partner Directory</h2><p className="muted">The shared Channel Partner account selects a partner name when submitting each property.</p></div></div>
    {busy ? <p className="muted">Loading partner records…</p> : <div className="partner-directory">
      {partners.map(partner => <article className="partner-card" key={partner.id}>
        <div className="partner-card-icon"><Building2 size={19}/></div>
        <div className="partner-card-copy"><b>{partner.name}</b><small>{listings.filter(item => item.partner_id === partner.id).length} submitted properties</small></div>
        <span className={partner.is_active ? 'status status-approved' : 'status status-rejected'}>{partner.is_active ? 'Active' : 'Inactive'}</span>
        {admin && <button className="btn btn-outline" onClick={() => togglePartner(partner)}>{partner.is_active ? 'Deactivate' : 'Activate'}</button>}
      </article>)}
    </div>}
    <div className="section-heading partner-submission-heading"><div><h2>Channel Partner Listings</h2><p className="muted">All new submissions remain pending until MrSa Admin approval.</p></div>
      {!admin && <Link className="btn btn-primary" to="/post"><Building2 size={16}/> Submit property</Link>}
    </div>
    {!busy && <div className="dashboard-list">
      {listings.map(item => <article className="dashboard-row partner-listing-row" key={item.id}>
        <div className="row-grow"><b>{item.title}</b><p className="muted">{item.city}, {item.district} · {item.partners?.name || 'No channel partner attribution'}</p></div>
        <span className={`status status-${item.status}`}>{item.status}</span>
        {admin && item.status === 'pending' && <span className="tiny"><Clock3 size={13}/> Awaiting review</span>}
      </article>)}
      {!listings.length && <div className="empty"><Building2 size={28}/><h3>No partner properties yet</h3><p>Submitted properties will appear here.</p></div>}
    </div>}
    {admin && <p className="tiny partner-admin-note"><ShieldCheck size={14}/> Approve or reject submissions from the <Link to="/admin">Admin dashboard</Link>.</p>}
    {!admin && <p className="tiny partner-admin-note"><ShieldCheck size={14}/> Shared-login notice: everyone using this single Channel Partner account can view its submitted properties. Selecting a partner name records attribution; it does not verify an individual user's identity.</p>}
  </section>
}
