import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  RefreshCw, MessageCircle, Users, Clock3, CheckCircle2, TrendingUp,
  Download, Search, CalendarClock, AlertCircle, BarChart3, Target
} from 'lucide-react'
import '../crm-4.css'

const stages = ['new', 'contacted', 'interested', 'closed', 'not_interested']
const stageLabel = value => value.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
const toLocalInput = value => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}
const startOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const normaliseIndianPhone = value => {
  const raw = String(value || '').trim()
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  if (raw.startsWith('+')) return digits
  if (digits.length === 10) return '91' + digits
  if (digits.length === 11 && digits.startsWith('0')) return '91' + digits.slice(1)
  if (digits.length === 12 && digits.startsWith('91')) return digits
  return digits
}
const csvCell = value => '"' + String(value ?? '').replaceAll('"', '""') + '"'
const downloadReport = (rows, agents, periodLabel) => {
  const agentName = id => agents.find(agent => agent.id === id)?.full_name || 'Unassigned'
  const counts = stages.map(stage => [stageLabel(stage), rows.filter(row => row.status === stage).length])
  const sections = [
    ['MrSa Properties CRM Performance Report', periodLabel],
    [],
    ['KPI', 'Count'],
    ['Total enquiries', rows.length],
    ...counts,
    ['Overdue follow-ups', rows.filter(row => row.follow_up_at && new Date(row.follow_up_at) < new Date() && !['closed', 'not_interested'].includes(row.status)).length],
    [],
    ['Enquiry source', 'Count'],
    ...Object.entries(rows.reduce((acc, row) => { const key = row.source || 'Unknown'; acc[key] = (acc[key] || 0) + 1; return acc }, {})),
    [],
    ['District', 'Count'],
    ...Object.entries(rows.reduce((acc, row) => { const key = row.listings?.district || 'Not specified'; acc[key] = (acc[key] || 0) + 1; return acc }, {})),
    [],
    ['Property type', 'Count'],
    ...Object.entries(rows.reduce((acc, row) => { const key = row.listings?.property_type || 'General enquiry'; acc[key] = (acc[key] || 0) + 1; return acc }, {})),
    [],
    ['Agent', 'Total', 'Closed', 'Interested', 'Open'],
    ...[...new Set(rows.map(row => row.assigned_to || 'unassigned'))].map(id => {
      const mine = rows.filter(row => (row.assigned_to || 'unassigned') === id)
      return [id === 'unassigned' ? 'Unassigned' : agentName(id), mine.length, mine.filter(row => row.status === 'closed').length, mine.filter(row => row.status === 'interested').length, mine.filter(row => !['closed', 'not_interested'].includes(row.status)).length]
    })
  ]
  const content = '\uFEFF' + sections.map(line => line.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'mrsa-crm-report-' + new Date().toISOString().slice(0, 10) + '.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function CRMPage({ user, profile }) {
  const [rows, setRows] = useState([])
  const [agents, setAgents] = useState([])
  const [period, setPeriod] = useState('30d')
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(true)
  const [savingId, setSavingId] = useState('')
  const admin = profile?.role === 'admin'

  const load = async () => {
    setBusy(true)
    setMessage('')
    try {
      let all = []
      let from = 0
      const pageSize = 500
      while (true) {
        let request = supabase.from('enquiries')
          .select('id,listing_id,buyer_name,buyer_phone,message,source,status,assigned_to,created_at,updated_at,follow_up_at,listings(title,city,district,property_type,price)')
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1)
        if (!admin) request = request.eq('assigned_to', user.id)
        const result = await request
        if (result.error) throw result.error
        all = all.concat(result.data || [])
        if (!result.data || result.data.length < pageSize) break
        from += pageSize
      }
      setRows(all)
      if (admin) {
        const agentResult = await supabase.from('profiles').select('id,full_name').eq('role', 'agent').order('full_name')
        if (agentResult.error) throw agentResult.error
        setAgents(agentResult.data || [])
      } else {
        setAgents([{ id: user.id, full_name: profile?.full_name || 'My leads' }])
      }
    } catch (error) {
      setMessage(error.message || 'Unable to load CRM records.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { load() }, [user?.id, admin])

  const now = new Date()
  const periodStart = period === 'all' ? null : new Date(now.getTime() - (period === '7d' ? 7 : period === '30d' ? 30 : 90) * 86400000)
  const periodRows = useMemo(() => rows.filter(row => !periodStart || new Date(row.created_at) >= periodStart), [rows, period, periodStart?.getTime()])
  const stats = useMemo(() => {
    const total = periodRows.length
    const count = status => periodRows.filter(row => row.status === status).length
    const closed = count('closed')
    const active = periodRows.filter(row => ['contacted', 'interested'].includes(row.status)).length
    const previousStart = periodStart ? new Date(periodStart.getTime() - (period === '7d' ? 7 : period === '30d' ? 30 : 90) * 86400000) : null
    const previous = previousStart ? rows.filter(row => {
      const date = new Date(row.created_at)
      return date >= previousStart && date < periodStart
    }).length : null
    return { total, new: count('new'), contacted: count('contacted'), interested: count('interested'), closed, notInterested: count('not_interested'), active, conversion: total ? (closed / total) * 100 : 0, previous, change: previous === null ? null : total - previous }
  }, [periodRows, rows, period, periodStart?.getTime()])

  const overdue = rows.filter(row => row.follow_up_at && new Date(row.follow_up_at) < now && !['closed', 'not_interested'].includes(row.status))
  const upcoming = rows.filter(row => row.follow_up_at && new Date(row.follow_up_at) >= now && new Date(row.follow_up_at) <= new Date(now.getTime() + 7 * 86400000) && !['closed', 'not_interested'].includes(row.status)).sort((a, b) => new Date(a.follow_up_at) - new Date(b.follow_up_at))
  const sourceBreakdown = Object.entries(periodRows.reduce((acc, row) => { const key = row.source || 'Unknown'; acc[key] = (acc[key] || 0) + 1; return acc }, {})).sort((a, b) => b[1] - a[1])
  const districtBreakdown = Object.entries(periodRows.reduce((acc, row) => { const key = row.listings?.district || 'Not specified'; acc[key] = (acc[key] || 0) + 1; return acc }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const typeBreakdown = Object.entries(periodRows.reduce((acc, row) => { const key = row.listings?.property_type || 'General enquiry'; acc[key] = (acc[key] || 0) + 1; return acc }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const agentBreakdown = [...new Set(periodRows.map(row => row.assigned_to || 'unassigned'))].map(id => {
    const mine = periodRows.filter(row => (row.assigned_to || 'unassigned') === id)
    return { id, name: id === 'unassigned' ? 'Unassigned' : agents.find(agent => agent.id === id)?.full_name || 'Agent', total: mine.length, closed: mine.filter(row => row.status === 'closed').length, interested: mine.filter(row => row.status === 'interested').length, open: mine.filter(row => !['closed', 'not_interested'].includes(row.status)).length }
  }).sort((a, b) => b.total - a.total)

  const visible = periodRows.filter(row => (filter === 'all' || row.status === filter) && [row.buyer_name, row.buyer_phone, row.listings?.title, row.listings?.city, row.listings?.district].join(' ').toLowerCase().includes(query.toLowerCase()))

  const update = async (id, patch) => {
    setSavingId(id)
    const result = await supabase.from('enquiries').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
    if (result.error) setMessage(result.error.message)
    else setMessage('Enquiry updated successfully.')
    setSavingId('')
    await load()
  }

  const periodLabel = period === 'all' ? 'All available records' : 'Last ' + (period === '7d' ? '7' : period === '30d' ? '30' : '90') + ' days'
  const maxBar = Math.max(1, ...[...districtBreakdown, ...typeBreakdown, ...sourceBreakdown].map(item => item[1]))
  const renderBars = items => items.length ? <div className="crm4-bars">{items.map(([label, value]) => <div className="crm4-bar-row" key={label}><span title={label}>{label}</span><div className="crm4-track"><i style={{ width: (value / maxBar * 100) + '%' }}/></div><b>{value}</b></div>)}</div> : <p className="crm4-empty-note">No records for this period.</p>

  return <section className="section page-section crm4">
    <div className="crm4-heading">
      <div><span className="eyebrow">MRSA SALES WORKSPACE · 4.0</span><h1>Enquiry CRM</h1><p className="muted">A clearer view of leads, agent activity and follow-up priorities.</p></div>
      <div className="crm4-toolbar">
        <select aria-label="Report period" value={period} onChange={event => setPeriod(event.target.value)}><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="all">All records</option></select>
        <button className="btn btn-outline" onClick={load} disabled={busy}><RefreshCw size={15}/> Refresh</button>
        <button className="btn btn-primary" onClick={() => downloadReport(periodRows, agents, periodLabel)} disabled={!periodRows.length}><Download size={15}/> Export report</button>
      </div>
    </div>
    {message && <p className="notice" role="status">{message}</p>}
    {busy ? <div className="crm4-loading">Loading your CRM performance…</div> : <>
      <div className="crm4-summary"><span>{periodLabel}</span><span>{admin ? 'Administrator view · all permitted enquiries' : 'Agent view · enquiries assigned to you'}</span></div>
      <div className="crm4-kpis">
        <article><span className="crm4-kpi-icon"><Users size={18}/></span><small>Total enquiries</small><strong>{stats.total}</strong><em>{stats.previous === null ? 'All available records' : (stats.change > 0 ? '+' : '') + stats.change + ' vs previous period'}</em></article>
        <article><span className="crm4-kpi-icon"><Target size={18}/></span><small>New leads</small><strong>{stats.new}</strong><em>{stats.contacted} contacted · {stats.interested} interested</em></article>
        <article><span className="crm4-kpi-icon"><CheckCircle2 size={18}/></span><small>Closed enquiries</small><strong>{stats.closed}</strong><em>{stats.conversion.toFixed(1)}% conversion rate</em></article>
        <article><span className="crm4-kpi-icon"><Clock3 size={18}/></span><small>Overdue follow-ups</small><strong>{overdue.length}</strong><em>{upcoming.length} due in next 7 days</em></article>
      </div>
      <div className="crm4-status-panel">
        <div className="crm4-section-title"><div><h2>Lead pipeline</h2><p>Enquiry stages for {periodLabel.toLowerCase()}.</p></div><span><TrendingUp size={16}/> Conversion: closed ÷ total</span></div>
        <div className="crm4-pipeline">{stages.map(stage => <button key={stage} className={filter === stage ? 'selected' : ''} onClick={() => setFilter(filter === stage ? 'all' : stage)}><small>{stageLabel(stage)}</small><b>{stats[stage === 'not_interested' ? 'notInterested' : stage]}</b></button>)}</div>
        <div className="crm4-conversion"><div><span>Closed conversion</span><b>{stats.conversion.toFixed(1)}%</b></div><div className="crm4-track"><i style={{ width: Math.min(100, stats.conversion) + '%' }}/></div></div>
      </div>
      <div className="crm4-grid">
        <article className="crm4-panel"><div className="crm4-section-title"><div><h2>Enquiry sources</h2><p>Where your leads come from.</p></div><BarChart3 size={18}/></div>{renderBars(sourceBreakdown)}</article>
        <article className="crm4-panel"><div className="crm4-section-title"><div><h2>District demand</h2><p>Districts linked to property enquiries.</p></div><BarChart3 size={18}/></div>{renderBars(districtBreakdown)}</article>
        <article className="crm4-panel"><div className="crm4-section-title"><div><h2>Property interest</h2><p>Most enquired property categories.</p></div><BarChart3 size={18}/></div>{renderBars(typeBreakdown)}</article>
        <article className="crm4-panel"><div className="crm4-section-title"><div><h2>Agent performance</h2><p>Assigned leads and outcomes.</p></div><Users size={18}/></div>
          {agentBreakdown.length ? <div className="crm4-agent-list">{agentBreakdown.map(agent => <div className="crm4-agent" key={agent.id}><div><b>{agent.name}</b><small>{agent.total} leads · {agent.closed} closed · {agent.interested} interested</small></div><span>{agent.open} open</span></div>)}</div> : <p className="crm4-empty-note">No agent data for this period.</p>}
        </article>
      </div>
      <div className="crm4-grid crm4-follow-grid">
        <article className="crm4-panel"><div className="crm4-section-title"><div><h2><AlertCircle size={17}/> Overdue follow-ups</h2><p>Open leads with a past follow-up date.</p></div><strong className="crm4-count-warn">{overdue.length}</strong></div>
          {overdue.slice(0, 6).map(row => <div className="crm4-follow-row" key={row.id}><div><b>{row.buyer_name}</b><small>{row.listings?.title || 'General enquiry'} · {new Date(row.follow_up_at).toLocaleDateString('en-IN')}</small></div><button className="btn btn-outline" onClick={() => window.open('https://wa.me/' + normaliseIndianPhone(row.buyer_phone), '_blank', 'noopener,noreferrer')}><MessageCircle size={14}/> WhatsApp</button></div>)}
          {!overdue.length && <p className="crm4-empty-note">No overdue follow-ups. Good work!</p>}
        </article>
        <article className="crm4-panel"><div className="crm4-section-title"><div><h2><CalendarClock size={17}/> Upcoming follow-ups</h2><p>Due in the next seven days.</p></div><strong>{upcoming.length}</strong></div>
          {upcoming.slice(0, 6).map(row => <div className="crm4-follow-row" key={row.id}><div><b>{row.buyer_name}</b><small>{row.listings?.title || 'General enquiry'} · {new Date(row.follow_up_at).toLocaleString('en-IN')}</small></div><button className="btn btn-outline" onClick={() => window.open('https://wa.me/' + normaliseIndianPhone(row.buyer_phone), '_blank', 'noopener,noreferrer')}><MessageCircle size={14}/> WhatsApp</button></div>)}
          {!upcoming.length && <p className="crm4-empty-note">No upcoming follow-ups scheduled.</p>}
        </article>
      </div>
      <div className="crm4-leads">
        <div className="crm4-section-title"><div><h2>Enquiry records</h2><p>Search, update lead stages and set the next follow-up.</p></div><span>{visible.length} records</span></div>
        <div className="crm4-search"><label><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search buyer, phone, property or district"/></label><select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All stages</option>{stages.map(stage => <option key={stage} value={stage}>{stageLabel(stage)}</option>)}</select></div>
        <div className="crm4-record-list">{visible.map(row => <article className="crm4-record" key={row.id}>
          <div className="crm4-record-main"><b>{row.buyer_name}</b><small>{row.buyer_phone} · {new Date(row.created_at).toLocaleDateString('en-IN')}</small><p>{row.listings?.title || 'General enquiry'}{row.listings?.city ? ' · ' + row.listings.city : ''}{row.listings?.district ? ' · ' + row.listings.district : ''}</p>{row.message && <small className="crm4-message">{row.message}</small>}{row.follow_up_at && <small className={new Date(row.follow_up_at) < now && !['closed', 'not_interested'].includes(row.status) ? 'crm4-overdue-text' : 'crm4-muted'}>Follow-up: {new Date(row.follow_up_at).toLocaleString('en-IN')}</small>}</div>
          <div className="crm4-record-actions"><a className="btn btn-whatsapp" href={'https://wa.me/' + normaliseIndianPhone(row.buyer_phone) + '?text=' + encodeURIComponent('Hello ' + row.buyer_name + ', following up on your MrSa Properties enquiry.')} target="_blank" rel="noreferrer"><MessageCircle size={14}/> WhatsApp</a><label className="crm4-follow-input">Next follow-up<input type="datetime-local" value={toLocalInput(row.follow_up_at)} disabled={savingId === row.id} onChange={event => update(row.id, { follow_up_at: event.target.value ? new Date(event.target.value).toISOString() : null })}/></label><label>Lead stage<select value={row.status} disabled={savingId === row.id} onChange={event => update(row.id, { status: event.target.value })}>{stages.map(stage => <option key={stage} value={stage}>{stageLabel(stage)}</option>)}</select></label>{admin && <label>Assign agent<select value={row.assigned_to || ''} disabled={savingId === row.id} onChange={event => update(row.id, { assigned_to: event.target.value || null })}><option value="">Unassigned</option>{agents.map(agent => <option key={agent.id} value={agent.id}>{agent.full_name || 'Agent'}</option>)}</select></label>}</div>
        </article>)}</div>
        {!visible.length && <div className="crm4-empty"><Users size={28}/><h3>No enquiries found</h3><p>Try another filter or search term.</p></div>}
      </div>
    </>}
  </section>
}
