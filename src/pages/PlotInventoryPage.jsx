import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Building2, Upload, Plus, RefreshCw, Trash2, FileSpreadsheet, MapPin } from 'lucide-react'

const STATUSES = ['available','reserved','sold','blocked']
const statusLabel = value => ({available:'Available',reserved:'Reserved',sold:'Sold',blocked:'Blocked'}[value] || value)
const money = value => value === null || value === undefined || value === '' ? '—' : '₹' + Number(value).toLocaleString('en-IN',{maximumFractionDigits:0})

function parseCsv(text) {
  const rows=[]; let row=[]; let cell=''; let quoted=false
  for(let i=0;i<text.length;i++){
    const c=text[i]
    if(c==='"' && quoted && text[i+1]==='"'){cell+='"';i++}
    else if(c==='"')quoted=!quoted
    else if(c===',' && !quoted){row.push(cell.trim());cell=''}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(v=>v!==''))rows.push(row);row=[];cell=''}
    else cell+=c
  }
  row.push(cell.trim());if(row.some(v=>v!==''))rows.push(row)
  if(rows.length<2)throw new Error('CSV must contain a header row and at least one plot.')
  const headers=rows.shift().map(v=>v.toLowerCase().replace(/[\s-]+/g,'_'))
  const aliases={plot_no:'plot_number',number:'plot_number',area:'area_sqft',sqft:'area_sqft',amount:'price',x:'layout_x',y:'layout_y'}
  const index={};headers.forEach((h,i)=>index[aliases[h]||h]=i)
  if(index.plot_number===undefined)throw new Error('CSV needs a plot_number column.')
  return rows.map((values,i)=>{
    const get=k=>index[k]===undefined?'':values[index[k]]||''
    const status=(get('status')||'available').toLowerCase()
    if(!STATUSES.includes(status))throw new Error('Invalid status on CSV row '+(i+2)+'. Use available, reserved, sold or blocked.')
    const number=get('plot_number').trim()
    if(!number)throw new Error('Plot number is missing on CSV row '+(i+2)+'.')
    return {plot_number:number,area_sqft:get('area_sqft')?Number(get('area_sqft')):null,price:get('price')?Number(get('price')):null,status,layout_x:get('layout_x')?Number(get('layout_x')):null,layout_y:get('layout_y')?Number(get('layout_y')):null,notes:get('notes')||null}
  })
}

