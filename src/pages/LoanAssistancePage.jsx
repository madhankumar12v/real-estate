import { useMemo, useState } from 'react'
import { MessageCircle, Calculator, FileText, ShieldCheck, Banknote, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { waLink } from '../lib/helpers'

const locations = ['Vellore','Katpadi','Anaicut','Ranipet','Arcot','Gudiyatham','Walajah']
const loanTypes = ['Plot / Land Loan','Home Construction Loan','Personal Loan','Business Loan']
const money = value => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Math.max(0,Number(value)||0))
const calculateEmi = (principal,annualRate,months) => {
 const p=Number(principal),r=Number(annualRate)/1200,n=Number(months)
 if(!(p>0&&n>0))return 0
 return r===0?p/n:p*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1)
}
const loanFromEmi = (emi,annualRate,months) => {
 const r=Number(annualRate)/1200,n=Number(months),payment=Math.max(0,Number(emi)||0)
 if(!(payment>0&&n>0))return 0
 return r===0?payment*n:payment*(Math.pow(1+r,n)-1)/(r*Math.pow(1+r,n))
}

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
 const [principal,setPrincipal]=useState('2500000')
 const [rate,setRate]=useState('9')
 const [years,setYears]=useState('20')
 const [eligibilityRate,setEligibilityRate]=useState('9')
 const [eligibilityYears,setEligibilityYears]=useState('20')
 const monthlyIncome=Math.max(0,Number(income)||0)
 const existingEmis=Math.max(0,Number(emis)||0)
 const eligibleEmi=Math.max(0,monthlyIncome*0.5-existingEmis)
 const estimatedEligibility=loanFromEmi(eligibleEmi,eligibilityRate,Number(eligibilityYears)*12)
 const amount=Number(principal),months=Number(years)*12
 const emi=calculateEmi(amount,rate,months)
 const totalPayment=emi*months
 const totalInterest=Math.max(0,totalPayment-amount)
 const canEstimate=monthlyIncome>0&&Number(eligibilityYears)>0&&Number(eligibilityRate)>=0
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
   preferred_location:location,estimated_eligible_amount:Math.round(estimatedEligibility),
   eligibility_interest_rate:Number(eligibilityRate),eligibility_tenure_years:Number(eligibilityYears),
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
Estimated eligibility (illustrative): ${money(estimatedEligibility)}
Preferred location: ${location}
Consent: I agree to be contacted and to have my enquiry shared with a relevant banking professional for follow-up.`
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
  <div className="loan-page-intro"><span className="eyebrow">MRSA PROPERTIES · LOAN ASSISTANCE</span><h1>Fast-Track Your Property &amp; Home Loans</h1><p>Get connected with banking professionals to explore plot loans, home construction loans and personal financing options with guidance at every step.</p><div className="loan-trust-points"><span><ShieldCheck size={16}/> Consent-led banker connection</span><span><CheckCircle2 size={16}/> Clear estimates, no approval promises</span></div></div>
  <section className="loan-calculator loan-eligibility">
   <h2><Banknote size={19}/> Check your indicative loan eligibility</h2>
   <p className="muted">Enter your monthly income and current EMIs to see an illustrative estimate of the loan amount you may be able to explore.</p>
   <div className="loan-calc-grid">
    <label>Monthly net income (₹)<input type="number" min="0" value={income} onChange={e=>setIncome(e.target.value)}/></label>
    <label>Existing monthly EMIs (₹)<input type="number" min="0" value={emis} onChange={e=>setEmis(e.target.value)}/></label>
    <label>Illustrative annual interest rate (%)<input type="number" min="0" max="30" step="0.1" value={eligibilityRate} onChange={e=>setEligibilityRate(e.target.value)}/></label>
    <label>Repayment tenure (years)<input type="number" min="1" max="40" value={eligibilityYears} onChange={e=>setEligibilityYears(e.target.value)}/></label>
   </div>
   <div className="loan-eligibility-result"><span>Indicative eligible loan amount</span><strong>{canEstimate?money(estimatedEligibility):'Enter valid income and tenure'}</strong><small>Illustration uses a 50% total-EMI-to-income assumption. Actual lender criteria can be different.</small></div>
   <p className="loan-disclaimer">This is not a bank eligibility decision, sanction or pre-approval. Lenders assess credit history, income stability, age, property, existing obligations and their own policies.</p>
  </section>
  <section className="loan-calculator">
   <h2><Calculator size={19}/> Home loan EMI calculator</h2>
   <div className="loan-calc-grid">
    <label>Loan amount (₹)<input type="number" min="1" value={principal} onChange={e=>setPrincipal(e.target.value)}/></label>
    <label>Annual interest rate (%)<input type="number" min="0" max="50" step="0.1" value={rate} onChange={e=>setRate(e.target.value)}/></label>
    <label>Loan tenure (years)<input type="number" min="1" max="40" value={years} onChange={e=>setYears(e.target.value)}/></label>
   </div>
   <div className="loan-emi-result">Estimated monthly EMI: {money(emi)}</div>
   <div className="loan-emi-breakdown"><div><span>Total interest</span><b>{money(totalInterest)}</b></div><div><span>Total repayment</span><b>{money(totalPayment)}</b></div></div>
   <p className="loan-disclaimer">Illustrative calculation only. Actual interest rates, fees, eligibility and approval are determined by the lender.</p>
  </section>
  <form className="form-card loan-request-card" onSubmit={submit}>
   <h2>Request a banker connection</h2>
   <p className="muted">Share your basic details. With your consent, our team can connect your enquiry with a relevant banking professional.</p>
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
   <label className="loan-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required/><span>I agree that MrSa Properties may contact me about this enquiry and, with this consent, share these basic details with a relevant banking professional for follow-up. I understand that loan approval is subject to the lender’s assessment.</span></label>
   <button className="btn btn-primary full" type="submit" disabled={busy||!consent}>{busy?'Submitting enquiry…':'Submit & Continue on WhatsApp'} <MessageCircle size={17}/></button>
   {notice&&<p className="notice" role="status">{notice}</p>}
   <p className="loan-disclaimer">Do not submit Aadhaar, PAN, bank statements, passwords or other sensitive documents through this form. Share documents only through a lender’s verified secure process.</p>
  </form>
  <section className="loan-documents">
   <h2><FileText size={19}/> Document checklist</h2>
   <p className="muted">These are common examples. Requirements vary by lender, loan type and applicant profile.</p>
   <div className="loan-doc-grid">
    <article><h3>Salaried applicants</h3><ul><li>Latest 3 months’ payslips</li><li>6 months’ bank statements</li><li>Form 16 or income-tax returns</li><li>PAN and identity/address proof, when requested securely</li></ul></article>
    <article><h3>Self-employed applicants</h3><ul><li>2–3 years’ income-tax returns</li><li>Profit and loss statements / balance sheets</li><li>12 months’ bank statements</li><li>Business registration / GST details, where applicable</li></ul></article>
    <article><h3>Property-related documents</h3><ul><li>Parent documents and sale deed</li><li>DTCP / RERA approval or approved plan, where applicable</li><li>Encumbrance Certificate (EC)</li><li>Land / construction estimate and related records, as requested</li></ul></article>
   </div>
   <p className="loan-disclaimer">Do not upload identity or financial documents to MrSa Properties. Submit them directly to the lender using its verified secure channel.</p>
  </section>
 </section>
}
