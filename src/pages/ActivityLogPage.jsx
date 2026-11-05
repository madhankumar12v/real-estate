import { useEffect, useState } from 'react'
import { RefreshCw, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function ActivityLogPage() {
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setBusy(true)
    const { data, error } = await supabase
      .from('admin_activity_logs')
      .select('id, actor_id, entity_type, record_id, action, details, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    setRows(data || [])
    setError(error?.message || '')
    setBusy(false)
  }

  useEffect(() => { load() }, [])

  return (
    <section className="section page-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">PLATFORM SECURITY</span>
          <h1>Admin activity log</h1>
          <p className="muted">Recent listing, enquiry and report changes. Contact details and private messages are not stored here.</p>
        </div>
        <button className="btn btn-outline" onClick={load}><RefreshCw size={15}/> Refresh</button>
      </div>
      {error && <p className="notice">{error}</p>}
      {busy ? <p>Loading activity…</p> : rows.length ? (
        <div className="dashboard-list">
          {rows.map(row => (
            <article className="dashboard-row" key={row.id}>
              <div className="row-grow">
                <b>{row.action} · {row.entity_type.replace('_', ' ')}</b>
                <p className="muted">{new Date(row.created_at).toLocaleString('en-IN')}</p>
                <small>Record: {row.record_id} · Actor: {row.actor_id || 'Anonymous / system'}</small>
                {row.details?.status && <span className="status status-pending">{row.details.status}</span>}
              </div>
              <ShieldCheck size={18}/>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty"><ShieldCheck size={28}/><h3>No activity recorded yet</h3><p>Changes will appear here after the security migration is run.</p></div>
      )}
    </section>
  )
}
