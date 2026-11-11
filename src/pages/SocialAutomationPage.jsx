import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PauseCircle, PlayCircle, RefreshCw, ShieldCheck, Facebook, Instagram } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function SocialAutomationPage({user}){
  const [settings,setSettings]=useState(null)
  const [counts,setCounts]=useState({facebook:0,instagram:0,failed:0,published:0})
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
      const [fb,ig,failed,published]=await Promise.all([
        supabase.from('facebook_posts').select('id',{count:'exact',head:true}).eq('auto_generated',true).eq('status','approved'),
        supabase.from('instagram_posts').select('id',{count:'exact',head:true}).eq('auto_generated',true).eq('status','approved'),
        supabase.from('facebook_posts').select('id',{count:'exact',head:true}).eq('auto_generated',true).eq('status','failed'),
        supabase.from('facebook_posts').select('id',{count:'exact',head:true}).eq('auto_generated',true).eq('status','published')
      ])
      for(const result of [fb,ig,failed,published])if(result.error)throw result.error
      setCounts({facebook:fb.count||0,instagram:ig.count||0,failed:failed.count||0,published:published.count||0})
    }catch(err){setError(err.message||'Could not load automation settings. Run the Auto Marketing 2.0 Supabase migration first.')}
    finally{setLoading(false)}
  }
  useEffect(()=>{load()},[])
  const toggle=async()=>{
    if(!settings)return
    const enabled=!settings.enabled
    setSaving(true);setError('');setNotice('')
    try{
      const {data,error}=await supabase.from('social_automation_settings').update({enabled,updated_by:user?.id||null,updated_at:new Date().toISOString()}).eq('id',1).select('enabled,updated_at').single()
      if(error)throw error
      setSettings(data)
      setNotice(enabled?'Automatic publishing enabled. Newly approved properties will be queued for Facebook and Instagram.':'Automatic publishing paused. No queued posts will be sent until you resume.')
    }catch(err){setError(err.message||'Could not update the automation setting.')}
    finally{setSaving(false)}
  }
  return <section className="section page-section instagram-publishing-page">
    <div className="instagram-publishing-heading">
      <div><span className="eyebrow">MRSA PROPERTIES · ADMIN</span><h1>Auto Marketing 2.0</h1><p className="muted">Automatically publish approved property listings to Facebook and Instagram. Admin approval remains mandatory.</p></div>
      <div className="instagram-publishing-actions"><button className="btn btn-outline" onClick={load} disabled={loading}><RefreshCw size={15}/> Refresh</button><Link className="btn btn-outline" to="/admin">← Admin dashboard</Link></div>
    </div>
    {notice&&<div className="instagram-publishing-notice" role="status">{notice}</div>}
    {error&&<div className="instagram-publishing-error" role="alert">{error}</div>}
    <article className="instagram-publishing-panel" style={{maxWidth:760,margin:'0 auto'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
        <div><span className="eyebrow">MASTER CONTROL</span><h2 style={{margin:'8px 0'}}>Automatic publishing</h2><p className="muted">{settings?.enabled?'Newly approved properties are queued automatically.':'Publishing is paused. New approvals will not be queued.'}</p></div>
        <span className={'instagram-status instagram-status-'+(settings?.enabled?'published':'draft')}>{loading?'Loading':settings?.enabled?'Active':'Paused'}</span>
      </div>
      <button className={'btn '+(settings?.enabled?'btn-outline':'btn-primary')} style={{marginTop:18}} disabled={loading||saving||!settings} onClick={toggle}>
        {settings?.enabled?<><PauseCircle size={17}/>{saving?'Pausing…':'Pause automation'}</>:<><PlayCircle size={17}/>{saving?'Resuming…':'Resume automation'}</>}
      </button>
      <div className="instagram-setup-note" style={{marginTop:20}}><b><ShieldCheck size={14} style={{verticalAlign:'-3px'}}/> Publishing rules</b><br/>Only listings approved by an administrator are queued. Facebook and Instagram are processed by the Cloudflare Worker every five minutes. Each platform has a separate duplicate guard and status history. Temporary failures retry automatically; permanent errors are shown in the publishing queues. Pausing stops the scheduler from sending queued posts.</div>
    </article>
    <div className="admin-stats" style={{marginTop:24}}>
      <div><b>{counts.facebook}</b><span><Facebook size={14}/> Facebook queued</span></div>
      <div><b>{counts.instagram}</b><span><Instagram size={14}/> Instagram queued</span></div>
      <div><b>{counts.published}</b><span>Auto-published (Facebook)</span></div>
      <div><b>{counts.failed}</b><span>Failed (Facebook)</span></div>
    </div>
    <div className="instagram-publishing-actions" style={{justifyContent:'center',marginTop:18}}><Link className="btn btn-outline" to="/admin/facebook">Open Facebook queue</Link><Link className="btn btn-outline" to="/admin/instagram">Open Instagram queue</Link></div>
    <p className="muted" style={{textAlign:'center',marginTop:18}}>Last setting update: {settings?.updated_at?new Date(settings.updated_at).toLocaleString('en-IN'):'—'}</p>
  </section>
}
