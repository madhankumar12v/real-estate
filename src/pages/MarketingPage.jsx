import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Eye, MessageCircle, RefreshCw, Users, Target, MapPin, House, CheckCircle2, Clock3 } from 'lucide-react'
import { supabase } from '../lib/supabase'

const number = value => new Intl.NumberFormat('en-IN').format(Number(value) || 0)
const normaliseSource = value => {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw || raw === 'website' || raw === 'not specified') return 'Unattributed'
  if (/facebook|fb\.com/.test(raw)) return 'Facebook'
  if (/instagram/.test(raw)) return 'Instagram'
  if (/google|bing|yahoo|duckduckgo|search/.test(raw)) return 'Google / Search'
  if (/whatsapp|wa\.me/.test(raw)) return 'WhatsApp'
  if (/youtube|youtu\.be/.test(raw)) return 'YouTube'
  if (/linkedin/.test(raw)) return 'LinkedIn'
  if (/direct|none/.test(raw)) return 'Direct'
  if (/referral|other|http|www\./.test(raw)) return 'Other referrals'
  if (/social/.test(raw)) return 'Other social'
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}
const groupRows = (rows, getLabel, limit = 8) => Object.entries(rows.reduce((acc, row) => {
  const label = getLabel(row) || 'Not specified'
  acc[label] = (acc[label] || 0) + 1
  return acc
}, {})).map(([label,count]) => ({label,count})).sort((a,b)=>b.count-a.count).slice(0,limit)
function Metric({ icon: Icon, label, value, note }) {
  return <article className="visitor-metric"><span><Icon size={18}/></span><small>{label}</small><strong>{typeof value === 'string' ? value : number(value)}</strong><em>{note}</em></article>
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
      const visitorPromise = supabase.rpc('get_admin_website_visitor_stats', { p_from: bounds.from, p_to: bounds.to })
      const fetchEnquiries = async () => {
        let all = [], from = 0
        const pageSize = 500
        while (true) {
          let query = supabase.from('enquiries')
            .select('id,created_at,source,marketing_source,utm_source,heard_about,status,city_town,interest,listings(title,city,property_type)')
            .order('created_at', { ascending: false })
            .range(from, from + pageSize - 1)
          if (bounds.from) query = query.gte('created_at', bounds.from)
          const result = await query
          if (result.error) throw result.error
          all = all.concat(result.data || [])
          if (!result.data || result.data.length < pageSize) break
          from += pageSize
        }
        return all
      }
      const [visitorResult, enquiryRows] = await Promise.all([visitorPromise, fetchEnquiries()])
      if (visitorResult.error) throw visitorResult.error
      setStats(visitorResult.data || {})
      setEnquiries(enquiryRows)
      setUpdatedAt(new Date())
    } catch (err) {
      setError(err?.message || 'Unable to load traffic and enquiry sources.')
    } finally { setBusy(false) }
  }
  useEffect(() => { load() }, [bounds.from, bounds.to])
  const visitorRows = (stats.source_details || stats.sources || []).map(row => ({
    label: normaliseSource(row.label), count: Number(row.visitors ?? row.views) || 0,
    sessions: Number(row.sessions) || 0, views: Number(row.views) || 0,
    clicks: Number(row.whatsapp_clicks) || 0
  })).reduce((acc,row) => {
    const old=acc.find(item=>item.label===row.label)
    if(old){old.count+=row.count;old.sessions+=row.sessions;old.views+=row.views;old.clicks+=row.clicks}
    else acc.push(row)
    return acc
  },[]).sort((a,b)=>b.count-a.count)
  const enquiryRows = groupRows(enquiries, row => normaliseSource(row.marketing_source || row.utm_source || row.heard_about || row.source))
  const enquiryCountBySource = Object.fromEntries(enquiryRows.map(row=>[row.label,row.count]))
  const sourcePerformance = [...new Set([...visitorRows.map(row=>row.label),...enquiryRows.map(row=>row.label)])].map(label=>{
    const visitors=visitorRows.find(row=>row.label===label)?.count||0
    const enquiriesCount=enquiryCountBySource[label]||0
    const clicks=visitorRows.find(row=>row.label===label)?.clicks||0
    return {label,visitors,enquiries:enquiriesCount,clicks,conversion:visitors?(enquiriesCount/visitors*100):0}
  }).sort((a,b)=>b.enquiries-a.enquiries||b.visitors-a.visitors)
  const visitors = Number(stats.summary?.period_visitors || 0)
  const sessions = Number(stats.summary?.period_sessions || 0)
  const pageViews = Number(stats.summary?.period_page_views || 0)
  const whatsappClicks = Number(stats.summary?.period_whatsapp_clicks || 0)
  const conversion = visitors ? (enquiries.length / visitors * 100) : 0
  const periodLabel = range === 'all' ? 'All time' : 'Last ' + range + ' days'
  const interestRows = groupRows(enquiries,row=>row.interest || 'General enquiry')
  const cityRows = groupRows(enquiries,row=>row.city_town || row.listings?.city || 'Not specified')
  const statusRows = groupRows(enquiries,row=>(row.status || 'new').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase()))
  const propertyRows = groupRows(enquiries,row=>row.listings?.property_type || row.interest || 'General enquiry')
  return <section className="section page-section website-visitors-page">
    <div className="visitor-heading"><div><span className="eyebrow">MRSA PROPERTIES · ADMIN</span><h1>Traffic &amp; Enquiry Sources</h1><p className="muted">See where visitors come from, which channels create enquiries and what customers are looking for.</p></div><div className="analytics-actions"><button className="btn btn-outline" onClick={load} disabled={busy}><RefreshCw size={15}/> Refresh</button><Link className="btn btn-outline" to="/admin/website-visitors"><Eye size={15}/> Visitor details</Link><Link className="btn btn-outline" to="/crm"><Users size={15}/> CRM enquiries</Link></div></div>
    <div className="visitor-toolbar"><label>Report period<select value={range} onChange={e=>setRange(e.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option></select></label><small>{periodLabel} · {updatedAt ? 'Updated '+updatedAt.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : 'Waiting for data'}</small></div>
    {error && <div className="analytics-error" role="alert"><span>{error}</span><button className="btn btn-outline" onClick={load}>Try again</button></div>}
    {busy ? <div className="analytics-loading">Loading traffic and enquiry data…</div> : !error && <>
      <div className="visitor-metrics">
        <Metric icon={Users} label="Unique visitors" value={visitors} note={periodLabel}/>
        <Metric icon={Activity} label="Website sessions" value={sessions} note="Separate visits"/>
        <Metric icon={Eye} label="Page views" value={pageViews} note={periodLabel}/>
        <Metric icon={Target} label="Actual enquiries" value={enquiries.length} note="Saved in CRM"/>
        <Metric icon={MessageCircle} label="WhatsApp clicks" value={whatsappClicks} note="Clicks, not confirmed enquiries"/>
        <Metric icon={CheckCircle2} label="Visitor-to-enquiry rate" value={conversion.toFixed(1)+'%'} note="Enquiries ÷ unique visitors"/>
      </div>
      <div className="visitor-panel" style={{marginTop:16}}>
        <h2>Channel performance</h2>
        <p className="muted">Compare unique visitors with actual submitted enquiries. Clicks are shown separately.</p>
        {sourcePerformance.length ? <div className="source-performance-scroll"><table className="source-performance-table"><thead><tr><th>Source</th><th>Visitors</th><th>Enquiries</th><th>WhatsApp clicks</th><th>Enquiry rate</th></tr></thead><tbody>{sourcePerformance.map(row=><tr key={row.label}><td><b>{row.label}</b></td><td>{number(row.visitors)}</td><td>{number(row.enquiries)}</td><td>{number(row.clicks)}</td><td>{row.visitors?row.conversion.toFixed(1)+'%':'—'}</td></tr>)}</tbody></table></div> : <p className="visitor-empty">Channel data will appear when visits and enquiries are recorded.</p>}
        <p className="muted">The channel enquiry rate is indicative: it compares enquiries attributed to a source with visitors recorded for that source. Unattributed enquiries are kept separate.</p>
      </div>
      <div className="visitor-breakdown-grid">
        <Breakdown title="Visitor origin" rows={visitorRows.map(row=>({label:row.label,count:row.count}))} empty="No visitor sources recorded yet."/>
        <Breakdown title="Enquiry origin" rows={enquiryRows} empty="No enquiries recorded for this period."/>
        <Breakdown title="Customer interest" rows={interestRows} empty="Customer interests will appear here."/>
        <Breakdown title="Enquiries by City / Town" rows={cityRows} empty="City / Town demand will appear here."/>
        <Breakdown title="Property type demand" rows={propertyRows} empty="Property interest details will appear here."/>
        <Breakdown title="Enquiry pipeline status" rows={statusRows} empty="Enquiry status information will appear here."/>
      </div>
      <div className="visitor-panel" style={{marginTop:16}}>
        <h2>Business insights</h2>
        <ul>
          <li><b>Best visitor source:</b> {visitorRows[0]?.label || 'Not available yet'}{visitorRows[0] ? ' ('+number(visitorRows[0].count)+' visitors)' : ''}.</li>
          <li><b>Top enquiry source:</b> {enquiryRows[0]?.label || 'Not available yet'}{enquiryRows[0] ? ' ('+number(enquiryRows[0].count)+' enquiries)' : ''}.</li>
          <li><b>Most requested City / Town:</b> {cityRows[0]?.label || 'Not available yet'}.</li>
          <li><b>Most requested interest:</b> {interestRows[0]?.label || 'Not available yet'}.</li>
        </ul>
        <p className="muted">Some enquiries may be Unattributed if the customer did not arrive with a detectable referrer and did not select how they heard about MrSa.</p>
      </div>
    </>}
    <div className="analytics-footer"><span>Source analytics use anonymous visitor tracking and enquiry source fields. No campaign budgets or paid-ad spend are tracked.</span><Link to="/admin">← Back to Admin dashboard</Link></div>
  </section>
}
