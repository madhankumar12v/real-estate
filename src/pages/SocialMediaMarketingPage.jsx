import { useState } from 'react'
import { Facebook, Instagram, LayoutDashboard, Settings2, History } from 'lucide-react'
import FacebookPublishingPage from './FacebookPublishingPage'
import InstagramPublishingPage from './InstagramPublishingPage'
import SocialAutomationPage from './SocialAutomationPage'

const tabs = [
  { id: 'overview', label: 'Overview & Automation', icon: LayoutDashboard },
  { id: 'facebook', label: 'Facebook', icon: Facebook },
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'history', label: 'Publishing History', icon: History }
]

export default function SocialMediaMarketingPage({ user }) {
  const [activeTab, setActiveTab] = useState('overview')
  return <section className="section page-section social-marketing-page">
    <header className="social-marketing-header">
      <div>
        <span className="eyebrow">MRSA PROPERTIES · ADMIN WORKSPACE</span>
        <h1>Social Media Marketing</h1>
        <p className="muted">Manage automatic and manual publishing for Facebook and Instagram in one place.</p>
      </div>
    </header>
    <nav className="social-marketing-tabs" aria-label="Social media marketing sections">
      {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={activeTab === id ? 'social-marketing-tab active' : 'social-marketing-tab'} aria-current={activeTab === id ? 'page' : undefined} onClick={() => setActiveTab(id)}>
        <Icon size={16} />{label}
      </button>)}
    </nav>
    <div className="social-marketing-content">
      {activeTab === 'overview' && <SocialAutomationPage user={user} />}
      {activeTab === 'facebook' && <FacebookPublishingPage />}
      {activeTab === 'instagram' && <InstagramPublishingPage />}
      {activeTab === 'history' && <div className="social-marketing-history">
        <h2>Publishing history</h2>
        <p className="muted">Review each platform's publishing status, post links and error details below.</p>
        <h3><Facebook size={17}/> Facebook publishing history</h3>
        <FacebookPublishingPage />
        <h3><Instagram size={17}/> Instagram publishing history</h3>
        <InstagramPublishingPage />
      </div>}
    </div>
    <style>{`
      .social-marketing-header{margin-bottom:20px}
      .social-marketing-header h1{margin:7px 0}
      .social-marketing-tabs{display:flex;gap:8px;flex-wrap:wrap;padding:7px;margin-bottom:22px;border:1px solid #e6ebe8;border-radius:12px;background:#fff}
      .social-marketing-tab{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 14px;border:0;border-radius:8px;background:transparent;color:#536474;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
      .social-marketing-tab.active{background:#eaf3ee;color:#23694f}
      .social-marketing-content>.instagram-publishing-page{max-width:none;padding:0;margin:0}
      .social-marketing-content .instagram-publishing-heading{display:none}
      .social-marketing-content .instagram-publishing-page>.admin-stats{margin-top:18px}
      .social-marketing-history h2{margin:0 0 6px;color:#20364b}
      .social-marketing-history h3{display:flex;align-items:center;gap:8px;margin:25px 0 12px;color:#20364b;font-size:16px}
      .social-marketing-history>.instagram-publishing-page{margin-bottom:28px}\n      .social-marketing-history .instagram-publishing-grid{grid-template-columns:minmax(0,1fr)}\n      .social-marketing-history .instagram-publishing-grid>article:first-child{display:none}\n      .social-marketing-history .instagram-publishing-grid>article:last-child{min-width:0}\n      .social-marketing-history .instagram-setup-note{display:none}
      @media(max-width:620px){.social-marketing-tabs{display:grid;grid-template-columns:1fr 1fr}.social-marketing-tab{padding:10px 7px;font-size:12px}}
    `}</style>
  </section>
}
