import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, FileUp, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'

const checklist = [
  ['contact_checked', 'Owner / contact details checked'],
  ['location_checked', 'Property location information checked'],
  ['photos_checked', 'Property photographs reviewed'],
  ['price_area_checked', 'Price and area information checked'],
  ['duplicate_checked', 'Duplicate listing check completed']
]
const statuses = [
  ['not_started', 'Not started'], ['in_review', 'In review'],
  ['details_reviewed', 'Details reviewed'], ['documents_reviewed', 'Documents reviewed'],
  ['site_visit_completed', 'Site visit completed'], ['needs_correction', 'Needs correction'], ['rejected', 'Rejected']
]

export default function AdminVerificationPage() {
  const [listings, setListings] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [verification, setVerification] = useState(null)
  const [checks, setChecks] = useState({})
  const [documents, setDocuments] = useState([])
  const [reports, setReports] = useState([])
  const [reviewStatus, setReviewStatus] = useState('not_started')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const selected = useMemo(() => listings.find(item => item.id === selectedId), [listings, selectedId])
  const loadListings = async () => {
    const { data, error } = await supabase.from('listings').select('id,title,city,locality,status,created_at').order('created_at', { ascending: false })
    if (error) { setMessage(error.message); return }
    setListings(data || [])
    if (!selectedId && data?.length) setSelectedId(data[0].id)
  }
  const loadReview = async id => {
    if (!id) return
    setMessage('')
    const [v, c, d, r] = await Promise.all([
      supabase.from('listing_verifications').select('*').eq('listing_id', id).maybeSingle(),
      supabase.from('listing_verification_checks').select('*').eq('listing_id', id),
      supabase.from('listing_documents').select('*').eq('listing_id', id).order('created_at', { ascending: false }),
      supabase.from('listing_reports').select('*').eq('listing_id', id).order('created_at', { ascending: false })
    ])
    const failure = [v, c, d, r].find(result => result.error)
    if (failure) { setMessage(failure.error.message); return }
    setVerification(v.data || null)
    setReviewStatus(v.data?.review_status || 'not_started')
    setNotes(v.data?.admin_notes || '')
    setChecks(Object.fromEntries((c.data || []).map(item => [item.check_key, item.is_complete])))
    setDocuments(d.data || [])
    setReports(r.data || [])
  }
  useEffect(() => { loadListings() }, [])
  useEffect(() => { if (selectedId) loadReview(selectedId) }, [selectedId])

  const saveReview = async () => {
    if (!selectedId || busy) return
    setBusy(true); setMessage('')
    const now = new Date().toISOString()
    const { data: authData } = await supabase.auth.getUser()
    const reviewer = authData?.user?.id || null
    const { error: verifyError } = await supabase.from('listing_verifications').upsert({
      listing_id: selectedId, review_status: reviewStatus, admin_notes: notes.trim() || null,
      reviewed_by: reviewer, reviewed_at: now, updated_at: now
    }, { onConflict: 'listing_id' })
    if (verifyError) { setMessage(verifyError.message); setBusy(false); return }
    const rows = checklist.map(([key, label]) => ({
      listing_id: selectedId, check_key: key, check_label: label,
      is_complete: Boolean(checks[key]), checked_by: checks[key] ? reviewer : null,
      checked_at: checks[key] ? now : null
    }))
    const { error: checkError } = await supabase.from('listing_verification_checks').upsert(rows, { onConflict: 'listing_id,check_key' })
    if (checkError) { setMessage(checkError.message); setBusy(false); return }
    const { data: docs, error: docsError } = await supabase.from('listing_documents').select('review_status').eq('listing_id', selectedId)
    if (docsError) { setMessage(docsError.message); setBusy(false); return }
    const badge = {
      listing_id: selectedId,
      contact_checked: Boolean(checks.contact_checked),
      location_checked: Boolean(checks.location_checked),
      photos_checked: Boolean(checks.photos_checked),
      price_area_checked: Boolean(checks.price_area_checked),
      documents_reviewed: Boolean(docs?.length && docs.every(doc => doc.review_status === 'reviewed')),
      site_visit_completed: reviewStatus === 'site_visit_completed',
      public_reviewed_at: now,
      updated_at: now
    }
    const { error: badgeError } = await supabase.from('listing_trust_badges').upsert(badge, { onConflict: 'listing_id' })
    setBusy(false)
    if (badgeError) setMessage(badgeError.message)
    else { setMessage('Verification review saved. Only completed checks are shown to buyers.'); await loadReview(selectedId) }
  }

  const uploadDocument = async event => {
    event.preventDefault()
    if (!file || !selected || busy) return
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setMessage('Choose a PDF, JPG, PNG or WebP file up to 10 MB.')
      return
    }
    setBusy(true); setMessage('')
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = selectedId + '/' + Date.now() + '-' + safeName
    const upload = await supabase.storage.from('listing-documents').upload(path, file, { upsert: false })
    if (upload.error) { setMessage(upload.error.message); setBusy(false); return }
    const { error } = await supabase.from('listing_documents').insert({
      listing_id: selectedId, storage_path: path, file_name: file.name,
      content_type: file.type, uploaded_by: (await supabase.auth.getUser()).data.user?.id || null
    })
    if (error) {
      await supabase.storage.from('listing-documents').remove([path])
      setMessage(error.message)
    } else { setFile(null); setMessage('Document uploaded to private storage. It is not yet marked as reviewed.'); await loadReview(selectedId) }
    setBusy(false)
  }

  const markDocument = async (doc, status) => {
    const { data } = await supabase.auth.getUser()
    const now = new Date().toISOString()
    const { error } = await supabase.from('listing_documents').update({
      review_status: status, reviewed_by: status === 'reviewed' ? data.user?.id : null,
      reviewed_at: status === 'reviewed' ? now : null
    }).eq('id', doc.id)
    if (error) setMessage(error.message)
    else { setMessage('Document review status updated. Save the overall review to refresh buyer-facing trust information.'); await loadReview(selectedId) }
  }

  const openDocument = async doc => {
    const { data, error } = await supabase.storage.from('listing-documents').createSignedUrl(doc.storage_path, 60)
    if (error) setMessage(error.message)
    else window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const updateReport = async (report, status) => {
    const { data } = await supabase.auth.getUser()
    const { error } = await supabase.from('listing_reports').update({
      report_status: status, reviewed_by: data.user?.id || null, reviewed_at: new Date().toISOString()
    }).eq('id', report.id)
    if (error) setMessage(error.message)
    else { setMessage('Buyer report updated.'); await loadReview(selectedId) }
  }

  return <section className="section page-section admin-verification-page">
    <div className="section-heading"><div><span className="eyebrow">PLATFORM TRUST & SAFETY</span><h1>Property verification</h1><p className="muted">Review listing details, record checks and handle buyer reports. These checks do not certify legal title.</p></div><Link className="btn btn-outline" to="/admin">Back to admin</Link></div>
    {message && <p className="notice" role="status">{message}</p>}
    <div className="verification-layout">
      <aside className="verification-sidebar">
        <label>Choose a property<select value={selectedId} onChange={event => setSelectedId(event.target.value)}><option value="">Select property</option>{listings.map(item => <option key={item.id} value={item.id}>{item.title} — {item.city} ({item.status})</option>)}</select></label>
        <button type="button" className="btn btn-outline full" onClick={loadListings}><RefreshCw size={15}/> Refresh listings</button>
        <small>{listings.length} listings available for review</small>
      </aside>
      {selected ? <div className="verification-main">
        <div className="verification-card"><span className="eyebrow">SELECTED LISTING</span><h2>{selected.title}</h2><p className="muted">{selected.locality ? selected.locality + ', ' : ''}{selected.city} · Listing status: {selected.status}</p>
          <label>Review status<select value={reviewStatus} onChange={event => setReviewStatus(event.target.value)}>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Internal admin notes<textarea rows="3" maxLength="4000" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Private notes for the admin team only."/></label>
          <h3>Listing checklist</h3>
          <div className="verification-checklist">{checklist.map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(checks[key])} onChange={event => setChecks(old => ({ ...old, [key]: event.target.checked }))}/><span>{label}</span></label>)}</div>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={saveReview}>{busy ? 'Saving…' : 'Save verification review'}</button>
        </div>
        <div className="verification-card"><h3>Private property documents</h3><p className="muted">Only authorised admins can access these files. Uploading a document does not mean it has been verified.</p>
          <form className="verification-upload" onSubmit={uploadDocument}><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={event => setFile(event.target.files?.[0] || null)}/><button className="btn btn-outline" disabled={!file || busy}><FileUp size={15}/> Upload privately</button></form>
          {documents.length ? <div className="verification-document-list">{documents.map(doc => <div key={doc.id}><div><b>{doc.file_name}</b><small>{doc.review_status.replaceAll('_', ' ')}</small></div><button type="button" className="btn btn-outline" onClick={() => openDocument(doc)}><ExternalLink size={14}/> Open</button><select aria-label={'Review status for ' + doc.file_name} value={doc.review_status} onChange={event => markDocument(doc, event.target.value)}><option value="received">Received</option><option value="reviewed">Reviewed</option><option value="needs_replacement">Needs replacement</option></select></div>)}</div> : <p className="muted">No documents uploaded for this listing.</p>}
        </div>
        <div className="verification-card"><h3>Buyer reports ({reports.length})</h3>{reports.length ? reports.map(report => <article className="verification-report" key={report.id}><div><b>{report.reason.replaceAll('_', ' ')}</b><small>{new Date(report.created_at).toLocaleString('en-IN')} · {report.report_status}</small><p>{report.details || 'No additional details supplied.'}</p></div><select aria-label="Report status" value={report.report_status} onChange={event => updateReport(report, event.target.value)}><option value="open">Open</option><option value="investigating">Investigating</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select></article>) : <p className="muted">No buyer reports for this listing.</p>}</div>
      </div> : <div className="empty"><ShieldCheck size={28}/><h3>Select a property to begin</h3></div>}
    </div>
  </section>
}
