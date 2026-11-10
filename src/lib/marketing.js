export function getMarketingAttribution() {
  const empty = { marketing_source: null, utm_source: null, utm_medium: null, utm_campaign: null, landing_page: null, referrer_host: null }
  try {
    let saved = null
    const params = new URLSearchParams(window.location.search)
    if (params.get('utm_source')) {
      saved = {
        utm_source: params.get('utm_source'),
        utm_medium: params.get('utm_medium'),
        utm_campaign: params.get('utm_campaign')
      }
    } else {
      const raw = window.sessionStorage.getItem('mrsa_traffic_attribution')
      if (raw) saved = JSON.parse(raw)
    }
    if (!saved) return { ...empty, landing_page: window.location.pathname.slice(0, 300) }
    return {
      marketing_source: String(saved.source || saved.utm_source || 'Other').slice(0, 80),
      utm_source: saved.utm_source ? String(saved.utm_source).slice(0, 120) : null,
      utm_medium: saved.utm_medium ? String(saved.utm_medium).slice(0, 120) : null,
      utm_campaign: saved.utm_campaign ? String(saved.utm_campaign).slice(0, 160) : null,
      landing_page: window.location.pathname.slice(0, 300),
      referrer_host: document.referrer ? new URL(document.referrer).hostname.replace(/^www\\./, '').slice(0, 180) : null
    }
  } catch {
    return { ...empty, landing_page: window.location.pathname.slice(0, 300) }
  }
}
