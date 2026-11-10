import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { MapPin, Search } from 'lucide-react'

const labels={available:'Available',reserved:'Reserved',sold:'Sold',blocked:'Blocked'}
const price=value=>value===null||value===undefined||value===''?'Price on request':'₹'+Number(value).toLocaleString('en-IN',{maximumFractionDigits:0})
export default function PublicPlotInventory({listingId}){
 const [project,setProject]=useState(null),[plots,setPlots]=useState([]),[query,setQuery]=useState(''),[selected,setSelected]=useState(null),[loading,setLoading]=useState(true)
 useEffect(()=>{let live=true;(async()=>{const {data,error}=await supabase.from('plot_projects').select('id,layout_image_url').eq('listing_id',listingId).maybeSingle();if(!live)return;if(error){console.warn('Plot inventory unavailable:',error.message);setLoading(false);return}if(!data){setLoading(false);return}const {data:rows,error:plotError}=await supabase.from('project_plots').select('id,plot_number,area_sqft,price,status,layout_x,layout_y,notes').eq('project_id',data.id).order('plot_number');if(!live)return;if(!plotError){setProject(data);setPlots(rows||[])}setLoading(false)})();return()=>{live=false}},[listingId])
 const counts=useMemo(()=>plots.reduce((a,p)=>(a[p.status]=(a[p.status]||0)+1,a),{}),[plots])
 const visible=plots.filter(p=>p.plot_number.toLowerCase().includes(query.toLowerCase()))
 if(loading||!project||!plots.length)return null
 return <section className="public-plot-inventory"><div className="public-plot-heading"><div><span className="eyebrow">PLOT AVAILABILITY</span><h2>Project plot inventory</h2><p className="muted">Check individual plot numbers and current availability.</p></div><b>{counts.available||0} available / {plots.length} plots</b></div>
  <div className="public-plot-legend">{Object.keys(labels).map(s=><span key={s}><i className={'plot-dot plot-dot-'+s}/>{labels[s]} ({counts[s]||0})</span>)}</div>
  {project.layout_image_url&&<div className="public-plot-map"><img src={project.layout_image_url} alt="Project plot layout"/>{plots.filter(p=>p.layout_x!==null&&p.layout_y!==null).map(p=><button key={p.id} type="button" className={'plot-map-pin plot-pin-'+p.status+(selected?.id===p.id?' selected':'')} style={{left:p.layout_x+'%',top:p.layout_y+'%'}} onClick={()=>setSelected(p)} title={'Plot '+p.plot_number+' — '+labels[p.status]}>{p.plot_number}</button>)}</div>}
  <label className="public-plot-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search plot number"/></label>
  {selected&&<div className="public-selected-plot"><b>Plot {selected.plot_number}</b><span>{selected.area_sqft?Number(selected.area_sqft).toLocaleString('en-IN')+' sq.ft.':'Area on request'}</span><strong>{price(selected.price)}</strong><span className={'plot-public-status plot-public-'+selected.status}>{labels[selected.status]}</span><button type="button" onClick={()=>setSelected(null)}>Close</button></div>}
  <div className="public-plot-grid">{visible.map(p=><button type="button" key={p.id} className={'public-plot-card plot-card-'+p.status+(selected?.id===p.id?' selected':'')} onClick={()=>setSelected(p)}><b>{p.plot_number}</b><span>{p.area_sqft?Number(p.area_sqft).toLocaleString('en-IN')+' sq.ft.':'Area on request'}</span><strong>{price(p.price)}</strong><small>{labels[p.status]}</small></button>)}</div>
  <p className="tiny"><MapPin size={12}/> Availability may change. Please contact the seller to confirm the latest status and terms.</p>
 </section>
}
