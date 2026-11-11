import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Facebook, RefreshCw, Send, CheckCircle2, ShieldCheck, ExternalLink, Check, X, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

const money = value => value == null ? 'Price on request' : new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(value)||0)
const defaultCaption = listing => {
  const place = [listing.locality, listing.city, listing.district].filter(Boolean).join(', ')
  const rate = listing.price_per_sqft == null ? 'Price on request' : money(listing.price_per_sqft) + ' per sq.ft.'
  return listing.title + '\n' + listing.property_type + ' for sale in ' + place + '\nRate: ' + rate + '\n\nவேலூர், காட்பாடி, குடியாத்தம், ராணிப்பேட்டை, ஆற்காடு, அணைக்கட்டு, வாலாஜா பகுதிகளில் உங்கள் அடுத்த சொத்து வாய்ப்பை MrSa Properties உடன் கண்டறியுங்கள். மேலும் விவரங்கள் மற்றும் பார்வைக்கு எங்களைத் தொடர்புகொள்ளுங்கள்.\n\nProperty details are shared as provided in the listing. Please verify title, approvals and documents independently.\n\n#MrSaProperties #VelloreRealEstate #PropertyForSale'
}
async function getSessionToken(){
  const {data,error}=await supabase.auth.getSession()
  if(error) throw error
  if(!data.session?.access_token) throw new Error('Your session has expired. Please sign in again.')
  return data.session.access_token
}
export default function FacebookPublishingPage(){
  const [listings,setListings]=useState([])
  const [posts,setPosts]=useState([])
  const [selectedId,setSelectedId]=useState('')
  const [caption,setCaption]=useState('')
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [workingId,setWorkingId]=useState('')
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const selected=useMemo(()=>listings.find(item=>item.id===selectedId)||null,[listings,selectedId])
  const api=async(path,options={})=>{
    const token=await getSessionToken()
    const response=await fetch(path,{...options,headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,...(options.headers||{})}})
    const result=await response.json().catch(()=>({}))
    if(!response.ok) throw new Error(result.error||'Facebook publishing request failed.')
    return result
  }
  const load=async()=>{
    setLoading(true);setError('')
    try{
      const [listingData,postData]=await Promise.all([api('/api/facebook/listings'),api('/api/facebook/posts')])
      setListings(listingData.listings||[])
      setPosts(postData.posts||[])
      if(!selectedId&&listingData.listings?.length){setSelectedId(listingData.listings[0].id);setCaption(defaultCaption(listingData.listings[0]))}
    }catch(err){setError(err.message||'Could not load Facebook publishing data.')}
    finally{setLoading(false)}
  }
  useEffect(()=>{load()},[])
  const chooseListing=id=>{
    setSelectedId(id)
    const item=listings.find(row=>row.id===id)
    setCaption(item?defaultCaption(item):'')
  }
  const createDraft=async event=>{
    event.preventDefault()
    if(!selected){setError('Choose an approved property first.');return}
    const image=selected.images?.[0]?.url
    if(!image){setError('This property has no public photo. Add a property photo before creating the Facebook draft.');return}
    setSaving(true);setError('');setNotice('')
    try{
      await api('/api/facebook/posts',{method:'POST',body:JSON.stringify({listing_id:selected.id,caption,image_url:image})})
      setNotice('Facebook draft created. Review and approve it before publishing.')
      await load()
    }catch(err){setError(err.message||'Could not create draft.')}
    finally{setSaving(false)}
  }
  const act=async(id,action)=>{
    if(action==='delete'&&!window.confirm('Delete this Facebook queue item? This will not delete the property listing.'))return
    setWorkingId(id);setError('');setNotice('')
    try{
      const result=await api('/api/facebook/posts/'+encodeURIComponent(id)+'/'+action,{method:'POST',body:'{}'})
      const messages={approve:'Facebook post approved. Automatic publishing will pick it up when the master switch is active.',reject:'Facebook post rejected. It will not be published.',delete:'Facebook queue item deleted.'}
      setNotice(messages[action]||'Facebook publishing completed.'+(result.permalink?' Open post: '+result.permalink:''))
      await load()
    }catch(err){setError(err.message||'The action could not be completed.')}
    finally{setWorkingId('')}
  }
  return <section className="section page-section instagram-publishing-page">
    <div className="instagram-publishing-heading">
      <div><span className="eyebrow">MRSA PROPERTIES · ADMIN</span><h1><Facebook size={27} style={{verticalAlign:'-5px',marginRight:8}}/>Facebook publishing</h1><p className="muted">Review automatically generated posts from approved listings. Approve, reject or delete each queue item; approved automatic posts publish when Auto Marketing is active.</p></div>
      <div className="instagram-publishing-actions"><button className="btn btn-outline" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button><Link className="btn btn-outline" to="/admin">← Admin dashboard</Link></div>
    </div>
    {notice&&<div className="instagram-publishing-notice" role="status">{notice}</div>}
    {error&&<div className="instagram-publishing-error" role="alert">{error}</div>}
    <div className="instagram-publishing-grid">
      <article className="instagram-publishing-panel">
        <h2>Create a Facebook post</h2><p>Only admin-approved listings are available. Choose a property, check its photo and edit the bilingual post text.</p>
        <form className="instagram-publishing-form" onSubmit={createDraft}>
          <label>Approved property<select value={selectedId} onChange={event=>chooseListing(event.target.value)} disabled={loading||!listings.length}><option value="">Select a property</option>{listings.map(item=><option key={item.id} value={item.id}>{item.title} · {item.city}</option>)}</select></label>
          {selected&&<div className="instagram-publishing-preview">{selected.images?.[0]?.url?<img src={selected.images[0].url} alt={selected.title}/>:<div/>}<div><b>{selected.title}</b><small>{selected.city}, {selected.district} · {selected.price_per_sqft == null ? 'Price on request' : money(selected.price_per_sqft) + ' / sq.ft.'}</small></div></div>}
          <label>Post text (English + Tamil)<textarea value={caption} onChange={event=>setCaption(event.target.value)} maxLength={5000} required placeholder="Write your Facebook post…"/></label>
          <small>{caption.length}/5,000 characters · Single-photo Page post</small>
          <button className="btn btn-primary full" type="submit" disabled={saving||loading||!selected||!caption.trim()}>{saving?'Creating draft…':'Create draft for approval'} <CheckCircle2 size={16}/></button>
        </form>
      </article>
      <article className="instagram-publishing-panel">
        <h2>Facebook publishing queue</h2><p>Every post stays in the queue until an administrator approves that specific Facebook post. Property approval alone never authorizes social publishing.</p>
        {loading?<div className="instagram-empty">Loading Facebook queue…</div>:posts.length?<div className="instagram-post-list">{posts.map(post=><article className="instagram-post-card" key={post.id}>
          {post.image_url?<img src={post.image_url} alt="Property post"/>:<div/>}
          <div className="instagram-post-content">
            <div className="instagram-post-top"><b>{post.listing?.title||'Property post'}</b><span className={'instagram-status instagram-status-'+post.status}>{post.status}</span></div>
            <p className="instagram-post-caption">{post.caption}</p>
            <div className="instagram-post-meta">{post.created_at?new Date(post.created_at).toLocaleString('en-IN'):''}{post.last_error?' · '+post.last_error:''}</div>
            {post.permalink&&<a className="text-link" href={post.permalink} target="_blank" rel="noreferrer">View Facebook post <ExternalLink size={13}/></a>}
            <div className="instagram-post-actions">
              {['draft','failed'].includes(post.status)||(post.status==='approved'&&(!post.approved_at||!post.approved_by))?<button className="btn btn-outline" title="Approve this post" aria-label="Approve Facebook post" disabled={workingId===post.id} onClick={()=>act(post.id,'approve')}><Check size={15}/></button>:post.status==='approved'?<button className="btn btn-outline" title="Approved by admin" aria-label="Facebook post approved" disabled><Check size={15}/></button>:null}
              {post.status==='approved'&&post.auto_generated&&<span className="instagram-post-meta">Admin approved · Attempt {post.attempt_count||0}/5 · Next check {post.next_attempt_at?new Date(post.next_attempt_at).toLocaleString('en-IN'):'soon'}</span>}
              {post.status==='approved'&&post.approved_at&&post.approved_by&&!post.auto_generated&&<button className="btn btn-primary" disabled={workingId===post.id} onClick={()=>act(post.id,'publish')}><Send size={13}/>{workingId===post.id?'Publishing…':'Publish to Facebook'}</button>}
              {post.status==='failed'&&<span className="instagram-post-meta">Publishing failed. Review the error before approving again.</span>}
              {post.status!=='published'&&post.status!=='publishing'&&<button className="btn btn-outline" title="Reject" aria-label="Reject Facebook post" disabled={workingId===post.id||post.status==='rejected'} onClick={()=>act(post.id,'reject')}><X size={15}/></button>}
              {post.status!=='published'&&post.status!=='publishing'&&<button className="btn btn-outline" title="Delete" aria-label="Delete Facebook queue item" disabled={workingId===post.id} onClick={()=>act(post.id,'delete')}><Trash2 size={15}/></button>}
              {post.status==='rejected'&&<span className="instagram-post-meta">Rejected · Not scheduled for publishing</span>}
            </div>
          </div>
        </article>)}</div>:<div className="instagram-empty">No Facebook drafts yet. Create one from an approved property.</div>}
      </article>
    </div>
    <div className="instagram-setup-note"><b><ShieldCheck size={14} style={{verticalAlign:'-3px'}}/> Publishing safeguards</b><br/>Only administrators can access this page. The server checks that the property and photo belong to the selected approved listing, then checks approval again immediately before publishing. The Facebook Page token stays in the Cloudflare Worker secret store. API publishing is not active until the Supabase migration and Cloudflare settings are configured.</div>
  </section>
}
