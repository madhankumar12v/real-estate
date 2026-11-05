import { useEffect, useState } from 'react'
import { MapPin, BedDouble, Ruler, ArrowUpRight, Heart, Share2, CalendarDays } from 'lucide-react'
import { Link } from 'react-router-dom'
import { money, placeholder } from '../lib/helpers'
import { getFavorites, toggleFavorite } from '../lib/favorites'
export default function PropertyCard({p}) {
  const [saved,setSaved]=useState(false)
  useEffect(()=>{setSaved(getFavorites().includes(p.id))},[p.id])
  const share=()=>{const url=new URL(`/property/${p.id}`,window.location.origin).toString();if(navigator.share)navigator.share({title:p.title,url}).catch(()=>{});else if(navigator.clipboard?.writeText)navigator.clipboard.writeText(url).then(()=>window.alert('Property link copied.')).catch(()=>window.prompt('Copy property link',url));else window.prompt('Copy property link',url)}
  const posted=p.created_at?new Date(p.created_at):null
  const isNew=posted && (Date.now()-posted.getTime())<14*24*60*60*1000
  return <article className="property-card"><div className="card-image-wrap"><Link to={`/property/${p.id}`} className="card-image"><img src={p.images?.[0] || placeholder} alt={p.title} loading="lazy" decoding="async"/><span className="status-pill">{p.property_type}</span>{isNew&&<span className="new-pill">New</span>}</Link><button className={saved?'favorite-btn saved':'favorite-btn'} aria-label={saved?'Remove saved property':'Save property'} aria-pressed={saved} onClick={()=>setSaved(toggleFavorite(p.id))}><Heart size={18} fill={saved?'currentColor':'none'}/></button></div>
    <div className="card-body"><div className="price">{money(p.price)}</div><Link to={`/property/${p.id}`}><h3>{p.title}</h3></Link><p className="muted"><MapPin size={15}/>{p.locality ? `${p.locality}, ` : ''}{p.city}, {p.district}</p>
    <div className="card-meta">{p.bedrooms ? <span><BedDouble size={15}/>{p.bedrooms} BHK</span>:null}{p.area_sqft ? <span><Ruler size={15}/>{p.area_sqft} sq.ft</span>:null}{posted&&<span><CalendarDays size={14}/>{posted.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>}<button className="share-btn" onClick={share} aria-label="Share property"><Share2 size={15}/></button><Link to={`/property/${p.id}`} className="view-link">View <ArrowUpRight size={15}/></Link></div></div>
  </article>
}