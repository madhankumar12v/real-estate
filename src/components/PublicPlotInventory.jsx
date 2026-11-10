import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function PublicPlotInventory({listingId}) {
  const [counts,setCounts]=useState(null)
  useEffect(()=>{
    let active=true
    supabase.from('plot_availability')
      .select('total_count,available_count,reserved_count,sold_count')
      .eq('listing_id',listingId).maybeSingle()
      .then(({data,error})=>{
        if(!active)return
        if(error){console.warn('Plot availability unavailable:',error.message);return}
        setCounts(data||null)
      })
    return ()=>{active=false}
  },[listingId])
  if(!counts || counts.total_count===0)return null
  return <div className="plot-availability-compact" aria-label="Plot availability">
    <span className="plot-availability-total">Total <b>{counts.total_count}</b></span>
    <span className="plot-availability-available">Available <b>{counts.available_count}</b></span>
    <span className="plot-availability-reserved">Reserved <b>{counts.reserved_count}</b></span>
    <span className="plot-availability-sold">Sold <b>{counts.sold_count}</b></span>
  </div>
}
