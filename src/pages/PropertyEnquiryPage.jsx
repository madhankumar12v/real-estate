import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { waLink } from '../lib/helpers'
import { MessageCircle } from 'lucide-react'

export default function PropertyEnquiryPage(){
 const {id}=useParams()
 const [property,setProperty]=useState(null)
 const [loading,setLoading]=useState(true)
 const [form,setForm]=useState({name:'',phone:'',email:'',message:''})
 const [busy,setBusy]=useState(false)
 const [notice,setNotice]=useState('')

 useEffect(()=>{
  let active=true
  const load=async()=>{
   setLoading(true)
   const {data,error}=await supabase.from('listings').select('id,title,city,district').eq('id',id).eq('status','approved').maybeSingle()
   if(!active)return
   if(error){console.error('Unable to load property enquiry:',error.message);setNotice('Unable to load this property. Please return to the property listing and try again.')}
   setProperty(data||null)
   setLoading(false)
  }
  load()
  return()=>{active=false}
 },[id])

 const submit=async e=>{
  e.preventDefault()
  if(busy||!property)return
  const digits=form.phone.replace(/\\D/g,'')
  if(digits.length<7||digits.length>15){setNotice('Please enter a valid mobile number.');return}

  // Open the tab during the click event so the browser does not block WhatsApp after the database request.
  const whatsappWindow=window.open('about:blank','_blank')
  setBusy(true)
  setNotice('')
  try{
   const {data:{user}}=await supabase.auth.getUser()
   const result=await supabase.from('enquiries').insert({
    listing_id:id,
    buyer_user_id:user?.id||null,
    buyer_name:form.name.trim(),
    buyer_phone:form.phone.trim(),
    buyer_email:form.email.trim()||null,
    message:form.message.trim()||'Interested in this property',
    source:'property'
   })
   if(result.error)throw result.error

   const text='I am '+form.name.trim()+'. I am interested in '+property.title+' in '+property.city+'. Mobile: '+form.phone.trim()+'. '+(form.message.trim()||'Please share more details.')
   const destination=waLink('918838037689',text)
   setNotice('Enquiry saved. Opening WhatsApp…')
   if(whatsappWindow){
    whatsappWindow.location.href=destination
    whatsappWindow.opener=null
   }else{
    window.location.href=destination
   }
  }catch(error){
   if(whatsappWindow)whatsappWindow.close()
   console.error('Unable to submit property enquiry:',error)
   setNotice('Could not save your enquiry: '+(error.message||'Please try again.'))
  }finally{
   setBusy(false)
  }
 }

 if(loading)return <section className="section page-section"><h1>Property enquiry</h1><p className="muted">Loading property details…</p></section>
 if(!property)return <section className="section page-section"><h1>Property unavailable</h1><p className="muted">{notice||'This property may have been removed or is not currently approved.'}</p><Link to="/properties">Browse properties</Link></section>

 return <section className="section page-section narrow">
  <span className="eyebrow">PROPERTY ENQUIRY</span>
  <h1>Contact about this property</h1>
  <div className="contact-card"><b>{property.title}</b><p className="muted">{property.city}, {property.district}</p></div>
  <form className="form-card" onSubmit={submit}>
   <label>Your name<input required autoComplete="name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
   <label>Mobile number<input required type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
   <label>Email (optional)<input type="email" autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
   <label>Message<textarea rows="4" value={form.message} onChange={e=>setForm({...form,message:e.target.value})} placeholder="I would like to know more about this property."/></label>
   <button className="btn btn-primary full" disabled={busy}>{busy?'Saving enquiry…':'Submit enquiry & open WhatsApp'} <MessageCircle size={16}/></button>
   {notice&&<p className="notice" role="status">{notice}</p>}
  </form>
 </section>
}
