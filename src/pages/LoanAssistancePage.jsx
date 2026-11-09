import { useState } from 'react'
import { MessageCircle, FileText, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { waLink } from '../lib/helpers'

const locations = ['Vellore','Katpadi','Anaicut','Ranipet','Arcot','Gudiyatham','Walajah']
const loanTypes = ['Plot / Land Loan','Home Construction Loan','Personal Loan','Business Loan']
const money = value => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Math.max(0,Number(value)||0))

export default function LoanAssistancePage(){
 const [loanType,setLoanType]=useState(loanTypes[0])
 const [employment,setEmployment]=useState('Salaried')
 const [income,setIncome]=useState('50000')
 const [emis,setEmis]=useState('0')
 const [location,setLocation]=useState('Vellore')
 const [name,setName]=useState('')
 const [phone,setPhone]=useState('')
 const [requestedAmount,setRequestedAmount]=useState('')
 const [consent,setConsent]=useState(false)
 const [busy,setBusy]=useState(false)
 const [notice,setNotice]=useState('')
 const monthlyIncome=Math.max(0,Number(income)||0)
 const existingEmis=Math.max(0,Number(emis)||0)
 const submit=async e=>{
  e.preventDefault()
  if(busy)return
  if(!consent){setNotice('Please provide consent before submitting your enquiry.');return}
  const digits=phone.replace(/\D/g,'')
  if(digits.length<7||digits.length>15){setNotice('Please enter a valid mobile number.');return}
  const payload={
   name:name.trim(),phone:phone.trim(),loan_type:loanType,employment_type:employment,
   monthly_income:monthlyIncome,existing_emis:existingEmis,
   requested_amount:requestedAmount?Number(requestedAmount):null,
   preferred_location:location,
   consent_to_contact:true,consent_to_share:true,status:'new'
  }
  const message=`Hello MrSa Properties, I would like loan assistance.
Name: ${payload.name}
Mobile: ${payload.phone}
Loan type: ${loanType}
Employment: ${employment}
Monthly net income: ${money(monthlyIncome)}
Existing monthly EMIs: ${money(existingEmis)}
Requested amount: ${requestedAmount?money(requestedAmount):'Not specified'}
Preferred location: ${location}
Consent: I agree that MrSa Properties may contact me and share my enquiry with a relevant bank representative for follow-up.`
  const whatsappWindow=window.open('about:blank','_blank')
  setBusy(true);setNotice('')
  try{
   const {error}=await supabase.from('loan_enquiries').insert(payload)
   if(error)throw error
   setNotice('Your loan enquiry has been securely submitted. WhatsApp is opening…')
   if(whatsappWindow){whatsappWindow.location.href=waLink('918838037689',message);whatsappWindow.opener=null}
   setName('');setPhone('');setRequestedAmount('');setConsent(false)
  }catch(error){
   if(whatsappWindow)whatsappWindow.close()
   setNotice(error?.message?.includes('loan_enquiries')?'Loan enquiry storage is not ready yet. Please ask the site administrator to apply the latest Loan Assistance database migration.':(error.message||'Unable to submit your enquiry. Please try again.'))
  }finally{setBusy(false)}
 }
 return <section className="section page-section loan-page">
  <form className="form-card loan-request-card" onSubmit={submit}>
   <h2>Loan assistance enquiry</h2>
   <p className="muted">Share your details and our team will contact you about your loan enquiry.</p>
   <div className="loan-contact-options"><a className="btn btn-outline" href="tel:8838037689"><Phone size={16}/> Call 88380 37689</a><a className="btn btn-whatsapp" href={waLink('918838037689','Hello MrSa Properties, I would like to know about loan assistance.')} target="_blank" rel="noreferrer"><MessageCircle size={16}/> WhatsApp us</a></div>
   <div className="loan-form-grid">
    <label>Your name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your name"/></label>
    <label>Mobile number<input required type="tel" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Enter your mobile number"/></label>
    <label>Loan category<select value={loanType} onChange={e=>setLoanType(e.target.value)}>{loanTypes.map(x=><option key={x}>{x}</option>)}</select></label>
    <label>Employment type<select value={employment} onChange={e=>setEmployment(e.target.value)}><option>Salaried</option><option>Self-Employed</option></select></label>
    <label>Monthly net income (₹)<input required type="number" min="1" value={income} onChange={e=>setIncome(e.target.value)} placeholder="e.g. 50000"/></label>
    <label>Existing monthly EMIs (₹)<input type="number" min="0" value={emis} onChange={e=>setEmis(e.target.value)} placeholder="e.g. 8000"/></label>
    <label>Loan amount required (₹)<input type="number" min="1" value={requestedAmount} onChange={e=>setRequestedAmount(e.target.value)} placeholder="Optional"/></label>
    <label>Preferred location<select value={location} onChange={e=>setLocation(e.target.value)}>{locations.map(x=><option key={x}>{x}</option>)}</select></label>
   </div>
   <label className="loan-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required/><span>I agree that MrSa Properties may contact me and share my loan enquiry with a relevant bank representative for follow-up. I understand that loan approval depends on the lender’s assessment.</span></label>
   <button className="btn btn-primary full" type="submit" disabled={busy||!consent}>{busy?'Submitting enquiry…':'Submit & Continue on WhatsApp'} <MessageCircle size={17}/></button>
   {notice&&<p className="notice" role="status">{notice}</p>}
   <p className="loan-disclaimer">Do not submit Aadhaar, PAN, bank statements, passwords or other sensitive documents through this form. Share documents only through a lender’s verified secure process.</p>
  </form>
  <section className="loan-documents">
   <details className="loan-documents-accordion">
    <summary><span><FileText size={19}/> Document checklist (optional)</span><span className="muted">View common documents</span></summary>
    <p className="muted">These are common examples. Requirements vary by lender, loan type and applicant profile.</p>
    <div className="loan-doc-grid">
     <article><h3>Salaried applicants</h3><ul><li>Latest 3 months’ payslips</li><li>6 months’ bank statements</li><li>Form 16 or income-tax returns</li><li>PAN and identity/address proof, when requested securely</li></ul></article>
     <article><h3>Self-employed applicants</h3><ul><li>2–3 years’ income-tax returns</li><li>Profit and loss statements / balance sheets</li><li>12 months’ bank statements</li><li>Business registration / GST details, where applicable</li></ul></article>
     <article><h3>Property-related documents</h3><ul><li>Parent documents and sale deed</li><li>DTCP / RERA approval or approved plan, where applicable</li><li>Encumbrance Certificate (EC)</li><li>Land / construction estimate and related records, as requested</li></ul></article>
    </div>
    <p className="loan-disclaimer">Do not upload identity or financial documents to MrSa Properties. Submit them directly to the lender using its verified secure channel.</p>
   </details>
  </section>
 </section>
}
