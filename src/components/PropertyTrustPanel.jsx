import { useEffect, useState } from 'react'
import { ShieldCheck, MapPinCheck, UserCheck, Images, FileCheck2, Flag } from 'lucide-react'
import { supabase } from '../lib/supabase'

const labels = [
  ['contact_checked', 'Contact details checked', 'The contact information was reviewed by the MrSa team.', UserCheck],
  ['location_checked', 'Location information checked', 'The submitted property location was reviewed.', MapPinCheck],
  ['photos_checked', 'Property photos reviewed', 'The submitted photos were reviewed for listing quality.', Images],
  ['price_area_checked', 'Price and area checked', 'The submitted price and area information was reviewed.', ShieldCheck],
  ['documents_reviewed', 'Documents reviewed', 'Documents were received and reviewed. This is not a legal title guarantee.', FileCheck2],
  ['site_visit_completed', 'Site visit completed', 'A site visit was recorded by the MrSa team.', MapPinCheck]
]

export default function PropertyTrustPanel({ listingId }) {
  const [badge, setBadge] = useState(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [reason, setReason] = useState('incorrect_information')
  const [details, setDetails] = useState('')
  const [reporterName, setReporterName] = useState('')
  const [reporterContact, setReporterContact] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    supabase.from('listing_trust_badges')
      .select('contact_checked,location_checked,photos_checked,price_area_checked,documents_reviewed,site_visit_completed,public_reviewed_at')
      .eq('listing_id', listingId).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        if (error) console.warn('Property trust information unavailable:', error.message)
        setBadge(data || null)
      })
    return () => { active = false }
  }, [listingId])

  const submitReport = async event => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setNotice('')
    const { error } = await supabase.from('listing_reports').insert({
      listing_id: listingId,
      reason,
      details: details.trim() || null,
      reporter_name: reporterName.trim() || null,
      reporter_contact: reporterContact.trim() || null
    })
    setBusy(false)
    if (error) setNotice('We could not submit your report. Please try again later.')
    else {
      setNotice('Thank you. Your report has been sent to the MrSa team.')
      setDetails('')
      setReporterName('')
      setReporterContact('')
      setReportOpen(false)
    }
  }

  const completed = badge ? labels.filter(([key]) => badge[key]) : []
  return <section className="property-trust-panel" aria-label="Property review information">
    {completed.length > 0 && <span className="trust-reviewed-pill"><ShieldCheck size={14}/> Checks recorded</span>}
    {completed.length ? <div className="property-trust-grid">
      {completed.map(([key, title, description, Icon]) => <div className="property-trust-item" key={key}>
        <Icon size={19}/><div><b>{title}</b><small>{description}</small></div>
      </div>)}
    </div> : <p className="muted trust-empty">No additional verification checks have been recorded for this listing yet. Please independently verify all property information.</p>}
    {badge?.public_reviewed_at && <p className="trust-review-date">Last review: {new Date(badge.public_reviewed_at).toLocaleDateString('en-IN')}</p>}
    <p className="trust-disclaimer">MrSa listing checks are limited to the items shown above. They do not certify ownership, title, approvals, encumbrances or legal status. Buyers should obtain independent legal advice before paying or proceeding.</p>
    <div className="trust-report-actions">
      <button type="button" className="btn btn-outline" onClick={() => setReportOpen(value => !value)}><Flag size={15}/> Report this property</button>
    </div>
    {reportOpen && <form className="trust-report-form" onSubmit={submitReport}>
      <label>Reason for report<select value={reason} onChange={event => setReason(event.target.value)}>
        <option value="incorrect_information">Incorrect information</option><option value="duplicate_listing">Duplicate listing</option><option value="suspicious_contact">Suspicious contact</option><option value="property_unavailable">Property unavailable</option><option value="other">Other</option>
      </select></label>
      <label>Additional details<textarea rows="3" maxLength="2000" value={details} onChange={event => setDetails(event.target.value)} placeholder="Tell us what seems incorrect (optional)."/></label>
      <div className="two-fields"><label>Your name (optional)<input maxLength="120" value={reporterName} onChange={event => setReporterName(event.target.value)}/></label><label>Contact (optional)<input maxLength="80" value={reporterContact} onChange={event => setReporterContact(event.target.value)}/></label></div>
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Submit report'}</button>
    </form>}
    {notice && <p className="notice" role="status">{notice}</p>}
  </section>
}
