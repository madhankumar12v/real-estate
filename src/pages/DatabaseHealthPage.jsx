import { useCallback, useEffect, useState } from 'react'
import { Activity, Database, HardDrive, RefreshCw, Table2, Wifi, FolderOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const formatBytes = value => {
  const bytes = Number(value || 0)
  if (!bytes) return '0 bytes'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / (1024 ** index)).toFixed(index > 1 ? 2 : 1)} ${units[index]}`
}
const formatCount = value => new Intl.NumberFormat('en-IN').format(Number(value || 0))

export default function DatabaseHealthPage() {
  const [report, setReport] = useState(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('get_admin_database_health')
    if (rpcError) {
      setError(rpcError.message.includes('get_admin_database_health')
        ? 'Database health SQL has not been updated yet. Run supabase/database_health.sql in Supabase SQL Editor, then refresh this page.'
        : rpcError.message)
      setReport(null)
    } else {
      setReport(data)
    }
    setBusy(false)
  }, [])

  useEffect(() => { load() }, [load])

  const connections = report?.connections || {}
  const tables = report?.tables || []
  const storage = report?.storage || {}
  const buckets = storage.buckets || []
  // Supabase Free plan allowances; update these if the project moves to another plan.
  const databaseLimit = 500 * 1024 * 1024
  const storageLimit = 1 * 1024 * 1024 * 1024
  const databaseUsed = Number(report?.database_size_bytes || 0)
  const storageUsed = Number(storage.total_bytes || 0)
  const usageCards = [
    { title: 'Database storage', total: databaseLimit, used: databaseUsed, remaining: Math.max(databaseLimit - databaseUsed, 0), percent: Math.min(databaseUsed / databaseLimit * 100, 100) },
    { title: 'File storage', total: storageLimit, used: storageUsed, remaining: Math.max(storageLimit - storageUsed, 0), percent: Math.min(storageUsed / storageLimit * 100, 100) },
  ]
  const cards = [
    { label: 'Database size', value: formatBytes(report?.database_size_bytes), icon: Database },
    { label: 'Active connections', value: connections.active ?? '—', icon: Activity },
    { label: 'Idle connections', value: connections.idle ?? '—', icon: Wifi },
    { label: 'Total connections', value: connections.total ?? '—', icon: HardDrive },
  ]

  return <section className="section page-section database-health-page">
    <div className="section-heading">
      <div><span className="eyebrow">ADMIN TOOLS</span><h1>Database Health</h1><p className="muted">A read-only overview of database size, connections, storage buckets and largest public tables.</p></div>
      <button className="btn btn-outline" onClick={load} disabled={busy}><RefreshCw size={16}/> {busy ? 'Refreshing…' : 'Refresh report'}</button>
    </div>
    {error && <div className="notice" role="alert">{error}</div>}
    {busy && !report ? <p className="muted">Loading database health…</p> : report && <>
      <div className="database-health-grid">{cards.map(card => <article className="database-health-card" key={card.label}><span><card.icon size={18}/>{card.label}</span><strong>{card.value}</strong></article>)}</div>
      <div className="database-capacity-grid">
        {usageCards.map(item => <article className="database-capacity-card" key={item.title}>
          <div className="database-capacity-heading"><h2>{item.title}</h2><span>Free plan allowance</span></div>
          <div className="database-capacity-values">
            <div><span>Total</span><strong>{formatBytes(item.total)}</strong></div>
            <div><span>Used</span><strong>{formatBytes(item.used)}</strong></div>
            <div><span>Remaining</span><strong>{formatBytes(item.remaining)}</strong></div>
          </div>
          <div className="database-capacity-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={item.percent}>
            <span style={{ width: `${item.percent}%` }} />
          </div>
          <p className="database-health-footnote">{item.percent.toFixed(2)}% used · {Math.max(100 - item.percent, 0).toFixed(2)}% available</p>
        </article>)}
      </div>
      <div className="database-health-panel database-storage-panel">
        <div className="section-heading"><div><h2><FolderOpen size={20}/> File Storage Usage</h2><p className="muted">Actual stored object sizes across Supabase Storage buckets</p></div><span className="status status-approved">Read only</span></div>
        <div className="database-storage-summary">
          <div><span>File storage used</span><strong>{formatBytes(storage.total_bytes)}</strong></div>
          <div><span>Stored files</span><strong>{formatCount(storage.object_count)}</strong></div>
          <div><span>Storage buckets</span><strong>{formatCount(buckets.length)}</strong></div>
        </div>
        {buckets.length ? <div className="database-health-table-wrap"><table className="database-health-table"><thead><tr><th>Bucket</th><th>Files</th><th>Storage used</th></tr></thead><tbody>{buckets.map(bucket => <tr key={bucket.bucket_id}><td>{bucket.bucket_id}</td><td>{formatCount(bucket.object_count)}</td><td>{formatBytes(bucket.total_bytes)}</td></tr>)}</tbody></table></div> : <p className="muted">No storage buckets were returned.</p>}
        <p className="database-health-footnote">Usage is calculated from stored object metadata. Supabase platform billing may include additional overhead; this is an application-level estimate, not the official billing meter.</p>
      </div>
      <div className="database-health-panel database-tables-panel">
        <div className="section-heading"><div><h2><Table2 size={20}/> Largest tables</h2><p className="muted">Public schema · ordered by total size</p></div><span className="status status-approved">Read only</span></div>
        {tables.length ? <div className="database-health-table-wrap"><table className="database-health-table"><thead><tr><th>Table</th><th>Total size</th><th>Table data</th></tr></thead><tbody>{tables.map(row => <tr key={row.table_name}><td>{row.table_name}</td><td>{formatBytes(row.total_bytes)}</td><td>{formatBytes(row.data_bytes)}</td></tr>)}</tbody></table></div> : <p className="muted">No public tables were returned.</p>}
      </div>
      <p className="database-health-footnote">Last refreshed: {report.generated_at ? new Date(report.generated_at).toLocaleString() : '—'}. This report does not delete or modify data.</p>
    </>}
    <div className="database-health-note"><b>About Supabase memory</b><p>Memory usage and memory commitment are platform-level metrics. They are not exposed by this read-only SQL report, so check them in Supabase Reports rather than treating database size as RAM usage.</p><Link to="/admin">← Back to Admin Dashboard</Link></div>
  </section>
}