export default function PlotInventoryPage(){
 const [listings,setListings]=useState([]),[projects,setProjects]=useState([]),[selected,setSelected]=useState(''),[plots,setPlots]=useState([])
 const [newListing,setNewListing]=useState(''),[layout,setLayout]=useState(null),[csv,setCsv]=useState(null),[plotForm,setPlotForm]=useState({plot_number:'',area_sqft:'',price:'',status:'available'})
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[filter,setFilter]=useState('all'),[search,setSearch]=useState('')
 const project=projects.find(p=>p.id===selected)
 const load=async()=>{
  const [{data:listingData,error:listingError},{data:projectData,error:projectError}]=await Promise.all([
   supabase.from('listings').select('id,title,city,district,status,property_type').eq('property_type','Plot').order('created_at',{ascending:false}),
   supabase.from('plot_projects').select('*, listing:listings(id,title,city,district,status)').order('created_at',{ascending:false})
  ])
  if(listingError)throw listingError;if(projectError)throw projectError
  setListings(listingData||[]);setProjects(projectData||[])
 }
 const loadPlots=async projectId=>{
  if(!projectId){setPlots([]);return}
  const {data,error}=await supabase.from('project_plots').select('*').eq('project_id',projectId).order('plot_number')
  if(error)throw error;setPlots(data||[])
 }
 useEffect(()=>{load().catch(e=>setMessage(e.message||'Unable to load plot inventory.'))},[])
 useEffect(()=>{loadPlots(selected).catch(e=>setMessage(e.message||'Unable to load plots.'))},[selected])
 const visiblePlots=useMemo(()=>plots.filter(p=>(filter==='all'||p.status===filter)&&p.plot_number.toLowerCase().includes(search.toLowerCase())),[plots,filter,search])
 const counts=useMemo(()=>STATUSES.reduce((a,s)=>(a[s]=plots.filter(p=>p.status===s).length,a),{}),[plots])
 const chooseProject=async e=>{const id=e.target.value;setSelected(id);setMessage('')}
 const createProject=async()=>{
  if(!newListing)return setMessage('Select an approved or pending Plot listing first.')
  setBusy(true);setMessage('')
  try{const {data,error}=await supabase.from('plot_projects').insert({listing_id:newListing}).select().single();if(error)throw error;await load();setSelected(data.id);setNewListing('');setMessage('Plot inventory project created.')}
  catch(e){setMessage(e.message||'Could not create project.')}
  finally{setBusy(false)}
 }
 const importCsv=async()=>{
  if(!project||!csv)return
  setBusy(true);setMessage('')
  try{
   const parsed=parseCsv(await csv.text())
   const rows=parsed.map(p=>({...p,project_id:project.id}))
   const {error}=await supabase.from('project_plots').upsert(rows,{onConflict:'project_id,plot_number'})
   if(error)throw error
   await loadPlots(project.id);setCsv(null);setMessage(parsed.length+' plot records imported. Existing matching plot numbers were updated.')
  }catch(e){setMessage(e.message||'CSV import failed.')}
  finally{setBusy(false)}
 }
 const uploadLayout=async()=>{
  if(!project||!layout)return
  if(!['image/jpeg','image/png','image/webp'].includes(layout.type)||layout.size>10*1024*1024)return setMessage('Choose a JPG, PNG or WebP layout image up to 10 MB.')
  setBusy(true);setMessage('')
  try{
   const path=project.id+'/'+Date.now()+'-'+layout.name.replace(/[^a-zA-Z0-9._-]/g,'_')
   const {error:uploadError}=await supabase.storage.from('plot-layouts').upload(path,layout,{upsert:true})
   if(uploadError)throw uploadError
   const {data:publicData}=supabase.storage.from('plot-layouts').getPublicUrl(path)
   const {error}=await supabase.from('plot_projects').update({layout_image_url:publicData.publicUrl,updated_at:new Date().toISOString()}).eq('id',project.id)
   if(error)throw error
   await load();setLayout(null);setMessage('Project layout image uploaded.')
  }catch(e){setMessage(e.message||'Layout upload failed.')}
  finally{setBusy(false)}
 }
 const updateStatus=async(id,status)=>{
  const {error}=await supabase.from('project_plots').update({status,updated_at:new Date().toISOString(),reserved_at:status==='reserved'?new Date().toISOString():null,sold_at:status==='sold'?new Date().toISOString():null}).eq('id',id)
  if(error)setMessage(error.message);else await loadPlots(selected)
 }
 const bulkStatus=async status=>{
  const ids=visiblePlots.map(p=>p.id);if(!ids.length)return
  if(!window.confirm('Change '+ids.length+' visible plots to '+statusLabel(status)+'?'))return
  setBusy(true);const {error}=await supabase.from('project_plots').update({status,updated_at:new Date().toISOString()}).in('id',ids)
  if(error)setMessage(error.message);else{setMessage(ids.length+' plots updated.');await loadPlots(selected)}setBusy(false)
 }
 const addPlot=async e=>{
  e.preventDefault();if(!project)return
  setBusy(true);const payload={project_id:project.id,plot_number:plotForm.plot_number.trim(),area_sqft:plotForm.area_sqft?Number(plotForm.area_sqft):null,price:plotForm.price?Number(plotForm.price):null,status:plotForm.status}
  const {error}=await supabase.from('project_plots').insert(payload)
  if(error)setMessage(error.message);else{setPlotForm({plot_number:'',area_sqft:'',price:'',status:'available'});setMessage('Plot added.');await loadPlots(selected)}setBusy(false)
 }
 const deletePlot=async id=>{if(!window.confirm('Delete this plot record?'))return;const {error}=await supabase.from('project_plots').delete().eq('id',id);if(error)setMessage(error.message);else await loadPlots(selected)}
 return <section className="section page-section plot-inventory-page">
  <div className="section-heading"><div><span className="eyebrow">INVENTORY CONTROL</span><h1>Plot Inventory</h1><p className="muted">Manage plot layouts, bulk imports and availability independently of listing approval.</p></div><Link className="btn btn-outline" to="/admin">← Admin dashboard</Link></div>
  {message&&<p className="notice" role="status">{message}</p>}
  <div className="plot-project-toolbar"><label>Project inventory<select value={selected} onChange={chooseProject}><option value="">Select a project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.listing?.title||'Untitled project'} — {p.listing?.city||''}</option>)}</select></label><div className="plot-create"><label>Create from Plot listing<select value={newListing} onChange={e=>setNewListing(e.target.value)}><option value="">Select a Plot listing</option>{listings.filter(l=>!projects.some(p=>p.listing_id===l.id)).map(l=><option key={l.id} value={l.id}>{l.title} · {l.city} · {l.status}</option>)}</select></label><button className="btn btn-primary" onClick={createProject} disabled={busy||!newListing}><Plus size={16}/> Create inventory</button></div></div>
  {project&&<><div className="plot-inventory-stats">{STATUSES.map(s=><div className={'plot-stat plot-stat-'+s} key={s}><b>{counts[s]||0}</b><span>{statusLabel(s)}</span></div>)}<div className="plot-stat"><b>{plots.length}</b><span>Total plots</span></div></div>
   <div className="plot-tools-grid"><div className="form-card"><h3><FileSpreadsheet size={18}/> Bulk CSV import</h3><p className="muted">Required column: plot_number. Optional: area_sqft, price, status, layout_x, layout_y, notes. Existing plot numbers are updated.</p><label className="upload-box"><Upload/> Choose CSV<input type="file" accept=".csv,text/csv" onChange={e=>setCsv(e.target.files?.[0]||null)}/><small>{csv?.name||'CSV file'}</small></label><button className="btn btn-primary full" onClick={importCsv} disabled={busy||!csv}>Import plots</button><button className="btn btn-ghost full" onClick={()=>{const sample='plot_number,area_sqft,price,status,layout_x,layout_y,notes\nA-01,1200,1800000,available,20,30,North facing\nA-02,1200,1800000,reserved,40,30,';const blob=new Blob([sample],{type:'text/csv'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='mrsa-plot-inventory-template.csv';a.click();URL.revokeObjectURL(url)}}>Download CSV template</button></div>
    <div className="form-card"><h3><MapPin size={18}/> Project layout image</h3>{project.layout_image_url&&<img className="plot-layout-preview" src={project.layout_image_url} alt="Project plot layout"/>}<label className="upload-box"><Upload/> Upload layout (JPG / PNG / WebP)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setLayout(e.target.files?.[0]||null)}/><small>{layout?.name||'Maximum 10 MB'}</small></label><button className="btn btn-primary full" onClick={uploadLayout} disabled={busy||!layout}>Upload layout</button></div>
   </div>
   <form className="form-card plot-add-form" onSubmit={addPlot}><h3>Add individual plot</h3><div className="two-fields"><label>Plot number<input required value={plotForm.plot_number} onChange={e=>setPlotForm({...plotForm,plot_number:e.target.value})} placeholder="A-01"/></label><label>Area (sq.ft.)<input type="number" min="1" step="0.01" value={plotForm.area_sqft} onChange={e=>setPlotForm({...plotForm,area_sqft:e.target.value})}/></label><label>Price (₹)<input type="number" min="0" step="1" value={plotForm.price} onChange={e=>setPlotForm({...plotForm,price:e.target.value})}/></label><label>Status<select value={plotForm.status} onChange={e=>setPlotForm({...plotForm,status:e.target.value})}>{STATUSES.map(s=><option key={s} value={s}>{statusLabel(s)}</option>)}</select></label></div><button className="btn btn-primary" disabled={busy}>Add plot</button></form>
   <div className="plot-list-toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search plot number"/><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All statuses</option>{STATUSES.map(s=><option key={s} value={s}>{statusLabel(s)}</option>)}</select><select aria-label="Bulk update visible plots" onChange={e=>{if(e.target.value)bulkStatus(e.target.value);e.target.value=''}}><option value="">Bulk update visible…</option>{STATUSES.map(s=><option key={s} value={s}>Set {statusLabel(s)}</option>)}</select><button className="btn btn-ghost" onClick={()=>loadPlots(selected)}><RefreshCw size={15}/> Refresh</button></div>
   <div className="plot-table-wrap"><table className="plot-table"><thead><tr><th>Plot</th><th>Area</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visiblePlots.map(p=><tr key={p.id}><td><b>{p.plot_number}</b>{p.notes&&<small>{p.notes}</small>}</td><td>{p.area_sqft?Number(p.area_sqft).toLocaleString('en-IN')+' sq.ft.':'—'}</td><td>{money(p.price)}</td><td><select className={'plot-status-select plot-status-'+p.status} value={p.status} onChange={e=>updateStatus(p.id,e.target.value)}>{STATUSES.map(s=><option key={s} value={s}>{statusLabel(s)}</option>)}</select></td><td><button className="icon-btn danger" title="Delete plot" onClick={()=>deletePlot(p.id)}><Trash2 size={16}/></button></td></tr>)}{!visiblePlots.length&&<tr><td colSpan="5" className="plot-empty">No plots found for this filter.</td></tr>}</tbody></table></div>
  </>}
 </section>
}
