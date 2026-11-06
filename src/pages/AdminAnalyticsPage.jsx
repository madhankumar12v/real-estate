import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowDownRight, ArrowUpRight, Building2, CalendarDays, CheckCircle2, Clock3, Eye, FileSpreadsheet, MessageSquare, Printer, RefreshCw, Users, UserRound, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'

const dateKey = value => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}
const startOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const count = value => new Intl.NumberFormat('en-IN').format(value || 0)
const money = value => value == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0)
const csvCell = value => '"' + String(value ?? '').replaceAll('"', '""') + '"'
const downloadCsv = (name, rows) => {
  const content = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function Panel({ title, subtitle, icon: Icon, children, className = '' }) {
  return <article className={'analytics-panel ' + className}>
    <div className="analytics-panel-heading">
      <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      {Icon && <span className="analytics-panel-icon"><Icon size={17}/></span>}
    </div>
    {children}
  </article>
}

function MetricCard({ icon: Icon, label, value, note, tone = 'green' }) {
  return <article className={'analytics-metric analytics-metric-' + tone}>
    <div className="analytics-metric-top"><span className="analytics-metric-icon"><Icon size={18}/></span><span className="analytics-metric-label">{label}</span></div>
    <strong>{count(value)}</strong>
    <small>{note}</small>
  </article>
}

function TrendChart({ rows }) {
  const max = Math.max(1, ...rows.flatMap(row => [row.enquiries, row.listings]))
  const x = index => rows.length <= 1 ? 50 : 7 + index * 86 / (rows.length - 1)
  const y = value => 84 - value / max * 68
  const enquiryPoints = rows.map((row, index) => x(index) + ',' + y(row.enquiries)).join(' ')
  const listingPoints = rows.map((row, index) => x(index) + ',' + y(row.listings)).join(' ')
  return <div className="analytics-chart-wrap">
    <div className="analytics-legend"><span><i className="legend-enquiry"/>Enquiries</span><span><i className="legend-listing"/>New listings</span></div>
    <svg className="analytics-line-chart" viewBox="0 0 100 100" role="img" aria-label="Monthly enquiries and property listings over the last twelve months" preserveAspectRatio="none">
      {[16, 39, 62, 85].map((line, index) => <g key={line}><line x1="5" x2="96" y1={line} y2={line} className="analytics-grid-line"/><text x="2" y={line - 1} className="analytics-axis-label">{Math.round(max * (3 - index) / 3)}</text></g>)}
      <polyline points={enquiryPoints} className="analytics-line analytics-line-enquiry"/>
      <polyline points={listingPoints} className="analytics-line analytics-line-listing"/>
      {rows.map((row, index) => <g key={row.key}>
        <circle cx={x(index)} cy={y(row.enquiries)} r="1.7" className="analytics-dot-enquiry"><title>{row.label}: {row.enquiries} enquiries</title></circle>
        <circle cx={x(index)} cy={y(row.listings)} r="1.7" className="analytics-dot-listing"><title>{row.label}: {row.listings} listings</title></circle>
      </g>)}
    </svg>
    <div className="analytics-chart-labels">{rows.map(row => <span key={row.key}>{row.label}</span>)}</div>
  </div>
}

function HorizontalBars({ rows, empty = 'No records found for this period.' }) {
  if (!rows.length) return <div className="analytics-empty-state">{empty}</div>
  const max = Math.max(1, ...rows.map(row => row.value))
  return <div className="analytics-horizontal-bars">{rows.map(row => <div className="analytics-hbar" key={row.label}>
    <div className="analytics-hbar-head"><span title={row.label}>{row.label}</span><b>{count(row.value)}</b></div>
    <div className="analytics-hbar-track"><i style={{ width: Math.max(row.value ? 2 : 0, row.value / max * 100) + '%' }}/></div>
  </div>)}</div>
}

function Donut({ rows, total }) {
  const palette = ['#237b63', '#80ad9d', '#d6a45d', '#9aa9b7', '#c6d5cf']
  let offset = 0
  return <div className="analytics-donut-layout">
    <div className="analytics-donut">
      <svg viewBox="0 0 120 120" role="img" aria-label={'Property type distribution, ' + total + ' listings'}>
        <circle cx="60" cy="60" r="43" className="analytics-donut-track"/>
        {rows.map((row, index) => {
          const portion = total ? row.value / total * 270.2 : 0
          const circle = <circle key={row.label} cx="60" cy="60" r="43" fill="none" stroke={palette[index % palette.length]} strokeWidth="13" strokeDasharray={portion + ' 270.2'} strokeDashoffset={-offset} transform="rotate(-90 60 60)"/>
          offset += portion
          return circle
        })}
        <text x="60" y="57" className="analytics-donut-total">{count(total)}</text>
        <text x="60" y="69" className="analytics-donut-caption">Listings</text>
      </svg>
    </div>
    <div className="analytics-donut-legend">{rows.map((row, index) => <div key={row.label}><i style={{ background: palette[index % palette.length] }}/><span>{row.label}</span><b>{count(row.value)}</b></div>)}</div>
  </div>
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState({ listings: [], enquiries: [], profiles: [], partners: [] })
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [range, setRange] = useState('month')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [refreshedAt, setRefreshedAt] = useState(null)

  const load = async () => {
    setBusy(true)
    setError('')
    try {
      const [listings, enquiries, profiles, partners] = await Promise.all([
        supabase.from('listings').select('id,title,status,property_type,price,created_at,partner_id,listing_tag,city,district'),
        supabase.from('enquiries').select('id,listing_id,created_at,status,assigned_to,listings(id,title,city,district,property_type)'),
        supabase.from('profiles').select('id,role,created_at'),
        supabase.from('partners').select('id,name,is_active')
      ])
      const failed = [listings, enquiries, profiles, partners].find(result => result.error)
      if (failed) throw failed.error
      setData({ listings: listings.data || [], enquiries: enquiries.data || [], profiles: profiles.data || [], partners: partners.data || [] })
      setRefreshedAt(new Date())
    } catch (err) {
      setError(err?.message || 'Unable to load analytics. Check admin database access and try again.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const now = new Date()
    let from = null
    let to = null
    if (range === 'today') from = startOfDay(now)
    if (range === 'week') {
      from = startOfDay(now)
      from.setDate(from.getDate() - ((from.getDay() + 6) % 7))
    }
    if (range === 'month') from = new Date(now.getFullYear(), now.getMonth(), 1)
    if (range === 'year') from = new Date(now.getFullYear(), 0, 1)
    if (range === 'custom') {
      from = fromDate ? new Date(fromDate + 'T00:00:00') : null
      to = toDate ? new Date(toDate + 'T23:59:59.999') : null
    }
    const inside = value => {
      const date = new Date(value)
      return !Number.isNaN(date.getTime()) && (!from || date >= from) && (!to || date <= to)
    }
    return {
      listings: data.listings.filter(row => inside(row.created_at)),
      enquiries: data.enquiries.filter(row => inside(row.created_at)),
      profiles: data.profiles.filter(row => inside(row.created_at))
    }
  }, [data, range, fromDate, toDate])

  const stats = useMemo(() => ({
    totalListings: data.listings.length,
    activeListings: data.listings.filter(row => row.status === 'approved').length,
    pendingListings: data.listings.filter(row => row.status === 'pending').length,
    rejectedListings: data.listings.filter(row => row.status === 'rejected').length,
    partners: data.partners.length,
    activePartners: data.partners.filter(row => row.is_active === true).length,
    buyers: data.profiles.filter(row => row.role === 'buyer').length,
    enquiries: filtered.enquiries.length,
    newListings: filtered.listings.length,
    newBuyers: filtered.profiles.filter(row => row.role === 'buyer').length
  }), [data, filtered])

  const monthly = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1)
      const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0')
      return {
        key,
        label: date.toLocaleDateString('en-IN', { month: 'short' }),
        listings: data.listings.filter(row => dateKey(row.created_at).startsWith(key)).length,
        enquiries: data.enquiries.filter(row => dateKey(row.created_at).startsWith(key)).length
      }
    })
  }, [data])

  const propertyTypes = useMemo(() => {
    const counts = {}
    filtered.listings.forEach(row => { const type = row.property_type || 'Not specified'; counts[type] = (counts[type] || 0) + 1 })
    return Object.entries(counts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  }, [filtered])

  const listingStatuses = useMemo(() => [
    { label: 'Published', value: filtered.listings.filter(row => row.status === 'approved').length },
    { label: 'Pending', value: filtered.listings.filter(row => row.status === 'pending').length },
    { label: 'Rejected', value: filtered.listings.filter(row => row.status === 'rejected').length }
  ], [filtered])

  const topProperties = useMemo(() => {
    const counts = new Map()
    filtered.enquiries.forEach(row => {
      const listing = row.listings
      if (!listing?.id) return
      const item = counts.get(listing.id) || { id: listing.id, title: listing.title || 'Untitled property', city: listing.city || listing.district || 'Location not added', enquiries: 0 }
      item.enquiries += 1
      counts.set(listing.id, item)
    })
    return [...counts.values()].sort((a, b) => b.enquiries - a.enquiries).slice(0, 5)
  }, [filtered])

  const partnerPerformance = useMemo(() => data.partners.map(partner => {
    const propertyIds = new Set(data.listings.filter(listing => listing.partner_id === partner.id).map(listing => listing.id))
    const enquiries = data.enquiries.filter(enquiry => propertyIds.has(enquiry.listing_id)).length
    return { id: partner.id, name: partner.name || 'Unnamed partner', properties: propertyIds.size, enquiries, active: partner.is_active === true }
  }).sort((a, b) => b.enquiries - a.enquiries || b.properties - a.properties || a.name.localeCompare(b.name)), [data])

  const enquiryStatuses = useMemo(() => {
    const statuses = new Map()
    filtered.enquiries.forEach(enquiry => {
      const key = enquiry.status || 'Not specified'
      statuses.set(key, (statuses.get(key) || 0) + 1)
    })
    return [...statuses.entries()].map(([label, value]) => ({ label: label.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase()), value })).sort((a, b) => b.value - a.value)
  }, [filtered])

  const label = range === 'today' ? 'Today' : range === 'week' ? 'This week' : range === 'month' ? 'This month' : range === 'year' ? 'This year' : range === 'all' ? 'All time' : 'Custom date range'

  const exportAll = () => {
    const rows = [
      ['MrSa Properties · Admin Analytics', label],
      ['Metric', 'Value'],
      ['Total properties', stats.totalListings],
      ['Published properties', stats.activeListings],
      ['Pending approvals', stats.pendingListings],
      ['Rejected properties', stats.rejectedListings],
      ['Channel partners', stats.partners],
      ['Active partners', stats.activePartners],
      ['Total buyers', stats.buyers],
      ['Enquiries in selected period', stats.enquiries],
      [],
      ['Monthly activity', 'Enquiries', 'New listings'],
      ...monthly.map(row => [row.label, row.enquiries, row.listings]),
      [],
      ['Property type', 'Listings'],
      ...propertyTypes.map(row => [row.label, row.value]),
      [],
      ['Channel partner', 'Properties', 'Enquiries'],
      ...partnerPerformance.map(row => [row.name, row.properties, row.enquiries]),
      [],
      ['Enquiry status', 'Count'],
      ...enquiryStatuses.map(row => [row.label, row.value]),
      [],
      ['Most enquired properties', 'Enquiries'],
      ...topProperties.map(row => [row.title, row.enquiries])
    ]
    downloadCsv('mrsa-admin-analytics-' + new Date().toISOString().slice(0, 10) + '.csv', rows)
  }

  return <section className="section page-section admin-analytics">
    <div className="analytics-heading">
      <div><span className="eyebrow">MRSA PROPERTIES · ADMIN</span><h1>Business overview</h1><p className="muted">Monitor marketplace activity, enquiries and partner performance in one place.</p></div>
      <div className="analytics-actions">
        <button className="btn btn-outline" onClick={load} disabled={busy}><RefreshCw size={15}/> Refresh</button>
        <button className="btn btn-primary" onClick={exportAll} disabled={busy}><FileSpreadsheet size={15}/> Export report</button>
        <button className="btn btn-outline" onClick={() => window.print()} disabled={busy}><Printer size={15}/> Print / PDF</button>
      </div>
    </div>

    <div className="analytics-toolbar">
      <label><CalendarDays size={16}/><span>Report period</span>
        <select value={range} onChange={event => setRange(event.target.value)}>
          <option value="today">Today</option><option value="week">This week</option><option value="month">This month</option><option value="year">This year</option><option value="custom">Custom dates</option><option value="all">All time</option>
        </select>
      </label>
      {range === 'custom' && <><label className="analytics-date-label"><span>From</span><input type="date" value={fromDate} max={toDate || undefined} onChange={event => setFromDate(event.target.value)}/></label><label className="analytics-date-label"><span>To</span><input type="date" value={toDate} min={fromDate || undefined} onChange={event => setToDate(event.target.value)}/></label></>}
      <span className="analytics-updated">{refreshedAt ? 'Last updated ' + refreshedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Waiting for data'}</span>
    </div>

    {error && <div className="analytics-error" role="alert"><span>{error}</span><button className="btn btn-outline" onClick={load}>Try again</button></div>}
    {busy ? <div className="analytics-loading">Loading dashboard data…</div> : !error && <>
      <div className="analytics-section-caption"><div><h2>Platform at a glance</h2><p>Current totals and activity for {label.toLowerCase()}.</p></div></div>
      <div className="analytics-metrics">
        <MetricCard icon={Building2} label="Total properties" value={stats.totalListings} note={count(stats.activeListings) + ' published · ' + count(stats.pendingListings) + ' pending'} tone="green"/>
        <MetricCard icon={CheckCircle2} label="Published properties" value={stats.activeListings} note={count(stats.rejectedListings) + ' rejected'} tone="blue"/>
        <MetricCard icon={Users} label="Channel partners" value={stats.partners} note={count(stats.activePartners) + ' currently active'} tone="violet"/>
        <MetricCard icon={UserRound} label="Registered buyers" value={stats.buyers} note={count(stats.newBuyers) + ' new in selected period'} tone="amber"/>
        <MetricCard icon={MessageSquare} label="New enquiries" value={stats.enquiries} note={'Received ' + label.toLowerCase()} tone="teal"/>
        <MetricCard icon={Clock3} label="Awaiting approval" value={stats.pendingListings} note="Properties pending review" tone="rose"/>
      </div>

      <div className="analytics-section-caption analytics-section-spaced"><div><h2>Activity & insights</h2><p>Understand listing trends, demand and marketplace performance.</p></div></div>
      <div className="analytics-grid">
        <Panel title="Marketplace activity" subtitle="Monthly enquiries and new listings · last 12 months" icon={TrendingUp} className="analytics-panel-wide analytics-panel-trend">
          <TrendChart rows={monthly}/>
        </Panel>
        <Panel title="Property mix" subtitle={'Property types added · ' + label} icon={Building2} className="analytics-panel-mix">
          {propertyTypes.length ? <Donut rows={propertyTypes} total={filtered.listings.length}/> : <div className="analytics-empty-state">No property listings in this period.</div>}
        </Panel>
        <Panel title="Listing approval status" subtitle={'Review pipeline · ' + label} icon={CheckCircle2} className="analytics-panel-third">
          <HorizontalBars rows={listingStatuses}/>
        </Panel>
        <Panel title="Most enquired properties" subtitle="Top five properties by enquiry volume" icon={TrendingUp} className="analytics-panel-third">
          {topProperties.length ? <div className="analytics-ranking-table"><div className="analytics-table-head"><span>PROPERTY</span><span>ENQUIRIES</span></div>{topProperties.map((row, index) => <div className="analytics-table-row" key={row.id}><span className="analytics-rank">{String(index + 1).padStart(2, '0')}</span><span className="analytics-property-name"><b>{row.title}</b><small>{row.city}</small></span><strong>{count(row.enquiries)}</strong></div>)}</div> : <div className="analytics-empty-state">No property enquiries in this period.</div>}
        </Panel>
        <Panel title="Enquiry pipeline" subtitle={'Enquiry status breakdown · ' + label} icon={Activity} className="analytics-panel-third">
          {enquiryStatuses.length ? <HorizontalBars rows={enquiryStatuses}/> : <div className="analytics-empty-state">No enquiries in this period.</div>}
        </Panel>
        <Panel title="Channel partner leaderboard" subtitle="Ranked by enquiries, then active property listings" icon={Users} className="analytics-panel-wide analytics-panel-partners">
          {partnerPerformance.length ? <div className="analytics-partner-table"><div className="analytics-table-head"><span>CHANNEL PARTNER</span><span>STATUS</span><span>PROPERTIES</span><span>ENQUIRIES</span></div>{partnerPerformance.map((partner, index) => <div className="analytics-partner-row" key={partner.id}><span className="analytics-partner-name"><i>{String(index + 1).padStart(2, '0')}</i><b>{partner.name}</b></span><span><em className={partner.active ? 'partner-active' : 'partner-inactive'}>{partner.active ? 'Active' : 'Inactive'}</em></span><strong>{count(partner.properties)}</strong><strong>{count(partner.enquiries)}</strong></div>)}</div> : <div className="analytics-empty-state">No channel partners found.</div>}
        </Panel>
        <Panel title="Buy vs rent distribution" subtitle="Marketplace listing category report" icon={Building2} className="analytics-panel-half">
          <div className="analytics-unavailable"><span><Activity size={18}/></span><b>Rental listings are not enabled</b><p>The current property submission form supports sale listings. Enable a rent / sale listing category before comparing these segments.</p></div>
        </Panel>
        <Panel title="Property views" subtitle="Most viewed property report" icon={Eye} className="analytics-panel-half">
          <div className="analytics-unavailable"><span><Eye size={18}/></span><b>View tracking is not enabled</b><p>Property detail visits are not currently recorded. Add a view-events table to report verified views and most-viewed properties.</p></div>
        </Panel>
      </div>
    </>}

    <div className="analytics-footer"><span>Live figures are calculated from Supabase records available to your admin account.</span><Link to="/admin">← Back to Admin dashboard</Link></div>
  </section>
}
