import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Building2, CalendarDays, Download, RefreshCw, Users, UserRound, MessageSquare, CheckCircle2, Clock3, TrendingUp, Eye, FileSpreadsheet, Printer } from 'lucide-react'
import { supabase } from '../lib/supabase'

const dateKey = value => {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const formatCount = value => new Intl.NumberFormat('en-IN').format(value || 0)
const monthLabel = date => date.toLocaleDateString('en-IN', { month: 'short' })
const csv = value => '"' + String(value ?? '').replaceAll('"', '""') + '"'
const downloadCsv = (name, rows) => {
  const body = '\uFEFF' + rows.map(row => row.map(csv).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function Panel({ title, subtitle, icon: Icon, children, className = '' }) {
  return <article className={'analytics-panel ' + className}>
    <div className="analytics-panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{Icon && <Icon size={18} aria-hidden="true"/>}</div>
    {children}
  </article>
}

function Bars({ rows, empty = 'No records for this period.' }) {
  const max = Math.max(1, ...rows.map(row => row.value))
  if (!rows.length) return <p className="analytics-empty">{empty}</p>
  return <div className="analytics-bars">{rows.map(row => <div className="analytics-bar-row" key={row.label}>
    <span title={row.label}>{row.label}</span><div className="analytics-bar-track"><i style={{ width: Math.max(2, row.value / max * 100) + '%' }}/></div><b>{formatCount(row.value)}</b>
  </div>)}</div>
}

function TrendChart({ rows, label }) {
  const max = Math.max(1, ...rows.map(row => row.value))
  const points = rows.map((row, index) => {
    const x = rows.length === 1 ? 50 : 8 + index * 84 / (rows.length - 1)
    const y = 86 - row.value / max * 70
    return x + ',' + y
  }).join(' ')
  return <div className="analytics-trend">
    <svg viewBox="0 0 100 100" role="img" aria-label={label + ' monthly trend'} preserveAspectRatio="none">
      {[16, 39, 62, 86].map(y => <line key={y} x1="5" x2="95" y1={y} y2={y} className="analytics-grid-line"/> )}
      {rows.length > 1 && <polyline points={points} className="analytics-trend-line"/>}
      {rows.map((row, index) => {
        const x = rows.length === 1 ? 50 : 8 + index * 84 / (rows.length - 1)
        const y = 86 - row.value / max * 70
        return <circle key={row.label} cx={x} cy={y} r="1.8" className="analytics-trend-dot"><title>{row.label}: {row.value}</title></circle>
      })}
    </svg>
    <div className="analytics-trend-labels">{rows.map(row => <span key={row.label}>{row.label}</span>)}</div>
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
      const [listingResult, enquiryResult, profileResult, partnerResult] = await Promise.all([
        supabase.from('listings').select('id,title,status,property_type,price,created_at,partner_id'),
        supabase.from('enquiries').select('id,listing_id,created_at,status,assigned_to,listings(id,title,city,district,property_type)'),
        supabase.from('profiles').select('id,role,created_at'),
        supabase.from('partners').select('id,name,is_active')
      ])
      const failed = [listingResult, enquiryResult, profileResult, partnerResult].find(result => result.error)
      if (failed) throw failed.error
      setData({
        listings: listingResult.data || [],
        enquiries: enquiryResult.data || [],
        profiles: profileResult.data || [],
        partners: partnerResult.data || []
      })
      setRefreshedAt(new Date())
    } catch (e) {
      setError(e?.message || 'Unable to load analytics. Check the admin database permissions and try again.')
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
      const d = new Date(value)
      return !Number.isNaN(d.getTime()) && (!from || d >= from) && (!to || d <= to)
    }
    return {
      listings: data.listings.filter(row => inside(row.created_at)),
      enquiries: data.enquiries.filter(row => inside(row.created_at)),
      profiles: data.profiles.filter(row => inside(row.created_at))
    }
  }, [data, range, fromDate, toDate])

  const stats = useMemo(() => {
    const listings = filtered.listings
    const enquiries = filtered.enquiries
    const profiles = filtered.profiles
    return {
      totalListings: data.listings.length,
      activeListings: data.listings.filter(row => row.status === 'approved').length,
      pendingListings: data.listings.filter(row => row.status === 'pending').length,
      partners: data.partners.length,
      activePartners: data.partners.filter(row => row.is_active === true).length,
      buyers: data.profiles.filter(row => row.role === 'buyer').length,
      enquiries: enquiries.length,
      newListings: listings.length,
      newBuyers: profiles.filter(row => row.role === 'buyer').length,
      pendingApprovals: data.listings.filter(row => row.status === 'pending').length
    }
  }, [data, filtered])

  const monthly = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1)
      const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0')
      return {
        label: monthLabel(date),
        listings: data.listings.filter(row => dateKey(row.created_at).startsWith(key)).length,
        enquiries: data.enquiries.filter(row => dateKey(row.created_at).startsWith(key)).length
      }
    })
  }, [data])

  const propertyTypes = useMemo(() => {
    const counts = {}
    filtered.listings.forEach(row => { const key = row.property_type || 'Not specified'; counts[key] = (counts[key] || 0) + 1 })
    return Object.entries(counts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
  }, [filtered])

  const listingStatuses = useMemo(() => ['approved', 'pending', 'rejected'].map(status => ({
    label: status === 'approved' ? 'Published' : status === 'pending' ? 'Pending' : 'Rejected',
    value: filtered.listings.filter(row => row.status === status).length
  })), [filtered])

  const topProperties = useMemo(() => {
    const counts = new Map()
    filtered.enquiries.forEach(row => {
      const listing = row.listings
      if (!listing?.id) return
      const current = counts.get(listing.id) || { id: listing.id, title: listing.title || 'Property', city: listing.city || '', count: 0 }
      current.count++
      counts.set(listing.id, current)
    })
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5)
  }, [filtered])

  const partnerPerformance = useMemo(() => {
    const listingPartner = new Map(data.listings.filter(row => row.partner_id).map(row => [row.id, row.partner_id]))
    return data.partners.map(partner => {
      const propertyIds = new Set(data.listings.filter(row => row.partner_id === partner.id).map(row => row.id))
      const leadCount = data.enquiries.filter(row => propertyIds.has(row.listing_id)).length
      return { name: partner.name, properties: propertyIds.size, enquiries: leadCount, active: partner.is_active }
    }).sort((a, b) => b.enquiries - a.enquiries || b.properties - a.properties).slice(0, 8)
  }, [data])

  const label = range === 'today' ? 'Today' : range === 'week' ? 'This week' : range === 'month' ? 'This month' : range === 'year' ? 'This year' : range === 'all' ? 'All time' : 'Custom date range'
  const exportAll = () => {
    const rows = [
      ['MrSa Properties Admin Analytics', label],
      ['Metric', 'Value'],
      ['Total properties', stats.totalListings],
      ['Active properties', stats.activeListings],
      ['Pending approvals', stats.pendingApprovals],
      ['Channel partners', stats.partners],
      ['Active partners', stats.activePartners],
      ['Buyers', stats.buyers],
      ['Enquiries in selected period', stats.enquiries],
      [],
      ['Monthly trend', 'Property listings', 'Enquiries'],
      ...monthly.map(row => [row.label, row.listings, row.enquiries]),
      [],
      ['Property type', 'Listings'],
      ...propertyTypes.map(row => [row.label, row.value]),
      [],
      ['Channel partner', 'Properties', 'Enquiries'],
      ...partnerPerformance.map(row => [row.name, row.properties, row.enquiries]),
      [],
      ['Most enquired properties', 'Enquiries'],
      ...topProperties.map(row => [row.title, row.count])
    ]
    downloadCsv('mrsa-admin-analytics-' + new Date().toISOString().slice(0, 10) + '.csv', rows)
  }

  return <section className="section page-section admin-analytics">
    <div className="analytics-heading">
      <div><span className="eyebrow">MRSA PROPERTIES · ADMIN</span><h1>Analytics dashboard</h1><p className="muted">A clear overview of listings, buyers, channel partners and enquiries.</p></div>
      <div className="analytics-actions">
        <button className="btn btn-outline" onClick={load} disabled={busy}><RefreshCw size={15}/> Refresh</button>
        <button className="btn btn-primary" onClick={exportAll} disabled={busy}><FileSpreadsheet size={15}/> Export CSV</button>
        <button className="btn btn-outline" onClick={() => window.print()} disabled={busy}><Printer size={15}/> Print / PDF</button>
      </div>
    </div>

    <div className="analytics-filters">
      <label><CalendarDays size={16}/> Report period
        <select value={range} onChange={e => setRange(e.target.value)}>
          <option value="today">Today</option><option value="week">This week</option><option value="month">This month</option><option value="year">This year</option><option value="custom">Custom date range</option><option value="all">All time</option>
        </select>
      </label>
      {range === 'custom' && <><label>From<input type="date" value={fromDate} max={toDate || undefined} onChange={e => setFromDate(e.target.value)}/></label><label>To<input type="date" value={toDate} min={fromDate || undefined} onChange={e => setToDate(e.target.value)}/></label></>}
      <span className="analytics-period-note">{label}{refreshedAt ? ' · Updated ' + refreshedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
    </div>

    {error && <div className="analytics-error" role="alert">{error}<button className="btn btn-outline" onClick={load}>Try again</button></div>}
    {busy ? <div className="analytics-loading">Loading live analytics from Supabase…</div> : !error && <>
      <div className="analytics-kpis">
        <article><span><Building2 size={18}/></span><small>Total properties</small><strong>{formatCount(stats.totalListings)}</strong><em>{formatCount(stats.activeListings)} published · {formatCount(stats.pendingListings)} pending</em></article>
        <article><span><CheckCircle2 size={18}/></span><small>Active properties</small><strong>{formatCount(stats.activeListings)}</strong><em>{formatCount(data.listings.filter(row => row.status === 'rejected').length)} rejected</em></article>
        <article><span><Users size={18}/></span><small>Channel partners</small><strong>{formatCount(stats.partners)}</strong><em>{formatCount(stats.activePartners)} active</em></article>
        <article><span><UserRound size={18}/></span><small>Total buyers</small><strong>{formatCount(stats.buyers)}</strong><em>{formatCount(stats.newBuyers)} registered in period</em></article>
        <article><span><MessageSquare size={18}/></span><small>Enquiries</small><strong>{formatCount(stats.enquiries)}</strong><em>{label.toLowerCase()}</em></article>
        <article><span><Clock3 size={18}/></span><small>Pending approvals</small><strong>{formatCount(stats.pendingApprovals)}</strong><em>Listings awaiting review</em></article>
      </div>

      <div className="analytics-grid">
        <Panel title="Monthly enquiry trends" subtitle="Enquiries received over the last 12 months." icon={TrendingUp} className="analytics-panel-wide">
          <TrendChart rows={monthly.map(row => ({ label: row.label, value: row.enquiries }))} label="Enquiries"/>
        </Panel>
        <Panel title="Monthly property listings" subtitle="New listings created over the last 12 months." icon={Activity}>
          <Bars rows={monthly.slice(-6).map(row => ({ label: row.label, value: row.listings }))}/>
        </Panel>
        <Panel title="Property type distribution" subtitle={'Listings created · ' + label} icon={Building2}>
          <Bars rows={propertyTypes}/>
        </Panel>
        <Panel title="Listing status" subtitle={'Approval breakdown · ' + label} icon={CheckCircle2}>
          <Bars rows={listingStatuses}/>
        </Panel>
        <Panel title="Top enquired properties" subtitle="Ranked by enquiry count, not page views." icon={TrendingUp}>
          {topProperties.length ? <div className="analytics-ranking">{topProperties.map((row, index) => <div key={row.id}><b>{index + 1}</b><span>{row.title}<small>{row.city}</small></span><strong>{row.count} enquiries</strong></div>)}</div> : <p className="analytics-empty">No property enquiries in this period.</p>}
        </Panel>
        <Panel title="Channel partner performance" subtitle="Properties and enquiries linked to each partner." icon={Users}>
          {partnerPerformance.length ? <div className="analytics-ranking">{partnerPerformance.map((row, index) => <div key={row.name}><b>{index + 1}</b><span>{row.name}<small>{row.active ? 'Active partner' : 'Inactive partner'}</small></span><strong>{row.enquiries} enquiries · {row.properties} listings</strong></div>)}</div> : <p className="analytics-empty">No channel partner records found.</p>}
        </Panel>
        <Panel title="Buy vs rent distribution" subtitle="Current marketplace listing scope." icon={Building2}>
          <div className="analytics-note"><b>Sale listings only</b><p>The current MrSa Properties listing workflow is configured for properties for sale. Rental listings are not enabled, so a buy-vs-rent comparison would be misleading.</p></div>
        </Panel>
        <Panel title="Property views" subtitle="Most viewed property report." icon={Eye}>
          <div className="analytics-note"><b>View tracking is not configured yet</b><p>This project currently records enquiries, but no verified property-view events table was found in the dashboard data sources. This report will become available after view tracking is implemented.</p></div>
        </Panel>
      </div>
    </>}

    <div className="analytics-footer"><span>Analytics are calculated from records your admin account is permitted to read.</span><Link to="/admin">← Back to Admin listing management</Link></div>
  </section>
}
