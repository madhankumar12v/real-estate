import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, MessageCircle, RefreshCw, Search, Phone, FileSpreadsheet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { waLink } from '../lib/helpers'

const statuses=['new','contacted','interested','application_in_progress','closed','not_interested']
const statusLabel=value=>({new:'New',contacted:'Contacted',interested:'Interested',application_in_progress:'Application in progress',closed:'Closed',not_interested:'Not interested'}[value]||value)
const money=value=>value==null?'—':new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(value)||0)
const date=value=>value?new Date(value).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'—'

export default function AdminLoanEnquiriesPage(){
 const [items,setItems]=useState([])
 const [busy,setBusy]=useState(true)
 const [error,setError]=useState('')
 const [filter,setFilter]=useState('all')
 const [query,setQuery]=useState('')
 const [saving,setSaving]=useState('')
 const [notes,setNotes]=useState({})
 const load=async()=>{
  setBusy(true);setError('')
  const {data,error}=await supabase.from('loan_enquiries').select('*').order('created_at',{ascending:false})
  if(error)setError(error.message)
  else{setItems(data||[]);setNotes(Object.fromEntries((data||[]).map(x=>[x.id,x.admin_notes||''])))}
  setBusy(false)
 }
 useEffect(()=>{load()},[])
 const update=async(id,changes)=>{
  setSaving(id);setError('')
  const {error}=await supabase.from('loan_enquiries').update(changes).eq('id',id)
  if(error)setError(error.message);else setItems(rows=>rows.map(row=>row.id===id?{...row,...changes}:row))
  setSaving(''); 
 }
 const visible=useMemo(()=>items.filter(item=>(filter==='all'||item.status===filter)&&(`${item.name} ${item.phone} ${item.loan_type} ${item.preferred_location}`).toLowerCase().includes(query.toLowerCase())),[items,filter,query])
 const exportCsv=()=>{
  const rows=[['Date','Name','Mobile','Loan type','Employment','Monthly income','Existing EMIs','Requested amount','Estimated eligibility','Location','Status','Admin notes'],...visible.map(x=>[date(x.created_at),x.name,x.phone,x.loan_type,x.employment_type,x.monthly_income,x.existing_emis,x.requested_amount,x.estimated_eligible_amount,x.preferred_location,statusLabel(x.status),x.admin_notes])]
  const csv='\uFEFF'+rows.map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\r\n')
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='mrsa-loan-enquiries.csv';a.click();URL.revokeObjectURL(url)
 }
 return <section className="section page-section admin-loan-page">
  <div className="admin-loan-heading"><div><span className="eyebrow">MRSA PROPERTIES · ADMIN</span><h1>Loan enquiries</h1><p className="muted">Review customer requests and manage follow-ups with banking professionals.</p></div><div className="admin-loan-actions"><button className="btn btn-outline" onClick={load} disabled={busy}><RefreshCw size={15}/> Refresh</button><button className="btn btn-primary" onClick={exportCsv} disabled={!visible.length}><FileSpreadsheet size={15}/> Export CSV</button></div></div>
  <div className="admin-stats"><div><b>{items.length}</b><span>Total loan leads</span></div><div><b>{items.filter(x=>x.status==='new').length}</b><span>New leads</span></div><div><b>{items.filter(x=>x.status==='application_in_progress').length}</b><span>Applications in progress</span></div></div>
  <div className="admin-loan-toolbar"><label><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, mobile, loan type or location"/></label><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All statuses</option>{statuses.map(x=><option key={x} value={x}>{statusLabel(x)}</option>)}</select></div>
  {error&&<p className="analytics-error" role="alert">{error}</p>}
  {busy?<p className="analytics-loading">Loading loan enquiries…</p>:visible.length?<div className="admin-loan-list">{visible.map(item=><article className="admin-loan-card" key={item.id}>
   <div className="admin-loan-card-top"><div><span className="eyebrow">{date(item.created_at)}</span><h3>{item.name}</h3><p className="muted">{item.loan_type} · {item.employment_type} · {item.preferred_location}</p></div><span className={'status status-'+(item.status==='new'?'pending':item.status==='closed'?'approved':'')}>{statusLabel(item.status)}</span></div>
   <div className="admin-loan-facts"><span><small>Mobile</small><b>{item.phone}</b></span><span><small>Monthly income</small><b>{money(item.monthly_income)}</b></span><span><small>Existing EMIs</small><b>{money(item.existing_emis)}</b></span><span><small>Requested</small><b>{money(item.requested_amount)}</b></span><span><small>Estimated eligibility</small><b>{money(item.estimated_eligible_amount)}</b></span></div>
   <div className="admin-loan-controls"><label>Lead status<select value={item.status} disabled={saving===item.id} onChange={e=>update(item.id,{status:e.target.value})}>{statuses.map(x=><option key={x} value={x}>{statusLabel(x)}</option>)}</select></label><label className="admin-loan-notes">Admin follow-up notes<textarea rows="2" value={notes[item.id]??''} onChange={e=>setNotes(current=>({...current,[item.id]:e.target.value}))} placeholder="Add internal follow-up notes"/></label><div className="admin-loan-card-actions"><a className="btn btn-outline" href={'tel:'+item.phone}><Phone size={15}/> Call</a><a className="btn btn-whatsapp" href={waLink('91'+String(item.phone).replace(/\D/g,''),`Hello ${item.name}, this is MrSa Properties following up on your ${item.loan_type} enquiry.`)} target="_blank" rel="noreferrer"><MessageCircle size={15}/> WhatsApp</a><button className="btn btn-primary" disabled={saving===item.id} onClick={()=>update(item.id,{admin_notes:notes[item.id]||''})}>Save notes</button></div></div>
  </article>)}</div>:<div className="empty"><h3>No loan enquiries found</h3><p>New customer requests submitted from the Loan Assistance page will appear here.</p></div>}
  <div className="analytics-footer"><span>Customer financial details are visible to administrators only.</span><Link to="/admin"><ArrowLeft size={15}/> Back to Admin dashboard</Link></div>
 </section>
}
