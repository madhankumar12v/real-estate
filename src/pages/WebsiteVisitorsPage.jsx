import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, CalendarDays, Eye, RefreshCw, Users, MonitorSmartphone, FileSpreadsheet, ArrowUpRight } from 'lucide-react'
import { supabase } from '../lib/supabase'

const number = value => new Intl.NumberFormat('en-IN').format(Number(value) || 0)
const csvCell = value => '"' + String(value ?? '').replaceAll('"', '""') + '"'
const exportCsv = (data, range) => {
  const rows = [
    ['MrSa Properties · Website Visitors'],
    ['Report period', range],
    [],
    ['Metric', 'Count'],
    ['Visitors in period', data.summary?.period_visitors || 0],
    ['Page views in period', data.summary?.period_page_views || 0],
    ['All-time visitors', data.summary?.total_visitors || 0],
    ['All-time page views', data.summary?.total_page_views || 0],
    [],
    ['Page', 'Views'],
    ...(data.top_pages || []).map(row => [row.path, row.views]),
    [],
    ['Traffic source', 'Views'],
    ...(data.sources || []).map(row => [row.label, row.views]),
    [],
    ['Device', 'Views'],
    ...(data.devices || []).map(row => [row.label, row.views])
  ]
  const blob = new Blob(['\\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\\r\\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'mrsa-website-visitors-' + new Date().toISOString().slice(0, 10) + '.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

function Metric({ icon: Icon, label, value, note }) {
  return <article className="visitor-metric"><span><Icon size={18}/></span><small>{label}</small><strong>{number(value)}</strong><em>{note}</em></article>
}
function Breakdown({ title, rows, empty }) {
  const max = Math.max(1, ...(rows || []).map(row => Number(row.views) || 0))
  return <article className="visitor-panel">
    <h2>{title}</h2>
    {rows?.length ? <div className="visitor-breakdown">{rows.map(row => <div className="visitor-breakdown-row" key={row.label || row.path}>
      <div><span>{row.label || row.path}</span><b>{number(row.views)}</b></div>
      <i><span style={{ width: Math.max(2, (Number(row.views) || 0) / max * 100) + '%' }}/></i>
    </div>)}</div> : <p className="visitor-empty">{empty}</p>}
  </article>
}

export default function WebsiteVisitorsPage() {
  const [range, setRange] = useState('30days')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState(null)

  const bounds = useMemo(() => {
    const now = new Date()
    let from = null
    let to = null
    if (range === 'today') from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (range === 'week') { from = new Date(now.getFullYear(), now.getMonth(), now.getDate()); from.setDate(from.getDate() - ((from.getDay() + 6) % 7)) }
    if (range === 'month') from = new Date(now.getFullYear(), now.getMonth(), 1)
    if (range === '30days') { from = new Date(now); from.setDate(from.getDate() - 29); from.setHours(0, 0, 0, 0) }
    if (range === 'year') from = new Date(now.getFullYear(), 0, 1)
    if (range === 'custom') {
      from = fromDate ? new Date(fromDate + 'T00:00:00') : null
      to = toDate ? new Date(toDate + 'T23:59:59.999') : null
    }
    return { from: from?.toISOString() || null, to: to?.toISOString() || null }
  }, [range, fromDate, toDate])

  const load = async () => {
    setBusy(true); setError('')
    try {
      const { data: result, error: rpcError } = await supabase.rpc('get_admin_website_visitor_stats', { p_from: bounds.from, p_to: bounds.to })
      if (rpcError) throw rpcError
      setData(result || {})
      setUpdatedAt(new Date())
    } catch (err) { setError(err?.message || 'Unable to load website visitor statistics.') }
    finally { setBusy(false) }
  }
  useEffect(() => { load() }, [bounds.from, bounds.to])

  const periodLabel = range === 'today' ? 'Today' : range === 'week' ? 'This week' : range === 'month' ? 'This month' : range === '30days' ? 'Last 30 days' : range === 'year' ? 'This year' : range === 'all' ? 'All time' : 'Custom dates'
  const daily = data?.daily || []
  const maxDaily = Math.max(1, ...daily.map(row => Number(row.views) || 0))

  return <section className="section page-section website-visitors-page">
    <div className="visitor-heading"><div><span className="eyebrow">MRSA PROPERTIES · ADMIN</span><h1>Website Visitors</h1><p className="muted">Understand website traffic, popular pages and visitor devices.</p></div><div className="analytics-actions"><button className="btn btn-outline" onClick={load} disabled={busy}><RefreshCw size={15}/> Refresh</button><button className="btn btn-primary" onClick={() => exportCsv(data || {}, periodLabel)} disabled={busy || !data}><FileSpreadsheet size={15}/> Export CSV</button></div></div>
    <div className="visitor-toolbar"><label><CalendarDays size={16}/> Report period<select value={range} onChange={event => setRange(event.target.value)}><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option><option value="30days">Last 30 days</option><option value="year">This year</option><option value="custom">Custom dates</option><option value="all">All time</option></select></label>{range === 'custom' && <><label>From<input type="date" value={fromDate} max={toDate || undefined} onChange={event => setFromDate(event.target.value)}/></label><label>To<input type="date" value={toDate} min={fromDate || undefined} onChange={event => setToDate(event.target.value)}/></label></>}<small>{updatedAt ? 'Updated ' + updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Waiting for data'}</small></div>
    {error && <div className="analytics-error" role="alert"><span>{error}</span><button className="btn btn-outline" onClick={load}>Try again</button></div>}
    {busy ? <div className="analytics-loading">Loading visitor statistics…</div> : !error && <>
      <div className="visitor-metrics">
        <Metric icon={Users} label="Unique visitors" value={data?.summary?.period_visitors} note={periodLabel}/>
        <Metric icon={Eye} label="Page views" value={data?.summary?.period_page_views} note={periodLabel}/>
        <Metric icon={Users} label="Visitors today" value={data?.summary?.today_visitors} note="Unique visitors today"/>
        <Metric icon={Activity} label="All-time visitors" value={data?.summary?.total_visitors} note="Since tracking began"/>
      </div>
      <div className="visitor-chart-panel visitor-panel"><div className="visitor-panel-heading"><div><h2>Daily page views</h2><p>Traffic trend for {periodLabel.toLowerCase()}</p></div><span>{number(data?.summary?.period_page_views)} views</span></div>{daily.length ? <div className="visitor-daily-chart">{daily.map(row => <div className="visitor-day" key={row.day} title={row.day + ': ' + number(row.views) + ' views'}><span style={{ height: Math.max(3, (Number(row.views) || 0) / maxDaily * 100) + '%' }}/><small>{new Date(row.day + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</small></div>)}</div> : <p className="visitor-empty">No visitor activity recorded for this period yet. Once tracking is enabled, page views will appear here.</p>}</div>
      <div className="visitor-breakdown-grid"><Breakdown title="Most visited pages" rows={data?.top_pages} empty="No page views recorded yet."/><Breakdown title="Traffic sources" rows={data?.sources} empty="Traffic sources will appear here."/><Breakdown title="Visitor devices" rows={data?.devices} empty="Device details will appear here."/></div>
      <div className="visitor-privacy-note"><b>Privacy-friendly tracking</b><p>MrSa records an anonymous visitor ID, session ID, page path, referring website, broad device type and visit time. It does not store IP addresses, names, phone numbers or email addresses. Admin pages and account areas are excluded.</p></div>
    </>}
    <div className="analytics-footer"><span>Visitor tracking starts after the SQL setup is run and the website is redeployed.</span><Link to="/admin">← Back to Admin dashboard</Link></div>
  </section>
}
