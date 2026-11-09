import { useState } from 'react'
import { MessageCircle, Calculator, FileText } from 'lucide-react'
import { waLink } from '../lib/helpers'

const locations = ['Vellore','Katpadi','Anaicut','Ranipet','Arcot','Gudiyatham','Walajah']
const loanTypes = ['Plot / Land Loan','Home Construction Loan','Car / Vehicle Loan','Personal Loan','Business Loan']

export default function LoanAssistancePage(){
 const [loanType,setLoanType]=useState(loanTypes[0])
 const [employment,setEmployment]=useState('Salaried')
 const [income,setIncome]=useState('')
 const [emis,setEmis]=useState('')
 const [location,setLocation]=useState('Vellore')
 const [name,setName]=useState('')
 const [phone,setPhone]=useState('')
 const [principal,setPrincipal]=useState('2500000')
 const [rate,setRate]=useState('9')
 const [years,setYears]=useState('20')
 const amount=Number(principal),monthlyRate=Number(rate)/1200,months=Number(years)*12
 const emi=amount>0&&months>0?(monthlyRate===0?amount/months:amount*monthlyRate*Math.pow(1+monthlyRate,months)/(Math.pow(1+monthlyRate,months)-1)):0
 const submit=e=>{
  e.preventDefault()
  const message=`Hello MrSa Properties, I need loan assistance.
Name: ${name}
Mobile: ${phone}
Loan type: ${loanType}
Employment: ${employment}
Monthly net income: ₹${income}
Existing monthly EMIs: ₹${emis||'0'}
Preferred location: ${location}
Please share suitable bank options, indicative eligible amount and required documents.`
  window.open(waLink('918838037689',message),'_blank','noopener,noreferrer')
 }
 return <section className="section page-section loan-page">
  <div className="loan-page-intro"><span className="eyebrow">MRSA PROPERTIES · LOAN ASSISTANCE</span><h1>Need help financing your property?</h1><p>Share a few details and our team will connect with you to discuss suitable loan options.</p></div>
  <form className="form-card" onSubmit={submit}>
   <h2>Request loan assistance</h2>
   <div className="loan-form-grid">
    <label>Your name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your name"/></label>
    <label>Mobile number<input required type="tel" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Enter your mobile number"/></label>
    <label>Loan category<select value={loanType} onChange={e=>setLoanType(e.target.value)}>{loanTypes.map(x=><option key={x}>{x}</option>)}</select></label>
    <label>Employment type<select value={employment} onChange={e=>setEmployment(e.target.value)}><option>Salaried</option><option>Self-Employed</option></select></label>
    <label>Monthly net income (₹)<input required type="number" min="0" value={income} onChange={e=>setIncome(e.target.value)} placeholder="e.g. 50000"/></label>
    <label>Existing monthly EMIs (₹)<input type="number" min="0" value={emis} onChange={e=>setEmis(e.target.value)} placeholder="e.g. 8000"/></label>
    <label className="loan-full">Preferred location<select value={location} onChange={e=>setLocation(e.target.value)}>{locations.map(x=><option key={x}>{x}</option>)}</select></label>
   </div>
   <button className="btn btn-primary full" type="submit">Get Loan Eligibility & Connect on WhatsApp <MessageCircle size={17}/></button>
   <p className="loan-disclaimer">Your details will be shared with MrSa Properties through WhatsApp for follow-up. Do not send Aadhaar, PAN, bank statements or other sensitive documents through this initial enquiry form.</p>
  </form>
  <section className="loan-calculator">
   <h2><Calculator size={19}/> Indicative EMI calculator</h2>
   <div className="loan-calc-grid">
    <label>Loan amount (₹)<input type="number" min="0" value={principal} onChange={e=>setPrincipal(e.target.value)}/></label>
    <label>Annual interest rate (%)<input type="number" min="0" max="50" step="0.1" value={rate} onChange={e=>setRate(e.target.value)}/></label>
    <label>Loan tenure (years)<input type="number" min="1" max="40" value={years} onChange={e=>setYears(e.target.value)}/></label>
   </div>
   <div className="loan-emi-result">Estimated monthly EMI: ₹{Math.round(emi).toLocaleString('en-IN')}</div>
   <p className="loan-disclaimer">This is only an illustrative calculation. Actual interest rates, fees, eligibility and loan approval are determined by the lender.</p>
  </section>
  <section className="loan-documents">
   <h2><FileText size={19}/> Documents commonly requested by lenders</h2>
   <div className="loan-doc-grid">
    <article><h3>Salaried applicants</h3><ul><li>Latest 3 months’ payslips</li><li>6 months’ bank statements</li><li>Form 16 or income-tax returns</li><li>Aadhaar and PAN</li></ul></article>
    <article><h3>Self-employed applicants</h3><ul><li>2–3 years’ income-tax returns</li><li>Profit and loss statements</li><li>12 months’ bank statements</li><li>Business registration / GST details</li><li>Aadhaar and PAN</li></ul></article>
    <article><h3>Property-related documents</h3><ul><li>Parent documents and sale deed</li><li>DTCP / RERA approval or blueprint, where applicable</li><li>Encumbrance Certificate (EC)</li></ul></article>
   </div>
   <p className="loan-disclaimer">Document requirements vary by lender and loan type. Share documents only through the lender’s verified, secure process when requested.</p>
  </section>
 </section>
}
