import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Instagram, RefreshCw, Send, CheckCircle2, ShieldCheck, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'

const money = value => value == null ? 'Price on request' : new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(value)||0)
const defaultCaption = listing => {
  const place = [listing.locality, listing.city, listing.district].filter(Boolean).join(', ')
  const rate = listing.price_per_sqft == null ? 'Price on request' : money(listing.price_per_sqft) + ' per sq.ft.'
  return listing.title + '\n' + listing.property_type + ' for sale in ' + place + '\nRate: ' + rate + '\n\nதமிழ்நாட்டில் உங்கள் அடுத்த சொத்து வாய்ப்பை MrSa Properties உடன் கண்டறியுங்கள். மேலும் விவரங்கள் மற்றும் பார்வைக்கு எங்களைத் தொடர்புகொள்ளுங்கள்.\n\nProperty details are shared as provided in the listing. Please verify title, approvals and documents independently.\n\n#MrSaProperties #TamilNaduRealEstate #PropertyForSale #VelloreRealEstate'
}
async function getSessionToken(){
  const {data,error}=await supabase.auth.getSession()
  if(error) throw error
  if(!data.session?.access_token) throw new Error('Your session has expired. Please sign in again.')
  return data.session.access_token
}
export default function InstagramPublishingPage(){
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
    if(!response.ok) throw new Error(result.error||'Instagram publishing request failed.')
    return result
  }
  const load=async()=>{
    setLoading(true);setError('')
    try{
      const [listingData,postData]=await Promise.all([api('/api/instagram/listings'),api('/api/instagram/posts')])
      setListings(listingData.listings||[])
      setPosts(postData.posts||[])
      if(!selectedId&&listingData.listings?.length){setSelectedId(listingData.listings[0].id);setCaption(defaultCaption(listingData.listings[0]))}
    }catch(err){setError(err.message||'Could not load Instagram publishing data.')}
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
    if(!image){setError('This property has no public photo. Add a property photo before creating the Instagram draft.');return}
    setSaving(true);setError('');setNotice('')
    try{
      await api('/api/instagram/posts',{method:'POST',body:JSON.stringify({listing_id:selected.id,caption,image_url:image})})
      setNotice('Draft created. Review it below and approve it before publishing.')
      await load()
    }catch(err){setError(err.message||'Could not create draft.')}
    finally{setSaving(false)}
  }
  const act=async(id,action)=>{
    setWorkingId(id);setError('');setNotice('')
    try{
      const result=await api('/api/instagram/posts/'+encodeURIComponent(id)+'/'+action,{method:'POST',body:'{}'})
      setNotice(action==='approve'?'Post approved. It is ready for manual publishing.':('Instagram publishing completed.'+(result.permalink?' Open post: '+result.permalink:'')))
      await load()
    }catch(err){setError(err.message||'The action could not be completed.')}
    finally{setWorkingId('')}
  }
  return <section className="section page-section instagram-publishing-page">
    <div className="instagram-publishing-heading">
      <div><span className="eyebrow">MRSA PROPERTIES · ADMIN</span><h1><Instagram size={27} style={{verticalAlign:'-5px',marginRight:8}}/>Instagram publishing</h1><p className="muted">Prepare posts from approved property listings. Every post requires admin approval and a manual publish action.</p></div>
      <div className="instagram-publishing-actions"><button className="btn btn-outline" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button><Link className="btn btn-outline" to="/admin">← Admin dashboard</Link></div>
    </div>
    {notice&&<div className="instagram-publishing-notice" role="status">{notice}</div>}
    {error&&<div className="instagram-publishing-error" role="alert">{error}</div>}
    <div className="instagram-publishing-grid">
      <article className="instagram-publishing-panel">
        <h2>Create a property post</h2><p>Only admin-approved listings are available. Choose a property, check its photo and edit the bilingual caption.</p>
        <form className="instagram-publishing-form" onSubmit={createDraft}>
          <label>Approved property<select value={selectedId} onChange={event=>chooseListing(event.target.value)} disabled={loading||!listings.length}><option value="">Select a property</option>{listings.map(item=><option key={item.id} value={item.id}>{item.title} · {item.city}</option>)}</select></label>
          {selected&&<div className="instagram-publishing-preview">{selected.images?.[0]?.url?<img src={selected.images[0].url} alt={selected.title}/>:<div/>}<div><b>{selected.title}</b><small>{selected.city}, {selected.district} · {selected.price_per_sqft == null ? 'Price on request' : money(selected.price_per_sqft) + ' / sq.ft.'}</small></div></div>}
          <label>Caption (English + Tamil)<textarea value={caption} onChange={event=>setCaption(event.target.value)} maxLength={2200} required placeholder="Write your Instagram caption…"/></label>
          <small>{caption.length}/2,200 characters · Single-photo feed post</small>
          <button className="btn btn-primary full" type="submit" disabled={saving||loading||!selected||!caption.trim()}>{saving?'Creating draft…':'Create draft for approval'} <CheckCircle2 size={16}/></button>
        </form>
      </article>
      <article className="instagram-publishing-panel">
        <h2>Publishing queue</h2><p>Drafts must be approved before the publish action becomes available.</p>
        {loading?<div className="instagram-empty">Loading Instagram queue…</div>:posts.length?<div className="instagram-post-list">{posts.map(post=><article className="instagram-post-card" key={post.id}>
          {post.image_url?<img src={post.image_url} alt="Property post"/>:<div/>}
          <div className="instagram-post-content">
            <div className="instagram-post-top"><b>{post.listing?.title||'Property post'}</b><span className={'instagram-status instagram-status-'+post.status}>{post.status}</span></div>
            <p className="instagram-post-caption">{post.caption}</p>
            <div className="instagram-post-meta">{post.created_at?new Date(post.created_at).toLocaleString('en-IN'):''}{post.last_error?' · '+post.last_error:''}</div>
            {post.permalink&&<a className="text-link" href={post.permalink} target="_blank" rel="noreferrer">View Instagram post <ExternalLink size={13}/></a>}
            <div className="instagram-post-actions">
              {post.status==='draft'&&<button className="btn btn-outline" disabled={workingId===post.id} onClick={()=>act(post.id,'approve')}>Approve post</button>}
              {post.status==='approved'&&<button className="btn btn-primary" disabled={workingId===post.id} onClick={()=>act(post.id,'publish')}><Send size={13}/>{workingId===post.id?'Publishing…':'Publish to Instagram'}</button>}
              {post.status==='failed'&&<span className="instagram-post-meta">Fix the issue, then create a new draft for review.</span>}
            </div>
          </div>
        </article>)}</div>:<div className="instagram-empty">No Instagram drafts yet. Create one from an approved property.</div>}
      </article>
    </div>
    <div className="instagram-setup-note"><b><ShieldCheck size={14} style={{verticalAlign:'-3px'}}/> Publishing safeguards</b><br/>Only administrators can access this page. The server checks the listing is still approved, verifies the image is publicly reachable JPEG, and requires an approved queue item before sending it to Meta. The Instagram access token stays in the Cloudflare Worker secret store. API publishing is not active until the database migration and Cloudflare Worker settings are deployed.</div>
  </section>
}
