import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowUpRight, Copy, ExternalLink, Megaphone, MessageCircle, RefreshCw, Target, Users, Eye, Wallet, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'

const number = value => new Intl.NumberFormat('en-IN').format(Number(value) || 0)
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0)
const platforms = [
  { label: 'Facebook', source: 'facebook', medium: 'social' },
  { label: 'Instagram', source: 'instagram', medium: 'social' },
  { label: 'YouTube', source: 'youtube', medium: 'video' },
  { label: 'LinkedIn', source: 'linkedin', medium: 'social' },
  { label: 'WhatsApp', source: 'whatsapp', medium: 'messaging' },
  { label: 'Google Search', source: 'google', medium: 'search' },
  { label: 'Other website', source: 'referral', medium: 'referral' }
]
const slug = value => String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 100)

function Metric({ icon: Icon, label, value, note }) {
  return <article style={{ background: '#fff', border: '1px solid #e6ebe8', borderRadius: 16, padding: 18, minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#587568', fontSize: 13 }}><Icon size={17}/>{label}</div>
    <strong style={{ display: 'block', fontSize: 28, color: '#173e31', marginTop: 9 }}>{number(value)}</strong>
    <small style={{ color: '#74827b' }}>{note}</small>
  </article>
}

export default function MarketingPage() {
  const [stats, setStats] = useState({})
  const [leads, setLeads] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [busy, setBusy] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [updatedAt, setUpdatedAt] = useState(null)
  const [form, setForm] = useState({ name: '', platform: 'Facebook', path: '/', budget: '0', spent: '0' })

  const platform = platforms.find(item => item.label === form.platform) || platforms[0]
  const campaignTag = slug(form.name)
  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    const url = new URL(form.path.startsWith('/') ? form.path : '/' + form.path, window.location.origin)
    url.searchParams.set('utm_source', platform.source)
    url.searchParams.set('utm_medium', platform.medium)
    url.searchParams.set('utm_campaign', campaignTag || 'mrsa_property_promotion')
    return url.toString()
  }, [form.path, form.platform, form.name, platform.source, platform.medium, campaignTag])

  const load = async () => {
    setBusy(true)
    setError('')
    try {
      const since = new Date()
      since.setDate(since.getDate() - 29)
      since.setHours(0, 0, 0, 0)
      const from = since.toISOString()
      const [visitorResult, leadResult, campaignResult] = await Promise.all([
        supabase.rpc('get_admin_website_visitor_stats', { p_from: from, p_to: null }),
        supabase.from('enquiries').select('id,created_at,status,source,marketing_source,utm_source,utm_medium,utm_campaign').gte('created_at', from).order('created_at', { ascending: false }).limit(1000),
        supabase.from('marketing_campaigns').select('id,campaign_name,platform,utm_source,utm_medium,utm_campaign,landing_path,budget,spent,status,created_at').order('created_at', { ascending: false }).limit(100)
      ])
      if (visitorResult.error) throw visitorResult.error
      if (leadResult.error) throw leadResult.error
      if (campaignResult.error) throw campaignResult.error
      setStats(visitorResult.data || {})
      setLeads(leadResult.data || [])
      setCampaigns(campaignResult.data || [])
      setUpdatedAt(new Date())
    } catch (err) {
      setError(err?.message || 'Unable to load marketing data. Check that the visitor analytics and marketing SQL scripts have been run.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { load() }, [])

  const sourceRows = stats.sources || []
  const campaignViews = stats.campaigns || []
  const whatsappClicks = Number(stats.summary?.period_whatsapp_clicks || 0)
  const attributedLeads = leads.filter(row => row.utm_source || row.utm_campaign).length
  const activeCampaigns = campaigns.filter(row => row.status === 'active').length
  const totalSpend = campaigns.reduce((sum, row) => sum + Number(row.spent || 0), 0)
  const costPerLead = attributedLeads ? totalSpend / attributedLeads : 0
  const leadSources = Object.entries(leads.reduce((acc, row) => {
    const key = row.utm_source || row.marketing_source || row.source || 'Unattributed'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})).sort((a, b) => b[1] - a[1])

  const createCampaign = async event => {
    event.preventDefault()
    if (!form.name.trim() || !campaignTag) return
    setSaving(true)
    setNotice('')
    try {
      const { error: insertError } = await supabase.from('marketing_campaigns').insert({
        campaign_name: form.name.trim(),
        platform: form.platform,
        utm_source: platform.source,
        utm_medium: platform.medium,
        utm_campaign: campaignTag,
        landing_path: form.path.startsWith('/') ? form.path : '/' + form.path,
        budget: Number(form.budget) || 0,
        spent: Number(form.spent) || 0,
        status: 'active'
      })
      if (insertError) throw insertError
      setNotice('Campaign saved. Copy its tagged link and use it in your post or advertisement.')
      await load()
    } catch (err) {
      setNotice('Could not save campaign: ' + (err?.message || 'Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  const updateSpend = async (campaign, value) => {
    const amount = Math.max(0, Number(value) || 0)
    const { error: updateError } = await supabase.from('marketing_campaigns').update({ spent: amount }).eq('id', campaign.id)
    if (updateError) setNotice('Could not update campaign spend: ' + updateError.message)
    else { setNotice('Campaign spend updated.'); await load() }
  }

  const copyLink = async value => {
    try { await navigator.clipboard.writeText(value); setNotice('Campaign link copied. You can now share it.') }
    catch { setNotice('Copy was blocked by your browser. Select and copy the link manually.') }
  }

  return <section className="section page-section" style={{ maxWidth: 1180, margin: '0 auto' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
      <div><span className="eyebrow">MRSA PROPERTIES · ADMIN</span><h1 style={{ marginBottom: 6 }}>Marketing &amp; Growth</h1><p className="muted">Measure where visitors come from, which campaigns create enquiries and what your marketing costs.</p></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn btn-outline" onClick={load} disabled={busy}><RefreshCw size={15}/> Refresh</button><Link className="btn btn-outline" to="/admin/website-visitors"><Eye size={15}/> Website visitors</Link><Link className="btn btn-outline" to="/crm"><Users size={15}/> CRM leads</Link></div>
    </div>

    {error && <div className="analytics-error" role="alert"><span>{error}</span><button className="btn btn-outline" onClick={load}>Try again</button></div>}
    {notice && <p className="notice" role="status">{notice}</p>}
    {busy ? <div className="analytics-loading">Loading marketing performance…</div> : !error && <>
      <p className="muted" style={{ fontSize: 13 }}>Last 30 days · Updated {updatedAt?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(175px,1fr))', gap: 12, margin: '18px 0 28px' }}>
        <Metric icon={Users} label="Unique visitors" value={stats.summary?.period_visitors} note="Website reach"/>
        <Metric icon={Eye} label="Page views" value={stats.summary?.period_page_views} note="Pages viewed"/>
        <Metric icon={MessageCircle} label="WhatsApp clicks" value={whatsappClicks} note="Enquiry intent"/>
        <Metric icon={Target} label="Actual enquiries" value={leads.length} note="CRM enquiries received"/>
        <Metric icon={Activity} label="Campaign-attributed leads" value={attributedLeads} note="UTM-tagged enquiries"/>
        <Metric icon={Wallet} label="Recorded spend" value={money(totalSpend)} note={'Cost per attributed lead: ' + money(costPerLead)}/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, marginBottom: 24 }}>
        <article className="visitor-panel"><h2>Traffic sources</h2>{sourceRows.length ? sourceRows.map(row => <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #edf1ee' }}><span>{row.label}</span><b>{number(row.views)}</b></div>) : <p className="muted">No traffic data yet.</p>}</article>
        <article className="visitor-panel"><h2>Campaign visits</h2>{campaignViews.length ? campaignViews.map(row => <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #edf1ee' }}><span>{row.label}</span><b>{number(row.views)}</b></div>) : <p className="muted">Create tagged campaign links to measure traffic.</p>}</article>
        <article className="visitor-panel"><h2>Enquiries by source</h2>{leadSources.length ? leadSources.map(([label, value]) => <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #edf1ee' }}><span>{label}</span><b>{number(value)}</b></div>) : <p className="muted">No enquiries in this period.</p>}</article>
      </div>

      <article className="visitor-panel" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}><div><h2>Campaign link generator</h2><p className="muted">Create trackable links for social posts, videos and WhatsApp sharing.</p></div><span className="eyebrow">{activeCampaigns} active campaigns</span></div>
        <form onSubmit={createCampaign} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12, marginTop: 16 }}>
          <label>Campaign name<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Example: Vellore plot promotion"/></label>
          <label>Platform<select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}>{platforms.map(item => <option key={item.label}>{item.label}</option>)}</select></label>
          <label>Landing page path<input value={form.path} onChange={e => setForm({ ...form, path: e.target.value })} placeholder="/properties"/></label>
          <label>Campaign budget (₹)<input type="number" min="0" step="1" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })}/></label>
          <label>Amount spent (₹)<input type="number" min="0" step="1" value={form.spent} onChange={e => setForm({ ...form, spent: e.target.value })}/></label>
          <div style={{ display: 'flex', alignItems: 'end' }}><button className="btn btn-primary" disabled={saving}><Plus size={16}/>{saving ? 'Saving…' : 'Save campaign'}</button></div>
        </form>
        <label style={{ display: 'block', marginTop: 14 }}>Generated tracking link<input readOnly value={shareUrl}/></label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}><button type="button" className="btn btn-primary" onClick={() => copyLink(shareUrl)}><Copy size={15}/> Copy link</button><a className="btn btn-outline" href={shareUrl} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Test link</a></div>
      </article>

      <article className="visitor-panel">
        <h2>Saved campaigns &amp; spend</h2>
        {campaigns.length ? <div style={{ overflowX: 'auto' }}><table className="data-table"><thead><tr><th>Campaign</th><th>Platform</th><th>UTM campaign</th><th>Budget</th><th>Spent (₹)</th><th>Status</th></tr></thead><tbody>{campaigns.map(row => <tr key={row.id}><td>{row.campaign_name}</td><td>{row.platform}</td><td>{row.utm_campaign}</td><td>{money(row.budget)}</td><td><input aria-label={'Spend for ' + row.campaign_name} type="number" min="0" step="1" defaultValue={row.spent} onBlur={e => updateSpend(row, e.target.value)} style={{ width: 105 }}/></td><td>{row.status}</td></tr>)}</tbody></table></div> : <p className="muted">No campaigns saved yet. Create your first campaign above.</p>}
      </article>
    </>}
    <div className="analytics-footer"><span>Campaign tracking uses anonymous visitor IDs and UTM tags. It does not collect visitor IP addresses.</span><Link to="/admin">← Back to Admin dashboard</Link></div>
  </section>
}
