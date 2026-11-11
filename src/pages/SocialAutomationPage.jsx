import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PauseCircle, PlayCircle, RefreshCw, ShieldCheck, Facebook, Instagram, Check, X, Trash2, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function SocialAutomationPage({user}){
  const [settings,setSettings]=useState(null)
  const [runtime,setRuntime]=useState(null)
  const [counts,setCounts]=useState({facebookQueued:0,instagramQueued:0,facebookFailed:0,instagramFailed:0,facebookPublished:0,instagramPublished:0})
  const [propertyHistory,setPropertyHistory]=useState({facebook:[],instagram:[]})
  const [queuePosts,setQueuePosts]=useState({facebook:[],instagram:[]})
  const [workingPost,setWorkingPost]=useState('')
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
      const [fbQueueResponse,igQueueResponse]=await Promise.all([fetch('/api/facebook/posts',{headers:{Authorization:'Bearer '+(sessionData.session?.access_token||'')}}),fetch('/api/instagram/posts',{headers:{Authorization:'Bearer '+(sessionData.session?.access_token||'')}})])
      const [fbQueueData,igQueueData]=await Promise.all([fbQueueResponse.json().catch(()=>({})),igQueueResponse.json().catch(()=>({}))])
      if(!fbQueueResponse.ok)throw new Error(fbQueueData.error||'Could not load Facebook approval queue.')
      if(!igQueueResponse.ok)throw new Error(igQueueData.error||'Could not load Instagram approval queue.')
      setQueuePosts({facebook:fbQueueData.posts||[],instagram:igQueueData.posts||[]})
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
        if(!grouped.has(key))grouped.set(key,{id:key,title:post.listing?.title||'Property listing',city:post.listing?.city||post.listing?.district||'',facebook:[],instagram:[],postedCount:0,latest:null})
        const row=grouped.get(key)
        row[platform].push(post)
        row.postedCount+=1
        if(!row.latest||new Date(post.published_at||0)>new Date(row.latest.published_at||0))row.latest={...post,platform}
      }
    }
    for(const [platform,rows] of [['facebook',queuePosts.facebook],['instagram',queuePosts.instagram]]){
      for(const post of rows){
        const key=post.listing_id||post.listing?.id||post.id
        if(!grouped.has(key))grouped.set(key,{id:key,title:post.listing?.title||'Property listing',city:post.listing?.city||post.listing?.district||'',facebook:[],instagram:[],postedCount:0,latest:null})
        const row=grouped.get(key)
        if(!row[platform].some(item=>item.id===post.id))row[platform].push(post)
      }
    }
    return [...grouped.values()].sort((a,b)=>a.title.localeCompare(b.title))
  },[propertyHistory,queuePosts])
  const actOnPost=async(platform,id,action)=>{
    if(action==='delete'&&!window.confirm('Delete this '+platform+' queue item? This will not delete the property listing.'))return
    const key=platform+':'+id
    setWorkingPost(key);setError('');setNotice('')
    try{
      const {data:sessionData}=await supabase.auth.getSession()
      const response=await fetch('/api/'+platform+'/posts/'+encodeURIComponent(id)+'/'+action,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(sessionData.session?.access_token||'')},body:'{}'})
      const result=await response.json().catch(()=>({}))
      if(!response.ok)throw new Error(result.error||'Could not '+action+' '+platform+' post.')
      setNotice(action==='approve'?platform+' post approved.':action==='reject'?platform+' post rejected.':platform+' queue item deleted.')
      await load()
    }catch(err){setError(err.message||'The post action failed.')}
    finally{setWorkingPost('')}
  }
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
      <div><span className="eyebrow">MRSA PROPERTIES · ADMIN</span><h1>Auto Marketing 3.0</h1><p className="muted">Daily queue review at 10:00 AM IST. Individually approved Facebook and Instagram posts publish one per platform per hour, with property rotation.</p></div>
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
      <div className="instagram-setup-note" style={{marginTop:20}}><b><ShieldCheck size={14} style={{verticalAlign:'-3px'}}/> Publishing rules</b><br/>Only listings approved by an administrator are queued. Daily queue review: 10:00 AM IST. Publishing window: 10:00 AM–10:00 PM IST (no publishing overnight). Rate limit: one Facebook post and one Instagram post per hourly slot. Queue priority: rotate toward the property least recently published on that platform. Facebook and Instagram approvals remain separate. Only individually approved posts with approval metadata can publish. Temporary failures retry in later hourly slots; permanent errors are shown in the publishing queues. Pausing stops the scheduler from sending queued posts.</div>
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
        <div><h2 style={{margin:'0 0 6px'}}>Property publishing manager</h2><p className="muted" style={{margin:0}}>Approve, reject or delete individual Facebook and Instagram posts. Published links and counts are shown per property.</p></div>
        <span className="instagram-post-meta">{propertyRows.length} properties in queue / history</span>
      </div>
      {propertyRows.length?<div style={{overflowX:'auto',marginTop:16}}>
        <table style={{width:'100%',minWidth:850,borderCollapse:'collapse',textAlign:'left'}}>
          <thead><tr><th style={{padding:'11px 9px'}}>Property</th><th style={{padding:'11px 9px'}}>Platform</th><th style={{padding:'11px 9px',textAlign:'center'}}>Approve</th><th style={{padding:'11px 9px',textAlign:'center'}}>Reject</th><th style={{padding:'11px 9px',textAlign:'center'}}>Delete</th><th style={{padding:'11px 9px',textAlign:'center'}}>Posted Count</th><th style={{padding:'11px 9px'}}>View</th></tr></thead>
          <tbody>{propertyRows.map(row=>{
            const posts=[...row.facebook.map(post=>({...post,platform:'facebook'})),...row.instagram.map(post=>({...post,platform:'instagram'}))]
            const latest=[...posts].filter(post=>post.status==='published'||post.permalink).sort((a,b)=>new Date(b.published_at||b.created_at||0)-new Date(a.published_at||a.created_at||0))[0]
            const pending=posts.filter(post=>!['published','publishing','rejected'].includes(post.status))
            const platforms=[...new Set(posts.map(post=>post.platform))]
            return <tr key={row.id} style={{borderTop:'1px solid var(--border-color, #e5e7eb)'}}>
              <td style={{padding:'13px 9px'}}><b>{row.title}</b>{row.city&&<div className="instagram-post-meta">{row.city}</div>}</td>
              <td style={{padding:'13px 9px'}}><div style={{display:'flex',gap:8,alignItems:'center'}}>{platforms.includes('facebook')&&<span title="Facebook"><Facebook size={18} color="#1877f2"/></span>}{platforms.includes('instagram')&&<span title="Instagram"><Instagram size={18} color="#b43d83"/></span>}{!platforms.length?'—':null}</div><div className="instagram-post-meta">{posts.map(post=><span key={post.platform+post.id} style={{display:'block'}}>{post.platform==='facebook'?'Facebook':'Instagram'} · {post.status}</span>)}</div></td>
              <td style={{padding:'13px 9px',textAlign:'center'}}>{pending.filter(post=>['draft','failed','approved'].includes(post.status)).map(post=><button key={post.platform+post.id} className="icon-btn success" title={'Approve '+post.platform+' post'} aria-label={'Approve '+post.platform+' post'} disabled={workingPost===post.platform+':'+post.id||post.status==='approved'&&post.approved_at&&post.approved_by} onClick={()=>actOnPost(post.platform,post.id,'approve')}><Check size={16}/></button>)}</td>
              <td style={{padding:'13px 9px',textAlign:'center'}}>{pending.filter(post=>post.status!=='rejected').map(post=><button key={post.platform+post.id} className="icon-btn warning" title={'Reject '+post.platform+' post'} aria-label={'Reject '+post.platform+' post'} disabled={workingPost===post.platform+':'+post.id} onClick={()=>actOnPost(post.platform,post.id,'reject')}><X size={16}/></button>)}</td>
              <td style={{padding:'13px 9px',textAlign:'center'}}>{posts.filter(post=>!['published','publishing'].includes(post.status)).map(post=><button key={post.platform+post.id} className="icon-btn danger" title={'Delete '+post.platform+' queue item'} aria-label={'Delete '+post.platform+' queue item'} disabled={workingPost===post.platform+':'+post.id} onClick={()=>actOnPost(post.platform,post.id,'delete')}><Trash2 size={16}/></button>)}</td>
              <td style={{padding:'13px 9px',textAlign:'center'}}><b>{row.postedCount}</b></td>
              <td style={{padding:'13px 9px'}}>{latest?.permalink?<a className="text-link" href={latest.permalink} target="_blank" rel="noreferrer">View {latest.platform==='facebook'?'Facebook':'Instagram'} <ExternalLink size={13}/> <span className="instagram-post-meta">{latest.published_at?new Date(latest.published_at).toLocaleDateString('en-IN'):''}</span></a>:'—'}</td>
            </tr>
          })}</tbody>
        </table>
      </div>:<div className="instagram-empty" style={{marginTop:14}}>No property posts or queue items found.</div>}
    </section>
    <section className="instagram-publishing-panel" style={{marginTop:18}}>
      <h2 style={{margin:'0 0 6px'}}>History · Recently posted</h2>
      <p className="muted" style={{margin:0}}>Latest published property posts across both platforms.</p>
      {[...propertyRows].filter(row=>row.latest).sort((a,b)=>new Date(b.latest.published_at||0)-new Date(a.latest.published_at||0)).slice(0,8).length?<div style={{display:'grid',gap:10,marginTop:14}}>
        {[...propertyRows].filter(row=>row.latest).sort((a,b)=>new Date(b.latest.published_at||0)-new Date(a.latest.published_at||0)).slice(0,8).map(row=><div key={row.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:'11px 0',borderTop:'1px solid var(--border-color, #e5e7eb)'}}><div><b>{row.title}</b><div className="instagram-post-meta">{row.latest.platform==='facebook'?'Facebook':'Instagram'} · {row.latest.published_at?new Date(row.latest.published_at).toLocaleDateString('en-IN'):''}</div></div><a className="btn btn-outline" href={row.latest.permalink} target="_blank" rel="noreferrer">View more <ExternalLink size={13}/></a></div>)}
      </div>:<div className="instagram-empty" style={{marginTop:14}}>No recently published links found.</div>}
    </section>
    <div className="instagram-publishing-actions" style={{justifyContent:'center',marginTop:18}}><Link className="btn btn-outline" to="/admin/facebook">Open Facebook queue</Link><Link className="btn btn-outline" to="/admin/instagram">Open Instagram queue</Link></div>
    <p className="muted" style={{textAlign:'center',marginTop:18}}>Last setting update: {settings?.updated_at?new Date(settings.updated_at).toLocaleString('en-IN'):'—'}</p>
  </section>
}
