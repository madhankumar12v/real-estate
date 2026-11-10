import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const empty={available_count:0,reserved_count:0,sold_count:0}
export default function PlotInventoryPage(){
  const [listings,setListings]=useState([])
  const [counts,setCounts]=useState({})
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [loading,setLoading]=useState(true)
  const load=async()=>{
    setLoading(true)
    const [{data:rows,error:listingError},{data:values,error:valueError}]=await Promise.all([
      supabase.from('listings').select('id,title,city,district,status').eq('property_type','Plot').order('created_at',{ascending:false}),
      supabase.from('plot_availability').select('*')
    ])
    if(listingError||valueError)throw listingError||valueError
    setListings(rows||[])
    const mapped={}
    ;(values||[]).forEach(v=>{mapped[v.listing_id]={available_count:v.available_count,reserved_count:v.reserved_count,sold_count:v.sold_count,total_count:v.total_count}})
    setCounts(mapped)
    setLoading(false)
  }
  useEffect(()=>{load().catch(e=>{setMessage(e.message||'Unable to load plot availability.');setLoading(false)})},[])
  const change=(id,key,value)=>{
    const n=Math.max(0,Math.floor(Number(value)||0))
    setCounts(old=>({...old,[id]:{...empty,...old[id],[key]:n}}))
  }
  const save=async listing=>{
    const value={...empty,...counts[listing.id]}
    setBusy(true);setMessage('')
    const {error}=await supabase.from('plot_availability').upsert({
      listing_id:listing.id,
      available_count:value.available_count,
      reserved_count:value.reserved_count,
      sold_count:value.sold_count,
      updated_at:new Date().toISOString()
    },{onConflict:'listing_id'})
    if(error)setMessage('Could not save '+listing.title+': '+error.message)
    else setMessage('Availability saved for '+listing.title+'.')
    setBusy(false)
    if(!error)await load()
  }
  return <section className="section page-section plot-inventory-page">
    <div className="section-heading"><div><span className="eyebrow">INVENTORY CONTROL</span><h1>Plot Availability</h1><p className="muted">Update availability counts for your existing Plot listings.</p></div><Link className="btn btn-ghost" to="/admin">← Admin dashboard</Link></div>
    {message&&<p className="notice" role="status">{message}</p>}
    {loading?<p>Loading Plot listings…</p>:!listings.length?<div className="empty"><p>No Plot listings found.</p></div>:
      <div className="plot-count-list">{listings.map(listing=>{
        const value={...empty,...counts[listing.id]}
        const total=value.available_count+value.reserved_count+value.sold_count
        return <article className="plot-count-row" key={listing.id}>
          <div className="plot-count-title"><b>{listing.title}</b><small>{listing.city}, {listing.district} · {listing.status}</small></div>
          <div className="plot-count-fields">
            <label>Available<input type="number" min="0" step="1" value={value.available_count} onChange={e=>change(listing.id,'available_count',e.target.value)}/></label>
            <label>Reserved<input type="number" min="0" step="1" value={value.reserved_count} onChange={e=>change(listing.id,'reserved_count',e.target.value)}/></label>
            <label>Sold<input type="number" min="0" step="1" value={value.sold_count} onChange={e=>change(listing.id,'sold_count',e.target.value)}/></label>
            <div className="plot-count-total"><small>Total</small><b>{total}</b></div>
            <button className="btn btn-primary" disabled={busy} onClick={()=>save(listing)}>Save</button>
          </div>
        </article>
      })}</div>}
  </section>
}
