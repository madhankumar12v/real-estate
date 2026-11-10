import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, CalendarDays, CheckCircle2, Copy, ExternalLink, Eye, MessageCircle, Plus, RefreshCw, Target, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'

const number = value => new Intl.NumberFormat('en-IN').format(Number(value) || 0)
const platforms = [
  { label: 'Facebook', source: 'facebook', medium: 'social' },
  { label: 'Instagram', source: 'instagram', medium: 'social' },
  { label: 'YouTube', source: 'youtube', medium: 'video' },
  { label: 'LinkedIn', source: 'linkedin', medium: 'social' },
  { label: 'WhatsApp', source: 'whatsapp', medium: 'messaging' },
  { label: 'Google Search', source: 'google', medium: 'organic' },
  { label: 'Other website', source: 'referral', medium: 'referral' }
]
const weeklyPlan = [
  { day: 'Monday', channel: 'WhatsApp Status + Facebook', task: 'Share one newly approved property with price, city/town and enquiry link.', caption: 'New property opportunity from MrSa Properties! Explore the details, photos and location on our website. Interested? Contact us on WhatsApp. #MrSaProperties #TamilNaduRealEstate' },
  { day: 'Tuesday', channel: 'Instagram Reel', task: 'Post a 20–30 second property photo/video walkthrough.', caption: 'Your next property opportunity could be here. Watch the walkthrough and visit our website for full details. DM or WhatsApp us to enquire. #MrSaProperties #PropertyForSale #TamilNadu' },
  { day: 'Wednesday', channel: 'WhatsApp Groups', task: 'Share an available plots update only in relevant groups that allow property posts.', caption: 'Plots available for sale! Check location, plot details and availability on MrSa Properties. Message us for more information. #PlotsForSale #TamilNaduPlots' },
  { day: 'Thursday', channel: 'YouTube Shorts', task: 'Publish a short location highlight or property walkthrough.', caption: 'Explore this property location with MrSa Properties. Watch, discover and enquire. Full details are available on our website. #YouTubeShorts #MrSaProperties' },
  { day: 'Friday', channel: 'Facebook Page', task: 'Publish a useful buyer tip or a featured property post.', caption: 'Property buying tip: Always verify title documents, approvals, access and site details before making a decision. Discover property opportunities with MrSa Properties. #PropertyTips #MrSaProperties' },
  { day: 'Saturday', channel: 'Instagram + Facebook', task: 'Share a carousel of property photos or a channel-partner listing.', caption: 'A closer look at this property opportunity. Save this post and visit MrSa Properties for the full listing and enquiry details. #PropertySearch #TamilNaduRealEstate' },
  { day: 'Sunday', channel: 'Website + CRM review', task: 'Review visitors, traffic sources, WhatsApp clicks, actual enquiries and follow-ups.', caption: 'Thank you for exploring MrSa Properties. Looking to buy property in Tamil Nadu? Browse our latest listings and send us your enquiry.' }
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
  const [form, setForm] = useState({ name: '', platform: 'Facebook', path: '/' })

  const platform = platforms.find(item => item.label === form.platform) || platforms[0]
  const campaignTag = slug(form.name)
  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    const url = new URL(form.path.startsWith('/') ? form.path : '/' + form.path, window.location.origin)
    url.searchParams.set('utm_source', platform.source)
    url.searchParams.set('utm_medium', platform.medium)
    url.searchParams.set('utm_campaign', campaignTag || 'mrsa_property_promotion')
    return url.toString()
  }, [form.path, platform.source, platform.medium, campaignTag])

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
        supabase.from('marketing_campaigns').select('id,campaign_name,platform,utm_source,utm_medium,utm_campaign,landing_path,status,created_at').order('created_at', { ascending: false }).limit(100)
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
        status: 'active'
      })
      if (insertError) throw insertError
      setNotice('Free campaign saved. Copy the tracking link and share it on your selected platform.')
      await load()
    } catch (err) {
      setNotice('Could not save campaign: ' + (err?.message || 'Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  const copyText = async (value, successMessage) => {
    try {
      await navigator.clipboard.writeText(value)
      setNotice(successMessage)
    } catch {
      setNotice('Copy was blocked by your browser. Please select and copy the text manually.')
    }
  }

  return <section className="section page-section" style={{ maxWidth: 1180, margin: '0 auto' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <span className="eyebrow">MRSA PROPERTIES · ADMIN</span>
        <h1 style={{ marginBottom: 6 }}>Free Marketing &amp; Growth</h1>
        <p className="muted">Grow organically through Google, social media, WhatsApp and channel partners — without paid advertisements.</p>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 30, padding: '7px 12px', background: '#eaf5ee', color: '#246343', fontSize: 13, fontWeight: 700 }}>₹0 paid-ad budget · Organic marketing only</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-outline" onClick={load} disabled={busy}><RefreshCw size={15}/> Refresh</button>
        <Link className="btn btn-outline" to="/admin/website-visitors"><Eye size={15}/> Website visitors</Link>
        <Link className="btn btn-outline" to="/crm"><Users size={15}/> CRM leads</Link>
      </div>
    </div>

    {error && <div className="analytics-error" role="alert"><span>{error}</span><button className="btn btn-outline" onClick={load}>Try again</button></div>}
    {notice && <p className="notice" role="status">{notice}</p>}
    {busy ? <div className="analytics-loading">Loading organic marketing performance…</div> : !error && <>
      <p className="muted" style={{ fontSize: 13 }}>Last 30 days · Updated {updatedAt?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(175px,1fr))', gap: 12, margin: '18px 0 28px' }}>
        <Metric icon={Users} label="Unique visitors" value={stats.summary?.period_visitors} note="Website reach"/>
        <Metric icon={Eye} label="Page views" value={stats.summary?.period_page_views} note="Pages viewed"/>
        <Metric icon={MessageCircle} label="WhatsApp clicks" value={whatsappClicks} note="Interest, not confirmed leads"/>
        <Metric icon={Target} label="Actual enquiries" value={leads.length} note="Enquiries received in CRM"/>
        <Metric icon={Activity} label="Attributed enquiries" value={attributedLeads} note="Enquiries with UTM campaign data"/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, marginBottom: 24 }}>
        <article className="visitor-panel"><h2>Organic traffic sources</h2>{sourceRows.length ? sourceRows.map(row => <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #edf1ee' }}><span>{row.label}</span><b>{number(row.views)}</b></div>) : <p className="muted">No traffic data yet. Share tagged links to start measuring referrals.</p>}</article>
        <article className="visitor-panel"><h2>Campaign visits</h2>{campaignViews.length ? campaignViews.map(row => <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #edf1ee' }}><span>{row.label}</span><b>{number(row.views)}</b></div>) : <p className="muted">Create free campaign links to measure social and referral visits.</p>}</article>
        <article className="visitor-panel"><h2>Actual enquiries by source</h2>{leadSources.length ? leadSources.map(([label, value]) => <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #edf1ee' }}><span>{label}</span><b>{number(value)}</b></div>) : <p className="muted">No enquiries in this period.</p>}</article>
      </div>

      <article className="visitor-panel" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div><h2>Free campaign link generator</h2><p className="muted">Create tagged links for Facebook, Instagram, YouTube, LinkedIn, WhatsApp and Google. No ad account or payment required.</p></div>
          <span className="eyebrow">{activeCampaigns} active campaigns</span>
        </div>
        <form onSubmit={createCampaign} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12, marginTop: 16 }}>
          <label>Campaign name<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Example: Vellore plot promotion"/></label>
          <label>Platform<select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}>{platforms.map(item => <option key={item.label}>{item.label}</option>)}</select></label>
          <label>Landing page path<input value={form.path} onChange={e => setForm({ ...form, path: e.target.value })} placeholder="/properties"/></label>
          <div style={{ display: 'flex', alignItems: 'end' }}><button className="btn btn-primary" disabled={saving}><Plus size={16}/>{saving ? 'Saving…' : 'Save free campaign'}</button></div>
        </form>
        <label style={{ display: 'block', marginTop: 14 }}>Generated tracking link<input readOnly value={shareUrl}/></label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <button type="button" className="btn btn-primary" onClick={() => copyText(shareUrl, 'Campaign link copied. Share it in your social post or WhatsApp Status.')}><Copy size={15}/> Copy link</button>
          <a className="btn btn-outline" href={shareUrl} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Test link</a>
        </div>
      </article>

      <article className="visitor-panel" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div><h2>Weekly free social media planner</h2><p className="muted">Seven days of practical organic promotion. Copy the ready-made caption and add the relevant property link.</p></div>
          <CalendarDays size={22} color="#587568"/>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(245px,1fr))', gap: 12, marginTop: 16 }}>
          {weeklyPlan.map(item => <div key={item.day} style={{ border: '1px solid #e6ebe8', borderRadius: 14, padding: 15, background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><b style={{ color: '#173e31' }}>{item.day}</b><span style={{ color: '#587568', fontSize: 12 }}><CheckCircle2 size={14} style={{ verticalAlign: 'middle' }}/> Free</span></div>
            <p style={{ fontSize: 13, fontWeight: 700, margin: '8px 0 4px' }}>{item.channel}</p>
            <p className="muted" style={{ fontSize: 13, minHeight: 55 }}>{item.task}</p>
            <button className="btn btn-outline" type="button" onClick={() => copyText(item.caption, item.day + ' caption copied. Add the property link before publishing.')}><Copy size={14}/> Copy caption</button>
          </div>)}
        </div>
      </article>

      <article className="visitor-panel">
        <h2>Saved organic campaigns</h2>
        {campaigns.length ? <div style={{ overflowX: 'auto' }}><table className="data-table"><thead><tr><th>Campaign</th><th>Platform</th><th>Tracking tag</th><th>Landing page</th><th>Status</th><th>Created</th></tr></thead><tbody>{campaigns.map(row => <tr key={row.id}><td>{row.campaign_name}</td><td>{row.platform}</td><td>{row.utm_campaign}</td><td>{row.landing_path}</td><td>{row.status}</td><td>{row.created_at ? new Date(row.created_at).toLocaleDateString('en-IN') : '—'}</td></tr>)}</tbody></table></div> : <p className="muted">No campaigns saved yet. Create your first free campaign above.</p>}
      </article>
    </>}
    <div className="analytics-footer"><span>WhatsApp clicks are reported separately from actual enquiries. Visitor tracking uses anonymous IDs and UTM tags.</span><Link to="/admin">← Back to Admin dashboard</Link></div>
  </section>
}
