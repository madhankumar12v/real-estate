import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PauseCircle, PlayCircle, RefreshCw, ShieldCheck, Facebook, Instagram, Check, X, Trash2, ExternalLink, CalendarDays, Eye, MessageCircle, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function SocialAutomationPage({user, platformFilter = null, overviewOnly = false}){
  const [settings,setSettings]=useState(null)
  const [runtime,setRuntime]=useState(null)
  const [counts,setCounts]=useState({facebookQueued:0,instagramQueued:0,facebookFailed:0,instagramFailed:0,facebookRejected:0,instagramRejected:0,facebookReview:0,instagramReview:0,facebookPublished:0,instagramPublished:0})
  const [propertyHistory,setPropertyHistory]=useState({facebook:[],instagram:[]})
  const [queuePosts,setQueuePosts]=useState({facebook:[],instagram:[]})
  const [dailyReport,setDailyReport]=useState({visitors:0,sessions:0,pageViews:0,whatsappClicks:0,enquiries:0,facebookToday:0,instagramToday:0})
  const [workingPost,setWorkingPost]=useState('')
  const [rejectingPost,setRejectingPost]=useState(null)
  const [rejectReason,setRejectReason]=useState('')
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
      const [fbQueued,igQueued,fbFailed,igFailed,fbRejected,igRejected,fbReview,igReview,fbPublished,igPublished]=await Promise.all([
        supabase.from('facebook_posts').select('id',{count:'exact',head:true}).eq('auto_generated',true).in('status',['draft','approved','publishing']),
        supabase.from('instagram_posts').select('id',{count:'exact',head:true}).eq('auto_generated',true).in('status',['draft','approved','publishing']),
        supabase.from('facebook_posts').select('id',{count:'exact',head:true}).eq('auto_generated',true).eq('status','failed'),
        supabase.from('instagram_posts').select('id',{count:'exact',head:true}).eq('auto_generated',true).eq('status','failed'),
        supabase.from('facebook_posts').select('id',{count:'exact',head:true}).eq('auto_generated',true).eq('status','rejected'),
        supabase.from('instagram_posts').select('id',{count:'exact',head:true}).eq('auto_generated',true).eq('status','rejected'),
        supabase.from('facebook_posts').select('id',{count:'exact',head:true}).eq('auto_generated',true).eq('status','review_required'),
        supabase.from('instagram_posts').select('id',{count:'exact',head:true}).eq('auto_generated',true).eq('status','review_required'),
        supabase.from('facebook_posts').select('id',{count:'exact',head:true}).eq('status','published'),
        supabase.from('instagram_posts').select('id',{count:'exact',head:true}).eq('status','published')
      ])
      for(const result of [fbQueued,igQueued,fbFailed,igFailed,fbRejected,igRejected,fbReview,igReview,fbPublished,igPublished])if(result.error)throw result.error
      setCounts({facebookQueued:fbQueued.count||0,instagramQueued:igQueued.count||0,facebookFailed:fbFailed.count||0,instagramFailed:igFailed.count||0,facebookRejected:fbRejected.count||0,instagramRejected:igRejected.count||0,facebookReview:fbReview.count||0,instagramReview:igReview.count||0,facebookPublished:fbPublished.count||0,instagramPublished:igPublished.count||0})
      const dayStart=new Date();dayStart.setHours(0,0,0,0)
      const dayEnd=new Date(dayStart);dayEnd.setDate(dayEnd.getDate()+1)
      const from=dayStart.toISOString(),to=dayEnd.toISOString()
      const [trafficToday,enquiriesToday,facebookToday,instagramToday]=await Promise.all([
        supabase.rpc('get_admin_website_visitor_stats',{p_from:from,p_to:to}),
        supabase.from('enquiries').select('id',{count:'exact',head:true}).gte('created_at',from).lt('created_at',to),
        supabase.from('facebook_posts').select('id',{count:'exact',head:true}).eq('status','published').gte('published_at',from).lt('published_at',to),
        supabase.from('instagram_posts').select('id',{count:'exact',head:true}).eq('status','published').gte('published_at',from).lt('published_at',to)
      ])
      const traffic=trafficToday.data||{}
      const summary=traffic.summary||{}
      setDailyReport({visitors:Number(summary.period_visitors)||0,sessions:Number(summary.period_sessions)||0,pageViews:Number(summary.period_page_views)||0,whatsappClicks:Number(summary.period_whatsapp_clicks)||0,enquiries:enquiriesToday.count||0,facebookToday:facebookToday.count||0,instagramToday:instagramToday.count||0})
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
  const actOnPost=async(platform,id,action,reason='')=>{
    if(action==='delete'&&!window.confirm('Delete this '+platform+' queue item? This will not delete the property listing.'))return
    const key=platform+':'+id
    setWorkingPost(key);setError('');setNotice('')
    try{
      const {data:sessionData}=await supabase.auth.getSession()
      const response=await fetch('/api/'+platform+'/posts/'+encodeURIComponent(id)+'/'+action,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(sessionData.session?.access_token||'')},body:JSON.stringify(action==='reject'?{reason}: {})})
      const result=await response.json().catch(()=>({}))
      if(!response.ok)throw new Error(result.error||'Could not '+action+' '+platform+' post.')
      setNotice(action==='approve'?platform+' post approved and added to the publishing queue.':action==='reject'?platform+' post rejected. Reason saved.':platform+' queue item deleted.')
      if(action==='reject'){setRejectingPost(null);setRejectReason('')}
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
  const visibleRows=propertyRows.map(row=>{const posts=[...row.facebook.map(post=>({...post,platform:'facebook'})),...row.instagram.map(post=>({...post,platform:'instagram'}))].filter(post=>!platformFilter||post.platform===platformFilter);const latest=[...posts].filter(post=>post.status==='published'||post.permalink).sort((a,b)=>new Date(b.published_at||b.created_at||0)-new Date(a.published_at||a.created_at||0))[0]||null;return {...row,posts,latest,postedCount:posts.filter(post=>post.status==='published'||post.permalink).length}}).filter(row=>row.posts.length>0)
  const overviewMetrics=useMemo(()=>{
    const facebook=propertyRows.reduce((sum,row)=>sum+row.facebook.filter(post=>post.status==='published'||post.permalink).length,0)
    const instagram=propertyRows.reduce((sum,row)=>sum+row.instagram.filter(post=>post.status==='published'||post.permalink).length,0)
    const activeProperties=propertyRows.filter(row=>row.facebook.some(post=>post.status==='published'||post.permalink)||row.instagram.some(post=>post.status==='published'||post.permalink)).length
    return {facebook,instagram,total:facebook+instagram,activeProperties}
  },[propertyRows])
  return <section className="section page-section instagram-publishing-page">
    {notice&&<div className="instagram-publishing-notice" role="status">{notice}</div>}
    {error&&<div className="instagram-publishing-error" role="alert">{error}</div>}
    {!platformFilter&&!overviewOnly&&<>
    <div className="instagram-publishing-heading">
      <div><span className="eyebrow">MRSA PROPERTIES · ADMIN</span><h1>Auto Marketing 3.0</h1><p className="muted">Daily queue review at 10:00 AM IST. Individually approved Facebook and Instagram posts publish one per platform per hour, with property rotation.</p></div>
      <div className="instagram-publishing-actions"><button className="btn btn-outline" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button><Link className="btn btn-outline" to="/admin">← Admin dashboard</Link></div>
    </div>
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
    </>}
    {overviewOnly&&<section className="instagram-publishing-panel mrsa-overview-dashboard" style={{marginTop:8}}>
      <div className="mrsa-overview-heading">
        <div><span className="eyebrow">MRSA PROPERTIES · PERFORMANCE</span><h2 style={{margin:'7px 0 4px'}}>Publishing overview</h2><p className="muted" style={{margin:0}}>Track how each approved property is performing across your social channels.</p></div>
        <button className="btn btn-outline" onClick={load} disabled={loading}><RefreshCw size={15}/>{loading?'Refreshing…':'Refresh data'}</button>
      </div>
      {error&&<div className="instagram-publishing-error" role="alert" style={{marginTop:14}}>{error}</div>}
      <div className="mrsa-overview-kpis">
        <article className="mrsa-overview-kpi mrsa-kpi-total"><span className="mrsa-kpi-label">Total published</span><div><strong>{overviewMetrics.total}</strong><span className="mrsa-kpi-symbol">↗</span></div><small>Facebook + Instagram</small></article>
        <article className="mrsa-overview-kpi"><span className="mrsa-kpi-label"><Facebook size={15} color="#1877f2"/> Facebook published</span><strong>{overviewMetrics.facebook}</strong><small>Successfully published</small><div className="mrsa-kpi-track"><i style={{width:overviewMetrics.total?overviewMetrics.facebook/overviewMetrics.total*100+'%':'0%'}}/></div></article>
        <article className="mrsa-overview-kpi"><span className="mrsa-kpi-label"><Instagram size={15} color="#b43d83"/> Instagram published</span><strong>{overviewMetrics.instagram}</strong><small>Successfully published</small><div className="mrsa-kpi-track mrsa-kpi-instagram"><i style={{width:overviewMetrics.total?overviewMetrics.instagram/overviewMetrics.total*100+'%':'0%'}}/></div></article>
        <article className="mrsa-overview-kpi"><span className="mrsa-kpi-label">Properties published</span><strong>{overviewMetrics.activeProperties}</strong><small>Unique properties with posts</small></article>
      </div>
      <div className="mrsa-overview-table-head mrsa-status-heading"><div><h3>Queue &amp; post status</h3><p className="muted">Platform-wise counts to help you manage pending work and resolve issues.</p></div><span>{counts.facebookQueued+counts.instagramQueued} queued · {counts.facebookFailed+counts.instagramFailed} failed · {counts.facebookRejected+counts.instagramRejected} rejected · {counts.facebookReview+counts.instagramReview} verify</span></div>
      <div className="mrsa-status-grid">
        <article className="mrsa-status-card"><span><i className="mrsa-status-dot queue"/> Facebook queue</span><strong>{counts.facebookQueued}</strong><small>Draft + approved + publishing</small></article>
        <article className="mrsa-status-card"><span><i className="mrsa-status-dot queue"/> Instagram queue</span><strong>{counts.instagramQueued}</strong><small>Draft + approved + publishing</small></article>
        <article className="mrsa-status-card"><span><i className="mrsa-status-dot failed"/> Facebook failed</span><strong>{counts.facebookFailed}</strong><small>Needs review or retry</small></article>
        <article className="mrsa-status-card"><span><i className="mrsa-status-dot failed"/> Instagram failed</span><strong>{counts.instagramFailed}</strong><small>Needs review or retry</small></article>
        <article className="mrsa-status-card"><span><i className="mrsa-status-dot rejected"/> Facebook rejected</span><strong>{counts.facebookRejected}</strong><small>Not approved for publishing</small></article>
        <article className="mrsa-status-card"><span><i className="mrsa-status-dot rejected"/> Instagram rejected</span><strong>{counts.instagramRejected}</strong><small>Not approved for publishing</small></article>
        <article className="mrsa-status-card"><span><i className="mrsa-status-dot failed"/> Facebook verify first</span><strong>{counts.facebookReview}</strong><small>Check Meta before retrying</small></article>
        <article className="mrsa-status-card"><span><i className="mrsa-status-dot failed"/> Instagram verify first</span><strong>{counts.instagramReview}</strong><small>Check Meta before retrying</small></article>
      </div>
      <div className="mrsa-daily-report">
        <div className="mrsa-daily-report-heading"><div><span className="eyebrow"><CalendarDays size={13}/> DAILY MARKETING REPORT</span><h3>Today’s organic marketing activity</h3><p className="muted">Live figures for today · no paid-ad spend included</p></div><Link className="btn btn-outline" to="/admin/traffic-sources">Full traffic report →</Link></div>
        <div className="mrsa-daily-report-grid">
          <article><span><Users size={15}/> Unique visitors</span><strong>{dailyReport.visitors}</strong></article>
          <article><span><Eye size={15}/> Page views</span><strong>{dailyReport.pageViews}</strong></article>
          <article><span><MessageCircle size={15}/> WhatsApp clicks</span><strong>{dailyReport.whatsappClicks}</strong><small>Clicks, not confirmed enquiries</small></article>
          <article><span>Actual enquiries</span><strong>{dailyReport.enquiries}</strong><small>Saved in CRM today</small></article>
          <article><span><Facebook size={15}/> Facebook posts today</span><strong>{dailyReport.facebookToday}</strong></article>
          <article><span><Instagram size={15}/> Instagram posts today</span><strong>{dailyReport.instagramToday}</strong></article>
          <article><span>Website sessions</span><strong>{dailyReport.sessions}</strong></article>
        </div>
        <p className="mrsa-daily-report-note">WhatsApp clicks measure link clicks only. They do not confirm that a conversation or property enquiry was completed. Figures refresh with the “Refresh data” button.</p>
      </div>
      <div className="mrsa-overview-table-head"><div><h3>Property-wise breakdown</h3><p className="muted">Published post count by platform</p></div><span>{propertyRows.length} properties tracked</span></div>
      <div className="mrsa-overview-table-wrap">
        <table className="mrsa-overview-table">
          <thead><tr>
            <th>Property</th><th><span><Facebook size={15} color="#1877f2"/> Facebook</span></th><th><span><Instagram size={15} color="#b43d83"/> Instagram</span></th><th>Total posts</th><th>Platform mix</th>
          </tr></thead>
          <tbody>
            {propertyRows.length?propertyRows.map(row=>{
              const facebookCount=row.facebook.filter(post=>post.status==='published'||post.permalink).length;
              const instagramCount=row.instagram.filter(post=>post.status==='published'||post.permalink).length;
              const total=facebookCount+instagramCount;
              const latest=[...row.facebook.map(post=>({...post,platform:'Facebook'})),...row.instagram.map(post=>({...post,platform:'Instagram'}))].filter(post=>post.status==='published'||post.permalink).sort((a,b)=>new Date(b.published_at||0)-new Date(a.published_at||0))[0];
              return <tr key={row.id}>
                <td><b>{row.title}</b><small>{row.city||'Tamil Nadu'}</small></td>
                <td><span className="mrsa-count mrsa-count-facebook">{facebookCount}</span></td>
                <td><span className="mrsa-count mrsa-count-instagram">{instagramCount}</span></td>
                <td><b className="mrsa-total-count">{total}</b></td>
                <td><div className="mrsa-mix-track"><i className="mrsa-mix-facebook" style={{width:total?facebookCount/total*100+'%':'0%'}}/><i className="mrsa-mix-instagram" style={{width:total?instagramCount/total*100+'%':'0%'}}/></div><small className="mrsa-last-post">{latest?'Last posted: '+new Date(latest.published_at||latest.created_at).toLocaleDateString('en-IN'):'Not published yet'}</small></td>
              </tr>
            }):<tr><td colSpan={5} className="mrsa-overview-empty">{loading?'Loading property publishing data…':'No published property posts found yet. Once approved posts are published, they will appear here.'}</td></tr>}
          </tbody>
          {propertyRows.length>0&&<tfoot><tr>
            <td><b>Grand total</b></td><td><b>{overviewMetrics.facebook}</b></td><td><b>{overviewMetrics.instagram}</b></td><td><b>{overviewMetrics.total}</b></td><td><span className="mrsa-total-caption">All published posts</span></td>
          </tr></tfoot>}
        </table>
      </div>
      <div className="mrsa-overview-legend"><span><i className="mrsa-legend-facebook"/> Facebook</span><span><i className="mrsa-legend-instagram"/> Instagram</span><small>Only successfully published posts are counted. Drafts, pending approvals and failed posts are excluded.</small></div>
      <style>{`
        .mrsa-daily-report{margin:26px 0 28px;padding:18px;border:1px solid #e5ece8;border-radius:14px;background:#f8fbf9}
        .mrsa-daily-report-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:15px}
        .mrsa-daily-report-heading .eyebrow{display:flex;align-items:center;gap:6px}
        .mrsa-daily-report-heading h3{margin:7px 0 4px;color:#20364b;font-size:18px}
        .mrsa-daily-report-heading p{margin:0;font-size:11px}
        .mrsa-daily-report-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}
        .mrsa-daily-report-grid article{display:grid;gap:8px;min-width:0;padding:13px;border:1px solid #e7eeea;border-radius:10px;background:#fff}
        .mrsa-daily-report-grid article>span{display:flex;align-items:center;gap:6px;color:#687a71;font-size:11px;font-weight:650}
        .mrsa-daily-report-grid article>strong{color:#20364b;font-size:25px;line-height:1.1;font-variant-numeric:tabular-nums}
        .mrsa-daily-report-grid article>small{color:#89958f;font-size:9px}
        .mrsa-daily-report-note{margin:12px 0 0;color:#7a8981;font-size:10px;line-height:1.6}
        @media(max-width:760px){.mrsa-daily-report-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.mrsa-daily-report{padding:13px}}
        .mrsa-overview-dashboard{padding:clamp(16px,2.5vw,26px);border:1px solid #e5ece8;border-radius:18px;background:linear-gradient(145deg,#fff 0%,#fbfdfc 100%);box-shadow:0 12px 34px #20364b0a}
        .mrsa-overview-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .mrsa-overview-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:22px 0 28px}
        .mrsa-overview-kpi{display:flex;flex-direction:column;gap:9px;min-width:0;padding:17px;border:1px solid #e8eeeb;border-radius:13px;background:#fff}
        .mrsa-overview-kpi>strong,.mrsa-overview-kpi>div>strong{font-size:30px;line-height:1.1;letter-spacing:-1px;color:#20364b}
        .mrsa-overview-kpi>div{display:flex;align-items:center;justify-content:space-between}
        .mrsa-kpi-total{background:#203d34;border-color:#203d34;color:#fff}
        .mrsa-kpi-total>div>strong,.mrsa-kpi-total .mrsa-kpi-label,.mrsa-kpi-total small{color:#fff}
        .mrsa-kpi-symbol{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#ffffff20;color:#d8f0e3}
        .mrsa-kpi-label{display:flex;align-items:center;gap:7px;color:#65766f;font-size:12px;font-weight:700}
        .mrsa-overview-kpi small{color:#829089;font-size:11px}
        .mrsa-kpi-track,.mrsa-mix-track{display:flex;overflow:hidden;height:6px;border-radius:20px;background:#edf1ef}
        .mrsa-kpi-track i{display:block;border-radius:20px;background:#2782df}
        .mrsa-kpi-instagram i{background:#bd4b8a}
        .mrsa-overview-table-head{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:12px}
        .mrsa-status-heading{margin-top:28px}
        .mrsa-status-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 0 28px}
        .mrsa-status-card{display:grid;gap:8px;padding:15px;border:1px solid #e8eeeb;border-radius:12px;background:#fff}
        .mrsa-status-card>span{display:flex;align-items:center;gap:7px;color:#607168;font-size:12px;font-weight:700}
        .mrsa-status-card>strong{color:#20364b;font-size:26px;line-height:1.1}
        .mrsa-status-card>small{color:#89958f;font-size:10px}
        .mrsa-status-dot{width:8px;height:8px;border-radius:50%;background:#2782df}
        .mrsa-status-dot.failed{background:#d97757}.mrsa-status-dot.rejected{background:#9b879f}
        .mrsa-overview-table-head h3{margin:0 0 4px;color:#20364b;font-size:17px}
        .mrsa-overview-table-head p{margin:0;font-size:12px}
        .mrsa-overview-table-head>span{color:#718078;font-size:11px;font-weight:600}
        .mrsa-overview-table-wrap{overflow-x:auto;border:1px solid #e7eeea;border-radius:12px;background:#fff}
        .mrsa-overview-table{width:100%;min-width:680px;border-collapse:separate;border-spacing:0;text-align:left}
        .mrsa-overview-table th{padding:13px 15px;background:#f5f8f6;color:#6c7b74;font-size:11px;font-weight:700;white-space:nowrap}
        .mrsa-overview-table th span{display:inline-flex;align-items:center;gap:6px}
        .mrsa-overview-table td{padding:14px 15px;border-top:1px solid #edf1ef;color:#34483f;font-size:13px}
        .mrsa-overview-table tbody tr:hover{background:#fbfdfc}
        .mrsa-overview-table td:first-child b{display:block;color:#20364b;font-size:13px}
        .mrsa-overview-table td small{display:block;margin-top:4px;color:#89958f;font-size:10px}
        .mrsa-count{display:inline-grid;place-items:center;min-width:31px;height:29px;padding:0 8px;border-radius:8px;font-weight:700}
        .mrsa-count-facebook{background:#edf5ff;color:#1769ba}
        .mrsa-count-instagram{background:#fbf0f6;color:#a43b78}
        .mrsa-total-count{color:#203d34;font-size:15px}
        .mrsa-mix-track{width:105px;height:7px}
        .mrsa-mix-facebook{background:#2782df}
        .mrsa-mix-instagram{background:#bd4b8a}
        .mrsa-last-post{white-space:nowrap}
        .mrsa-overview-table tfoot td{background:#f5f8f6;border-top:2px solid #dce7e1;font-weight:700}
        .mrsa-total-caption{color:#6f8077;font-size:11px;font-weight:500}
        .mrsa-overview-empty{text-align:center!important;padding:30px!important;color:#77867f!important}
        .mrsa-overview-legend{display:flex;align-items:center;gap:15px;flex-wrap:wrap;margin-top:14px}
        .mrsa-overview-legend>span{display:inline-flex;align-items:center;gap:6px;color:#66766e;font-size:11px}
        .mrsa-overview-legend i{width:8px;height:8px;border-radius:50%}
        .mrsa-legend-facebook{background:#2782df}.mrsa-legend-instagram{background:#bd4b8a}
        .mrsa-overview-legend small{margin-left:auto;color:#89958f;font-size:10px}
        @media(max-width:900px){.mrsa-overview-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.mrsa-status-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:560px){.mrsa-status-grid{grid-template-columns:1fr 1fr;gap:8px}.mrsa-status-card{padding:12px}.mrsa-status-card>strong{font-size:23px}.mrsa-overview-kpis{gap:8px;margin:17px 0 22px}.mrsa-overview-kpi{padding:13px}.mrsa-overview-kpi>strong,.mrsa-overview-kpi>div>strong{font-size:25px}.mrsa-overview-table-head{align-items:flex-start;flex-direction:column}.mrsa-overview-legend small{margin-left:0;width:100%}}
      `}</style>
    </section>}
    {!overviewOnly&&<>
    <section className="instagram-publishing-panel" style={{marginTop:24}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
        <div><h2 style={{margin:'0 0 6px'}}>Property publishing manager</h2><p className="muted" style={{margin:0}}>One summary row per property. Expand Publishing History to review individual posts without cluttering the overview.</p></div>
        <span className="instagram-post-meta">{visibleRows.length} properties</span>
      </div>
      <p className="instagram-post-meta" style={{marginTop:12}}>Published counts include successful posts only. Failed records remain in history and are not offered for retry here. “Verify in Meta” records stay locked until checked.</p>
      {visibleRows.length?<div style={{overflowX:'auto',marginTop:16}}>
        <table style={{width:'100%',minWidth:900,borderCollapse:'collapse',textAlign:'left'}}>
          <thead><tr>
            <th style={{padding:'11px 9px'}}>Property</th>
            <th style={{padding:'11px 9px',textAlign:'center'}}>Facebook</th>
            <th style={{padding:'11px 9px',textAlign:'center'}}>Instagram</th>
            <th style={{padding:'11px 9px',textAlign:'center'}}>Pending</th>
            <th style={{padding:'11px 9px',textAlign:'center'}}>Verify</th>
            <th style={{padding:'11px 9px'}}>Latest published</th>
            <th style={{padding:'11px 9px'}}>Publishing History</th>
          </tr></thead>
          <tbody>{visibleRows.map(row=>{
            const published=platform=>row[platform].filter(post=>post.status==='published'||Boolean(post.permalink));
            const pending=row.posts.filter(post=>['draft','approved','publishing'].includes(post.status));
            const review=row.posts.filter(post=>post.status==='review_required');
            const fbPublished=published('facebook');
            const igPublished=published('instagram');
            const latestPublished=[...row.posts].filter(post=>post.status==='published'||post.permalink).sort((a,b)=>new Date(b.published_at||b.created_at||0)-new Date(a.published_at||a.created_at||0))[0];
            const historyPosts=[...row.posts].sort((a,b)=>new Date(b.published_at||b.created_at||b.last_attempt_at||0)-new Date(a.published_at||a.created_at||a.last_attempt_at||0));
            return <tr key={row.id} style={{borderTop:'1px solid var(--border-color, #e5e7eb)'}}>
              <td style={{padding:'13px 9px'}}><b>{row.title}</b>{row.city&&<div className="instagram-post-meta">{row.city}</div>}</td>
              <td style={{padding:'13px 9px',textAlign:'center'}}><b>{fbPublished.length}</b><div className="instagram-post-meta">published</div></td>
              <td style={{padding:'13px 9px',textAlign:'center'}}><b>{igPublished.length}</b><div className="instagram-post-meta">published</div></td>
              <td style={{padding:'13px 9px',textAlign:'center'}}><b>{pending.length}</b></td>
              <td style={{padding:'13px 9px',textAlign:'center'}}>{review.length?<b style={{color:'#b7791f'}}>{review.length} · Locked</b>:'—'}</td>
              <td style={{padding:'13px 9px'}}>{latestPublished?.permalink?<a className="text-link" href={latestPublished.permalink} target="_blank" rel="noreferrer">View {latestPublished.platform==='instagram'?'Instagram':'Facebook'} <ExternalLink size={13}/><span className="instagram-post-meta">{latestPublished.published_at?new Date(latestPublished.published_at).toLocaleDateString('en-IN'):''}</span></a>:'—'}</td>
              <td style={{padding:'13px 9px'}}>
                <details>
                  <summary style={{cursor:'pointer',fontWeight:600,color:'var(--link-color, #276749)'}}>View {historyPosts.length} records</summary>
                  <div style={{minWidth:260,display:'grid',gap:9,padding:'12px 2px'}}>
                    {historyPosts.map(post=><div key={post.platform+post.id} style={{padding:'9px 10px',border:'1px solid var(--border-color, #e5e7eb)',borderRadius:9}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
                        <b style={{fontSize:12}}>{post.platform==='facebook'?'Facebook':'Instagram'} · {post.status==='review_required'?'Verify in Meta':post.status}</b>
                        {post.status==='review_required'&&<span className="instagram-post-meta">Locked</span>}
                      </div>
                      <div className="instagram-post-meta" style={{display:'grid',gap:3,marginTop:6}}>
                        {post.created_at&&<span>Added to queue: {new Date(post.created_at).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true})} IST</span>}
                        {post.approved_at&&<span>Approved at: {new Date(post.approved_at).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true})} IST</span>}
                        {post.published_at&&<span>Published at: {new Date(post.published_at).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true})} IST</span>}
                      </div>
                      {post.permalink&&<a className="text-link" href={post.permalink} target="_blank" rel="noreferrer">View published post <ExternalLink size={12}/></a>}
                      {post.last_error&&<div className="instagram-post-meta" style={{marginTop:5,color:'#9a5b45'}}>{post.last_error}</div>}
                      {post.status==='rejected'&&post.last_error&&<div className="instagram-post-meta" style={{marginTop:7,color:'#9a5b45'}}><b>Rejection reason:</b> {post.last_error}</div>}
                      {['draft','approved','failed'].includes(post.status)&&<div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>
                        <button className="btn btn-primary" style={{padding:'8px 13px',fontSize:12}} disabled={workingPost===post.platform+':'+post.id||post.status==='approved'&&post.approved_at&&post.approved_by} onClick={()=>actOnPost(post.platform,post.id,'approve')}><Check size={14}/>{workingPost===post.platform+':'+post.id?'Please wait…':post.status==='approved'?'Approved':'Approve & queue'}</button>
                        <button className="btn btn-outline" style={{padding:'8px 13px',fontSize:12,color:'#a34e42',borderColor:'#e6c8c3'}} disabled={workingPost===post.platform+':'+post.id} onClick={()=>{setRejectingPost({platform:post.platform,id:post.id,title:row.title});setRejectReason('')}}><X size={14}/>Reject</button>
                      </div>}
                    </div>)}
                  </div>
                </details>
              </td>
            </tr>
          })}</tbody>
        </table>
      </div>:<div className="instagram-empty" style={{marginTop:14}}>No property posts or queue items found.</div>}
    </section>
    <section className="instagram-publishing-panel" style={{marginTop:18}}>
      <h2 style={{margin:'0 0 6px'}}>History · Recently posted</h2>
      <p className="muted" style={{margin:0}}>Latest published property posts across both platforms.</p>
      {[...visibleRows].filter(row=>row.latest).sort((a,b)=>new Date(b.latest.published_at||0)-new Date(a.latest.published_at||0)).slice(0,8).length?<div style={{display:'grid',gap:10,marginTop:14}}>
        {[...visibleRows].filter(row=>row.latest).sort((a,b)=>new Date(b.latest.published_at||0)-new Date(a.latest.published_at||0)).slice(0,8).map(row=><div key={row.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:'11px 0',borderTop:'1px solid var(--border-color, #e5e7eb)'}}><div><b>{row.title}</b><div className="instagram-post-meta">{row.latest.platform==='facebook'?'Facebook':'Instagram'} · {row.latest.published_at?new Date(row.latest.published_at).toLocaleDateString('en-IN'):''}</div></div><a className="btn btn-outline" href={row.latest.permalink} target="_blank" rel="noreferrer">View more <ExternalLink size={13}/></a></div>)}
      </div>:<div className="instagram-empty" style={{marginTop:14}}>No recently published links found.</div>}
    </section>
    </>}
    {rejectingPost&&<div role="dialog" aria-modal="true" aria-labelledby="mrsa-reject-title" style={{position:'fixed',inset:0,zIndex:1000,background:'#10251dcc',display:'grid',placeItems:'center',padding:18}}>
      <form onSubmit={e=>{e.preventDefault();if(rejectReason.trim().length<3)return;actOnPost(rejectingPost.platform,rejectingPost.id,'reject',rejectReason.trim())}} style={{width:'min(100%,460px)',padding:22,borderRadius:16,background:'#fff',boxShadow:'0 20px 60px #0003'}}>
        <h3 id="mrsa-reject-title" style={{margin:'0 0 7px',color:'#20364b'}}>Reject social post</h3>
        <p className="instagram-post-meta" style={{margin:'0 0 14px'}}>{rejectingPost.platform==='facebook'?'Facebook':'Instagram'} · {rejectingPost.title}</p>
        <label htmlFor="mrsa-reject-reason" style={{display:'block',fontSize:13,fontWeight:650,marginBottom:7}}>Reason for rejection <span style={{color:'#b34d42'}}>*</span></label>
        <textarea id="mrsa-reject-reason" value={rejectReason} onChange={e=>setRejectReason(e.target.value)} required minLength={3} maxLength={500} rows={4} placeholder="Example: Incorrect price, outdated image, or missing property details" style={{width:'100%',boxSizing:'border-box',padding:11,border:'1px solid #dce5df',borderRadius:9,font:'inherit',resize:'vertical'}}/>
        <small style={{display:'block',color:'#829089',marginTop:5}}>This reason will be saved with the rejected post for future reference.</small>
        <div style={{display:'flex',justifyContent:'flex-end',gap:9,marginTop:17}}>
          <button type="button" className="btn btn-outline" onClick={()=>{setRejectingPost(null);setRejectReason('')}}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={rejectReason.trim().length<3||Boolean(workingPost)}>{workingPost?'Rejecting…':'Confirm rejection'}</button>
        </div>
      </form>
    </div>}
    {!platformFilter&&<><div className="instagram-publishing-actions" style={{justifyContent:'center',marginTop:18}}><Link className="btn btn-outline" to="/admin/facebook">Open Facebook queue</Link><Link className="btn btn-outline" to="/admin/instagram">Open Instagram queue</Link></div>
    <p className="muted" style={{textAlign:'center',marginTop:18}}>Last setting update: {settings?.updated_at?new Date(settings.updated_at).toLocaleString('en-IN'):'—'}</p></>}
  </section>
}
