import { useState } from 'react'
import { Facebook, Instagram, LayoutDashboard, History, ShieldCheck } from 'lucide-react'
import FacebookPublishingPage from './FacebookPublishingPage'
import InstagramPublishingPage from './InstagramPublishingPage'
import SocialAutomationPage from './SocialAutomationPage'

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'facebook', label: 'Facebook', icon: Facebook },
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'history', label: 'Publishing History', icon: History }
]

export default function SocialMediaMarketingPage({ user }) {
  const [activeTab, setActiveTab] = useState('overview')
  const openPlatform = platform => setActiveTab(platform)

  return <section className="section page-section social-marketing-page">
    <header className="social-marketing-header">
      <div>
        <span className="eyebrow">MRSA PROPERTIES · ADMIN WORKSPACE</span>
        <h1>Social Media Manager</h1>
        <p className="muted">One workspace for Facebook and Instagram. Prepare posts, review approvals and track publishing without switching between separate tools.</p>
      </div>
      <div className="social-marketing-header-note"><ShieldCheck size={17}/><span>Admin approval required before every post</span></div>
    </header>

    <nav className="social-marketing-tabs" aria-label="Social media marketing sections">
      {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={activeTab === id ? 'social-marketing-tab active' : 'social-marketing-tab'} aria-current={activeTab === id ? 'page' : undefined} onClick={() => setActiveTab(id)}>
        <Icon size={16} />{label}
      </button>)}
    </nav>

    <div className="social-marketing-content">
      {activeTab === 'overview' && <SocialAutomationPage user={user}/>}

      {activeTab === 'facebook' && <SocialAutomationPage user={user} platformFilter="facebook" />}
      {activeTab === 'instagram' && <SocialAutomationPage user={user} platformFilter="instagram" />}
      {activeTab === 'history' && <div className="social-marketing-history">
        <h2>Publishing history</h2>
        <p className="muted">Review published links, post status and any errors for both channels.</p>
        <h3><Facebook size={17}/> Facebook</h3>
        <FacebookPublishingPage />
        <h3><Instagram size={17}/> Instagram</h3>
        <InstagramPublishingPage />
      </div>}
    </div>

    <style>{`
      .social-marketing-header{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:24px}
      .social-marketing-header h1{margin:7px 0;font-size:clamp(30px,4vw,42px);color:#20364b}
      .social-marketing-header>div:first-child{max-width:760px}
      .social-marketing-header-note{display:flex;align-items:center;gap:8px;padding:11px 14px;border:1px solid #dcebe4;border-radius:10px;background:#f5faf7;color:#286b53;font-size:12px;font-weight:600;white-space:nowrap}
      .social-marketing-tabs{display:flex;gap:7px;flex-wrap:wrap;padding:7px;margin-bottom:24px;border:1px solid #e5ece9;border-radius:13px;background:#fff;box-shadow:0 4px 18px #20364b08}
      .social-marketing-tab{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 16px;border:0;border-radius:9px;background:transparent;color:#536474;font:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:background .18s,color .18s}
      .social-marketing-tab.active{background:#eaf3ee;color:#23694f}
      .social-marketing-content>.instagram-publishing-page{max-width:none;padding:0;margin:0}
      .social-marketing-content .instagram-publishing-heading{display:none}
      .social-marketing-content .instagram-publishing-page>.admin-stats{margin-top:18px}
      .social-platform-intro{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin:0 0 16px}
      .social-platform-intro h2{margin:6px 0;color:#20364b;font-size:25px}
      .social-platform-intro p{margin:0;max-width:650px}
      .social-rules-chip{display:flex;align-items:center;gap:7px;padding:9px 12px;border:1px solid #e5ece9;border-radius:30px;color:#526b61;background:#fff;font-size:11px;white-space:nowrap}
      .social-platform-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-bottom:26px}
      .social-platform-card{display:flex;align-items:center;gap:16px;min-width:0;padding:22px;text-align:left;border:1px solid #e4ebe8;border-radius:15px;background:#fff;color:#20364b;cursor:pointer;box-shadow:0 5px 20px #20364b08;transition:transform .18s,box-shadow .18s,border-color .18s}
      .social-platform-card:hover{transform:translateY(-2px);box-shadow:0 12px 28px #20364b12;border-color:#c8ddd3}
      .social-platform-icon{display:grid;place-items:center;flex:0 0 52px;width:52px;height:52px;border-radius:14px;background:#edf4f0;color:#246a51}
      .instagram-card .social-platform-icon{background:#f8eef5;color:#a13d78}
      .social-platform-copy{display:grid;gap:6px;min-width:0;flex:1}
      .social-platform-copy b{font-size:17px;color:#20364b}
      .social-platform-copy small{font-size:12px;line-height:1.5;color:#718096}
      .social-platform-copy em{display:inline-flex;align-items:center;gap:5px;margin-top:3px;color:#287b68;font-size:12px;font-style:normal;font-weight:700}
      .instagram-card .social-platform-copy em{color:#a13d78}
      .social-platform-arrow{color:#87968f}
      .social-overview-divider{display:flex;align-items:center;gap:14px;margin:28px 0 12px;color:#6b7c88;font-size:12px;font-weight:700}
      .social-overview-divider:after{content:'';height:1px;flex:1;background:#e7eeeb}
      .social-marketing-content .instagram-publishing-page{padding-top:0}
      .social-marketing-history h2{margin:0 0 6px;color:#20364b}
      .social-marketing-history h3{display:flex;align-items:center;gap:8px;margin:25px 0 12px;color:#20364b;font-size:16px}
      .social-marketing-history>.instagram-publishing-page{margin-bottom:28px}
      .social-marketing-history .instagram-publishing-grid{grid-template-columns:minmax(0,1fr)}
      .social-marketing-history .instagram-publishing-grid>article:first-child{display:none}
      .social-marketing-history .instagram-publishing-grid>article:last-child{min-width:0}
      .social-marketing-history .instagram-setup-note{display:none}
      @media(max-width:760px){.social-marketing-header,.social-platform-intro{align-items:flex-start;flex-direction:column}.social-marketing-header-note{white-space:normal}.social-platform-grid{grid-template-columns:1fr}.social-rules-chip{white-space:normal;flex-wrap:wrap}}
      @media(max-width:620px){.social-marketing-tabs{display:grid;grid-template-columns:1fr 1fr}.social-marketing-tab{padding:10px 7px;font-size:12px}.social-platform-card{padding:17px;gap:12px}.social-platform-icon{flex-basis:46px;width:46px;height:46px}.social-platform-copy b{font-size:15px}}
    `}</style>
  </section>
}
