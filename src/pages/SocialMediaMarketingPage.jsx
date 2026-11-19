import { Facebook, Instagram, LayoutDashboard, History, ShieldCheck, Settings2, Wrench, ChevronDown, Clock3 } from 'lucide-react'
import SocialAutomationPage from './SocialAutomationPage'

export default function SocialMediaMarketingPage({ user }) {
  return <section className="section page-section social-marketing-page">
    <header className="social-marketing-header">
      <div>
        <span className="eyebrow">MRSA PROPERTIES · ADMIN WORKSPACE</span>
        <h1>Social Media Manager</h1>
        <p className="muted">Manage Facebook and Instagram from one place. Expand only the section you need; your website’s listing approval process remains unchanged.</p>
      </div>
      <div className="social-marketing-header-note"><ShieldCheck size={17}/><span>Website admin approval required before a property can be promoted</span></div>
    </header>

    <div className="social-marketing-accordion">
      <details className="social-marketing-accordion-item" open>
        <summary>
          <span className="social-marketing-accordion-icon"><LayoutDashboard size={18}/></span>
          <span className="social-marketing-accordion-copy"><b>Overview</b><small>Publishing totals, queue status and today’s activity.</small></span>
          <ChevronDown className="social-marketing-chevron" size={19}/>
        </summary>
        <div className="social-marketing-accordion-body"><SocialAutomationPage user={user} overviewOnly /></div>
      </details>

      <details className="social-marketing-accordion-item">
        <summary>
          <span className="social-marketing-accordion-icon"><Settings2 size={18}/></span>
          <span className="social-marketing-accordion-copy"><b>Automation Settings</b><small>Master switch, publishing schedule and 7-day property cycle.</small></span>
          <ChevronDown className="social-marketing-chevron" size={19}/>
        </summary>
        <div className="social-marketing-accordion-body"><SocialAutomationPage user={user} settingsOnly /></div>
      </details>

      <details className="social-marketing-accordion-item">
        <summary>
          <span className="social-marketing-accordion-icon facebook"><Facebook size={18}/></span>
          <span className="social-marketing-accordion-copy"><b>Facebook Manager</b><small>Facebook property queue, publishing status and post history.</small></span>
          <ChevronDown className="social-marketing-chevron" size={19}/>
        </summary>
        <div className="social-marketing-accordion-body"><SocialAutomationPage user={user} platformFilter="facebook" /></div>
      </details>

      <details className="social-marketing-accordion-item">
        <summary>
          <span className="social-marketing-accordion-icon instagram"><Instagram size={18}/></span>
          <span className="social-marketing-accordion-copy"><b>Instagram Manager</b><small>Instagram property queue, publishing status and post history.</small></span>
          <ChevronDown className="social-marketing-chevron" size={19}/>
        </summary>
        <div className="social-marketing-accordion-body"><SocialAutomationPage user={user} platformFilter="instagram" /></div>
      </details>

      <details className="social-marketing-accordion-item">
        <summary>
          <span className="social-marketing-accordion-icon"><History size={18}/></span>
          <span className="social-marketing-accordion-copy"><b>Publishing History</b><small>Recently published posts and property-wise publishing records.</small></span>
          <ChevronDown className="social-marketing-chevron" size={19}/>
        </summary>
        <div className="social-marketing-accordion-body"><SocialAutomationPage user={user} historyOnly /></div>
      </details>

      <details className="social-marketing-accordion-item">
        <summary>
          <span className="social-marketing-accordion-icon"><Wrench size={18}/></span>
          <span className="social-marketing-accordion-copy"><b>Troubleshooting</b><small>Connection checks, common errors and safe recovery steps.</small></span>
          <ChevronDown className="social-marketing-chevron" size={19}/>
        </summary>
        <div className="social-marketing-accordion-body">
          <div className="social-troubleshooting-grid">
            <article><b><ShieldCheck size={16}/> Check Cloudflare secrets</b><p>Open Cloudflare Dashboard → Workers &amp; Pages → mrsa → Settings → Variables and Secrets. Confirm the Supabase service-role key, Facebook Page access token and Instagram access token are configured as secrets. Never paste secret values into chat or website code.</p></article>
            <article><b><Clock3 size={16}/> Posts are waiting in the queue</b><p>Automatic publishing runs in scheduled slots from 10:00 AM to 10:00 PM IST. Check that automation is active and that the listing is still approved on the website.</p></article>
            <article><b><Facebook size={16}/> Facebook or Instagram failed</b><p>Open the relevant platform section and inspect the post error. Resolve token, permission or image issues before retrying. Do not repeatedly retry a post marked “Verify in Meta”; first check whether Meta already published it.</p></article>
            <article><b><History size={16}/> Avoid duplicate posts</b><p>Use Publishing History to check the latest status and permalink. If a result is uncertain, verify it in the Meta account before attempting another publish.</p></article>
          </div>
        </div>
      </details>
    </div>

    <style>{`
      .social-marketing-header{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:22px}
      .social-marketing-header h1{margin:7px 0;font-size:clamp(30px,4vw,42px);color:#20364b}
      .social-marketing-header>div:first-child{max-width:760px}
      .social-marketing-header-note{display:flex;align-items:center;gap:8px;padding:11px 14px;border:1px solid #dcebe4;border-radius:10px;background:#f5faf7;color:#286b53;font-size:12px;font-weight:600;max-width:300px}
      .social-marketing-accordion{display:grid;gap:12px}
      .social-marketing-accordion-item{overflow:hidden;border:1px solid #e2ebe6;border-radius:15px;background:#fff;box-shadow:0 5px 18px #20364b08}
      .social-marketing-accordion-item>summary{display:flex;align-items:center;gap:14px;min-height:76px;padding:14px 18px;cursor:pointer;list-style:none}
      .social-marketing-accordion-item>summary::-webkit-details-marker{display:none}
      .social-marketing-accordion-item>summary:hover{background:#fbfdfc}
      .social-marketing-accordion-icon{display:grid;place-items:center;flex:0 0 42px;width:42px;height:42px;border-radius:12px;background:#edf4f0;color:#246a51}
      .social-marketing-accordion-icon.facebook{background:#edf4ff;color:#1877f2}
      .social-marketing-accordion-icon.instagram{background:#f8eef5;color:#a13d78}
      .social-marketing-accordion-copy{display:grid;gap:4px;flex:1;min-width:0}
      .social-marketing-accordion-copy b{color:#20364b;font-size:15px}
      .social-marketing-accordion-copy small{color:#718096;font-size:12px;line-height:1.45}
      .social-marketing-chevron{flex:0 0 auto;color:#75867e;transition:transform .2s}
      .social-marketing-accordion-item[open]>summary{border-bottom:1px solid #edf1ef;background:#fbfdfc}
      .social-marketing-accordion-item[open] .social-marketing-chevron{transform:rotate(180deg)}
      .social-marketing-accordion-body{padding:18px}
      .social-marketing-accordion-body>.instagram-publishing-page{max-width:none;padding:0;margin:0}
      .social-marketing-accordion-body .instagram-publishing-heading{display:none}
      .social-marketing-accordion-body>.instagram-publishing-page>.admin-stats{margin-top:18px}
      .social-troubleshooting-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .social-troubleshooting-grid article{padding:16px;border:1px solid #e8eeeb;border-radius:12px;background:#fbfdfc}
      .social-troubleshooting-grid article>b{display:flex;align-items:center;gap:8px;color:#20364b;font-size:13px}
      .social-troubleshooting-grid p{margin:9px 0 0;color:#687a71;font-size:12px;line-height:1.7}
      @media(max-width:760px){.social-marketing-header{align-items:flex-start;flex-direction:column}.social-marketing-header-note{max-width:none}.social-troubleshooting-grid{grid-template-columns:1fr}.social-marketing-accordion-body{padding:13px}}
      @media(max-width:560px){.social-marketing-accordion-item>summary{gap:10px;padding:12px}.social-marketing-accordion-icon{flex-basis:38px;width:38px;height:38px}.social-marketing-accordion-copy b{font-size:14px}.social-marketing-accordion-copy small{font-size:11px}}
    `}</style>
  </section>
}
