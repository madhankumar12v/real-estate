import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Eye, MessageCircle, RefreshCw, Users, Target, ArrowUpRight } from 'lucide-react'
import { supabase } from '../lib/supabase'

const number = value => new Intl.NumberFormat('en-IN').format(Number(value) || 0)
const normaliseSource = value => {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return 'Unattributed'
  if (/facebook|fb\\.com/.test(raw)) return 'Facebook'
  if (/instagram/.test(raw)) return 'Instagram'
  if (/google|bing|yahoo|duckduckgo|search/.test(raw)) return 'Google / Search'
  if (/whatsapp|wa\\.me/.test(raw)) return 'WhatsApp'
  if (/youtube|youtu\\.be/.test(raw)) return 'YouTube'
  if (/linkedin/.test(raw)) return 'LinkedIn'
  if (/direct|none|website/.test(raw)) return 'Direct'
  if (/referral|other|http|www\\./.test(raw)) return 'Other referrals'
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}
function Metric({ icon: Icon, label, value, note }) {
  return <article className="visitor-metric"><span><Icon size={18}/></span><small>{label}</small><strong>{number(value)}</strong><em>{note}</em></article>
}
function Breakdown({ title, rows, empty }) {
  const max = Math.max(1, ...(rows || []).map(row => Number(row.count) || 0))
  return <article className="visitor-panel">
    <h2>{title}</h2>
    {rows?.length ? <div className="visitor-breakdown">{rows.map(row => <div className="visitor-breakdown-row" key={row.label}>
      <div><span>{row.label}</span><b>{number(row.count)}</b></div>
      <i><span style={{ width: Math.max(2, (Number(row.count) || 0) / max * 100) + '%' }}/></i>
    </div>)}</div> : <p className="visitor-empty">{empty}</p>}
  </article>
}
export default function MarketingPage() {
  const [range, setRange] = useState('30')
  const [stats, setStats] = useState({})
  const [enquiries, setEnquiries] = useState([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState(null)
  const bounds = useMemo(() => {
    if (range === 'all') return { from: null, to: null }
    const from = new Date()
    from.setDate(from.getDate() - Number(range) + 1)
    from.setHours(0, 0, 0, 0)
    return { from: from.toISOString(), to: null }
  }, [range])
  const load = async () => {
    setBusy(true); setError('')
    try {
      const [visitorResult, enquiryResult] = await Promise.all([
        supabase.rpc('get_admin_website_visitor_stats', { p_from: bounds.from, p_to: bounds.to }),
        (() => {
          let query = supabase.from('enquiries').select('id,created_at,source,marketing_source,utm_source,heard_about')
          if (bounds.from) query = query.gte('created_at', bounds.from)
          return query.order('created_at', { ascending: false }).limit(5000)
        })()
      ])
      if (visitorResult.error) throw visitorResult.error
      if (enquiryResult.error) throw enquiryResult.error
      setStats(visitorResult.data || {})
      setEnquiries(enquiryResult.data || [])
      setUpdatedAt(new Date())
    } catch (err) {
      setError(err?.message || 'Unable to load traffic and enquiry sources.')
    } finally { setBusy(false) }
  }
  useEffect(() => { load() }, [bounds.from, bounds.to])
  const visitorRows = (stats.sources || []).map(row => ({ label: normaliseSource(row.label), count: Number(row.views) || 0 }))
    .reduce((acc, row) => { const old = acc.find(item => item.label === row.label); if (old) old.count += row.count; else acc.push(row); return acc }, [])
    .sort((a,b) => b.count-a.count)
  const enquiryRows = Object.entries(enquiries.reduce((acc, row) => {
    const key = normaliseSource(row.marketing_source || row.utm_source || row.heard_about || row.source)
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})).map(([label,count]) => ({label,count})).sort((a,b)=>b.count-a.count)
  const visitors = Number(stats.summary?.period_visitors || 0)
  const pageViews = Number(stats.summary?.period_page_views || 0)
  const whatsappClicks = Number(stats.summary?.period_whatsapp_clicks || 0)
  const conversion = visitors ? (enquiries.length / visitors * 100) : 0
  const periodLabel = range === 'all' ? 'All time' : 'Last ' + range + ' days'
  return <section className="section page-section website-visitors-page">
    <div className="visitor-heading"><div><span className="eyebrow">MRSA PROPERTIES · ADMIN</span><h1>Traffic &amp; Enquiry Sources</h1><p className="muted">Understand where website visitors come from and which channels bring real property enquiries.</p></div><div className="analytics-actions"><button className="btn btn-outline" onClick={load} disabled={busy}><RefreshCw size={15}/> Refresh</button><Link className="btn btn-outline" to="/admin/website-visitors"><Eye size={15}/> Visitor details</Link><Link className="btn btn-outline" to="/crm"><Users size={15}/> CRM enquiries</Link></div></div>
    <div className="visitor-toolbar"><label>Report period<select value={range} onChange={e=>setRange(e.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option></select></label><small>{periodLabel} · {updatedAt ? 'Updated '+updatedAt.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : 'Waiting for data'}</small></div>
    {error && <div className="analytics-error" role="alert"><span>{error}</span><button className="btn btn-outline" onClick={load}>Try again</button></div>}
    {busy ? <div className="analytics-loading">Loading traffic and enquiry data…</div> : !error && <>
      <div className="visitor-metrics">
        <Metric icon={Users} label="Unique visitors" value={visitors} note={periodLabel}/>
        <Metric icon={Eye} label="Page views" value={pageViews} note={periodLabel}/>
        <Metric icon={Target} label="Actual enquiries" value={enquiries.length} note="Saved in CRM"/>
        <Metric icon={MessageCircle} label="WhatsApp clicks" value={whatsappClicks} note="Clicks, not confirmed enquiries"/>
        <Metric icon={Activity} label="Visitor-to-enquiry rate" value={conversion.toFixed(1)+'%'} note="Enquiries ÷ unique visitors"/>
      </div>
      <div className="visitor-breakdown-grid">
        <Breakdown title="Where visitors come from" rows={visitorRows} empty="No visitor sources recorded yet."/>
        <Breakdown title="Where enquiries come from" rows={enquiryRows} empty="No enquiries recorded for this period."/>
      </div>
      <div className="visitor-panel" style={{marginTop:16}}>
        <h2>How to read these numbers</h2>
        <ul>
          <li><b>Visitors</b> are grouped by the referring source: Google/Search, Facebook, Instagram, WhatsApp, YouTube, LinkedIn, Direct or other referrals.</li>
          <li><b>Enquiries</b> are grouped using tracked source information first, then the source selected by the customer in the enquiry form.</li>
          <li><b>WhatsApp clicks</b> are shown separately and are not treated as submitted enquiries.</li>
        </ul>
        <p className="muted">Some enquiries may appear as Unattributed when a visitor arrives without a detectable referrer or tracking tag.</p>
      </div>
    </>}
    <div className="analytics-footer"><span>Source analytics use anonymous website tracking and enquiry source fields. No campaign budgets or paid-ad spend are tracked here.</span><Link to="/admin">← Back to Admin dashboard</Link></div>
  </section>
}
