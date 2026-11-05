const KEY='mrsa-saved-properties-v1'
export function getFavorites(){try{const value=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(value)?value.filter(x=>typeof x==='string'):[]}catch{return []}}
export function toggleFavorite(id){const current=getFavorites();const next=current.includes(id)?current.filter(x=>x!==id):[...current,id];try{localStorage.setItem(KEY,JSON.stringify(next))}catch{}return next.includes(id)}
