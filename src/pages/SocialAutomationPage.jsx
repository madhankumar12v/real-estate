import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PauseCircle, PlayCircle, RefreshCw, ShieldCheck, Facebook, Instagram } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function SocialAutomationPage({user}){
  const [settings,setSettings]=useState(null)
  const [runtime,setRuntime]=useState(null)
  const [counts,setCounts]=useState({facebookQueued:0,instagramQueued:0,facebookFailed:0,instagramFailed:0,facebookPublished:0,instagramPublished:0})
  const [propertyHistory,setPropertyHistory]=useState({facebook:[],instagram:[]})
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const load=async()=>{
    setLoading(true);setError('')
    try{
      const {data,error:settingsError}=await supabase.from('social_automation_settings').select('enabled,updated_at').eq('id',1).single()
      if(settingsError)throw settingsError
      setSettings(data)
      const {data:sessionData}=await supabase.auth.getSession()
      const statusResponse=await fetch('/api/social-automation/status',{headers:{Authorization:'Bearer '+(sessionData.session?.access_token||'')}})
      const statusData=await statusResponse.json().catch(()=>({}))
      if(!statusResponse.ok)throw new Error(statusData.error||'Could not verify Cloudflare publishing secrets.')
      setRuntime(statusData)
      const historyResponse=await fetch('/api/social-automation/property-history',{headers:{Authorization:'Bearer '+(sessionData.session?.access_token||'')}})
      const historyData=await historyResponse.json().catch(()=>({}))
      if(!historyResponse.ok)throw new Error(historyData.error||'Could not load property publishing history.')
      setPropertyHistory({facebook:historyData.facebook||[],instagram:historyData.instagram||[]})
      const [fbQueued,igQueued,fbFailed,igFailed,fbPublished,igPublished]=await Promise.all([
        supabase.from('facebook_posts').select('id',{count:'exact',head:true}).eq('auto_generated',true).in('status',['draft','approved','publishing']),
        supabase.from('instagram_posts').select('id',{count:'exact',head:true}).eq('auto_generated',true).in('status',['draft','approved','publishing']),
        supabase.from('facebook_posts').select('id',{count:'exact',head:true}).eq('auto_generated',true).eq('status','failed'),
        supabase.from('instagram_posts').select('id',{count:'exact',head:true}).eq('auto_generated',true).eq('status','failed'),
        supabase.from('facebook_posts').select('id',{count:'exact',head:true}).eq('status','published'),
        supabase.from('instagram_posts').select('id',{count:'exact',head:true}).eq('status','published')
      ])
      for(const result of [fbQueued,igQueued,fbFailed,igFailed,fbPublished,igPublished])if(result.error)throw result.error
      setCounts({facebookQueued:fbQueued.count||0,instagramQueued:igQueued.count||0,facebookFailed:fbFailed.count||0,instagramFailed:igFailed.count||0,facebookPublished:fbPublished.count||0,instagramPublished:igPublished.count||0})
    }catch(err){setError(err.message||'Could not load automation settings. Run the Auto Marketing 2.0 Supabase migration first.')}
    finally{setLoading(false)}
  }
  useEffect(()=>{load()},[])
  const propertyRows=useMemo(()=>{
    const grouped=new Map()
    for(const [platform,rows] of [['facebook',propertyHistory.facebook],['instagram',propertyHistory.instagram]]){
      for(const post of rows){
        const key=post.listing_id||post.id
        if(!grouped.has(key))grouped.set(key,{id:key,title:post.listing?.title||'Property listing',city:post.listing?.city||'',facebook:[],instagram:[]})
        grouped.get(key)[platform].push(post)
      }
    }
    return [...grouped.values()].sort((a,b)=>(b.facebook.length+b.instagram.length)-(a.facebook.length+a.instagram.length))
  },[propertyHistory])
  const toggle=async()=>{
    if(!settings)return
    const enabled=!settings.enabled
    if(enabled&&(!runtime?.serviceRoleConfigured||!runtime?.facebookConfigured||!runtime?.instagramConfigured)){setError('Configure the Supabase service-role, Facebook Page and Instagram credentials in Cloudflare Production Secrets before enabling automation.');return}
    setSaving(true);setError('');setNotice('')
    try{
      const {data,error}=await supabase.from('social_automation_settings').update({enabled,updated_by:user?.id||null,updated_at:new Date().toISOString()}).eq('id',1).select('enabled,updated_at').single()
      if(error)throw error
      setSettings(data)
      setNotice(enabled?'Automatic publishing enabled. New property approvals create drafts only; each platform post still requires your approval.':'Automatic publishing paused. No queued posts will be sent until you resume.')
    }catch(err){setError(err.message||'Could not update the automation setting.')}
    finally{setSaving(false)}
  }
  return <section className="section page-section instagram-publishing-page">
    <div className="instagram-publishing-heading">
      <div><span className="eyebrow">MRSA PROPERTIES · ADMIN</span><h1>Auto Marketing 2.0</h1><p className="muted">Prepare Facebook and Instagram posts for each approved property. Every individual social post requires a separate admin approval before publishing.</p></div>
      <div className="instagram-publishing-actions"><button className="btn btn-outline" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button><Link className="btn btn-outline" to="/admin">← Admin dashboard</Link></div>
    </div>
    {notice&&<div className="instagram-publishing-notice" role="status">{notice}</div>}
    {error&&<div className="instagram-publishing-error" role="alert">{error}</div>}
    <article className="instagram-publishing-panel" style={{maxWidth:760,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
        <div><span className="eyebrow">MASTER CONTROL</span><h2 style={{margin:'8px 0'}}>Automatic publishing</h2><p className="muted">{settings?.enabled?'New property approvals create social post drafts. Each Facebook and Instagram post must be approved separately before publishing.':'Publishing is paused. New approvals will not be queued.'}</p></div>
        <span className={'instagram-status instagram-status-'+(settings?.enabled?'published':'draft')}>{loading?'Loading':settings?.enabled?'Active':'Paused'}</span>
      </div>
      <button className={'btn '+(settings?.enabled?'btn-outline':'btn-primary')} style={{marginTop:18}} disabled={loading||saving||!settings||(!settings.enabled&&(!runtime?.serviceRoleConfigured||!runtime?.facebookConfigured||!runtime?.instagramConfigured))} onClick={toggle}>
        {settings?.enabled?<><PauseCircle size={17}/>{saving?'Pausing…':'Pause automation'}</>:<><PlayCircle size={17}/>{saving?'Resuming…':'Resume automation'}</>}
      </button>
      <div className="instagram-setup-note" style={{marginTop:20}}><b><ShieldCheck size={14} style={{verticalAlign:'-3px'}}/> Publishing rules</b><br/>Only listings approved by an administrator are queued. Facebook and Instagram are processed by the Cloudflare Worker every minute. Each platform has a separate duplicate guard and status history. Temporary failures retry automatically; permanent errors are shown in the publishing queues. Pausing stops the scheduler from sending queued posts.</div>
      <div style={{display:'grid',gap:8,marginTop:16}}>
        <b>Cloudflare connection checks</b>
        <div className="instagram-post-meta">Supabase service-role secret: {runtime?.serviceRoleConfigured?'Configured':'Missing'}</div>
        <div className="instagram-post-meta">Facebook Page credentials: {runtime?.facebookConfigured?'Configured':'Missing'}</div>
        <div className="instagram-post-meta">Instagram credentials: {runtime?.instagramConfigured?'Configured':'Missing'}</div>
      </div>
    </article>
    <div className="admin-stats" style={{marginTop:24}}>
      <div><b>{counts.facebookQueued}</b><span><Facebook size={14}/> Facebook queue items</span></div>
      <div><b>{counts.instagramQueued}</b><span><Instagram size={14}/> Instagram queue items</span></div>
      <div><b>{counts.facebookPublished}</b><span><Facebook size={14}/> Published on Facebook Page</span></div>
      <div><b>{counts.instagramPublished}</b><span><Instagram size={14}/> Published on Instagram account</span></div>
      <div><b>{counts.facebookPublished+counts.instagramPublished}</b><span>Combined platform publications</span></div>
      <div><b>{counts.facebookFailed+counts.instagramFailed}</b><span>Failed across both platforms</span></div>
    </div>
    <p className="instagram-post-meta" style={{textAlign:'center',marginTop:10}}>Published totals count posts tracked in MrSa's publishing database, including manual and automatic posts.</p>
    <section className="instagram-publishing-panel" style={{marginTop:24}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
        <div><h2 style={{margin:'0 0 6px'}}>Property-wise publishing history</h2><p className="muted" style={{margin:0}}>Successful posts per property on each platform.</p></div>
        <span className="instagram-post-meta">{propertyRows.length} properties posted</span>
      </div>
      {propertyRows.length?<div style={{overflowX:'auto',marginTop:16}}>
        <table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}>
          <thead><tr><th style={{padding:'10px 8px'}}>Property</th><th style={{padding:'10px 8px',textAlign:'center'}}><Facebook size={15}/> Facebook</th><th style={{padding:'10px 8px',textAlign:'center'}}><Instagram size={15}/> Instagram</th><th style={{padding:'10px 8px',textAlign:'center'}}>Total</th><th style={{padding:'10px 8px'}}>Latest post</th></tr></thead>
          <tbody>{propertyRows.map(row=>{
            const all=[...row.facebook.map(p=>({...p,platform:'Facebook'})),...row.instagram.map(p=>({...p,platform:'Instagram'}))].sort((x,y)=>new Date(y.published_at||0)-new Date(x.published_at||0))
            const latest=all[0]
            return <tr key={row.id} style={{borderTop:'1px solid var(--border-color, #e5e7eb)'}}>
              <td style={{padding:'12px 8px'}}><b>{row.title}</b>{row.city&&<div className="instagram-post-meta">{row.city}</div>}</td>
              <td style={{padding:'12px 8px',textAlign:'center'}}>{row.facebook.length}</td>
              <td style={{padding:'12px 8px',textAlign:'center'}}>{row.instagram.length}</td>
              <td style={{padding:'12px 8px',textAlign:'center'}}><b>{row.facebook.length+row.instagram.length}</b></td>
              <td style={{padding:'12px 8px'}}>{latest?.permalink?<a className="text-link" href={latest.permalink} target="_blank" rel="noreferrer">View {latest.platform} <span className="instagram-post-meta">{latest.published_at?new Date(latest.published_at).toLocaleDateString('en-IN'):''}</span></a>:'—'}</td>
            </tr>
          })}</tbody>
        </table>
      </div>:<div className="instagram-empty" style={{marginTop:14}}>No successful property posts recorded yet.</div>}
    </section>
    <div className="instagram-publishing-actions" style={{justifyContent:'center',marginTop:18}}><Link className="btn btn-outline" to="/admin/facebook">Open Facebook queue</Link><Link className="btn btn-outline" to="/admin/instagram">Open Instagram queue</Link></div>
    <p className="muted" style={{textAlign:'center',marginTop:18}}>Last setting update: {settings?.updated_at?new Date(settings.updated_at).toLocaleString('en-IN'):'—'}</p>
  </section>
}
