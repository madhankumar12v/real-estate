import { MapPin, BedDouble, Ruler, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { money, placeholder } from '../lib/helpers'
export default function PropertyCard({p}) {
  return <article className="property-card"><Link to={`/property/${p.id}`} className="card-image"><img src={p.images?.[0] || placeholder} alt={p.title}/><span className="status-pill">{p.property_type}</span></Link>
    <div className="card-body"><div className="price">{money(p.price)}</div><Link to={`/property/${p.id}`}><h3>{p.title}</h3></Link><p className="muted"><MapPin size={15}/>{p.locality ? `${p.locality}, ` : ''}{p.city}, {p.district}</p>
    <div className="card-meta">{p.bedrooms ? <span><BedDouble size={15}/>{p.bedrooms} BHK</span>:null}{p.area_sqft ? <span><Ruler size={15}/>{p.area_sqft} sq.ft</span>:null}<Link to={`/property/${p.id}`} className="view-link">View <ArrowUpRight size={15}/></Link></div></div>
  </article>
}