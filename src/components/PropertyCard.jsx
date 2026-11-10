import { useEffect, useState } from 'react'
import { MapPin, ArrowUpRight, Heart, Share2, CalendarDays } from 'lucide-react'
import { Link } from 'react-router-dom'
import { placeholder, money } from '../lib/helpers'
import { getFavorites, toggleFavorite } from '../lib/favorites'
import { supabase } from '../lib/supabase'

export default function PropertyCard({p}) {
  const [saved,setSaved]=useState(false)
  const [plotAvailability,setPlotAvailability]=useState(null)
  useEffect(()=>{setSaved(getFavorites().includes(p.id))},[p.id])
  useEffect(()=>{
    let active=true
    if(p.property_type!=='Plot'){setPlotAvailability(null);return}
    supabase.from('plot_availability')
      .select('total_count,available_count,reserved_count,sold_count')
      .eq('listing_id',p.id).maybeSingle()
      .then(({data,error})=>{
        if(!active)return
        if(error){console.warn('Plot availability unavailable:',error.message);return}
        setPlotAvailability(data||null)
      })
    return ()=>{active=false}
  },[p.id,p.property_type])
  const share=()=>{const url=new URL(`/property/${p.id}`,window.location.origin).toString();if(navigator.share)navigator.share({title:p.title,url}).catch(()=>{});else if(navigator.clipboard?.writeText)navigator.clipboard.writeText(url).then(()=>window.alert('Property link copied.')).catch(()=>window.prompt('Copy property link',url));else window.prompt('Copy property link',url)}
  const posted=p.created_at?new Date(p.created_at):null
  const isNew=posted && (Date.now()-posted.getTime())<14*24*60*60*1000
  const plotStatus=p.property_type==='Plot'
    ? !plotAvailability || Number(plotAvailability.total_count)===0
      ? 'AVAILABILITY NOT UPDATED'
      : Number(plotAvailability.available_count)>0
        ? 'AVAILABLE'
        : Number(plotAvailability.reserved_count)>0
          ? 'RESERVATION IN PROGRESS'
          : 'SOLD OUT'
    : null
  const plotStatusClass=plotStatus==='SOLD OUT'?'plot-card-status-sold':plotStatus==='AVAILABLE'?'plot-card-status-available':plotStatus==='RESERVATION IN PROGRESS'?'plot-card-status-reserved':'plot-card-status-pending'
  return <article className="property-card"><div className="card-image-wrap"><Link to={`/property/${p.id}`} className="card-image"><img src={p.images?.[0] || placeholder} alt={p.title} loading="lazy" decoding="async"/><span className="status-pill">{p.property_type}</span>{isNew&&<span className="new-pill">New</span>}</Link><button className={saved?'favorite-btn saved':'favorite-btn'} aria-label={saved?'Remove saved property':'Save property'} aria-pressed={saved} onClick={()=>setSaved(toggleFavorite(p.id))}><Heart size={18} fill={saved?'currentColor':'none'}/></button></div>
    <div className="card-body"><Link to={`/property/${p.id}`}><h3>{p.title}</h3></Link><p className="muted"><MapPin size={15}/>{p.locality ? `${p.locality}, ` : ''}{p.city}, {p.district}</p>
    {p.price!==null&&p.price!==undefined&&p.price!==''&&<div className="card-total-price">{money(p.price)}</div>}
    {p.area_sqft!==null&&p.area_sqft!==undefined&&p.area_sqft!==''&&<div className="card-area">{Number(p.area_sqft).toLocaleString('en-IN',{maximumFractionDigits:2})} sq.ft.</div>}
    {p.price_per_sqft!==null&&p.price_per_sqft!==undefined&&p.price_per_sqft!==''&&<div className="card-price-per-sqft"><span>Price per sq.ft.</span><strong>₹{Number(p.price_per_sqft).toLocaleString('en-IN',{maximumFractionDigits:2})} / sq.ft.</strong></div>}
    <div className="card-meta">{p.property_type==='Plot'?<span className={`plot-card-status ${plotStatusClass}`}>{plotStatus||'AVAILABILITY NOT UPDATED'}</span>:posted&&<span><CalendarDays size={14}/>{posted.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>}<button className="share-btn" onClick={share} aria-label="Share property"><Share2 size={15}/></button><Link to={`/property/${p.id}`} className="view-link">View <ArrowUpRight size={15}/></Link></div></div>
  </article>
}
