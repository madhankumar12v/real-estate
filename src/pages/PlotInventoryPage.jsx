import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const empty = { available_count: 0, reserved_count: 0, sold_count: 0 }

function getPlotStatus(value, hasSavedCounts) {
  const total = value.available_count + value.reserved_count + value.sold_count
  if (!hasSavedCounts || total === 0) return 'not-updated'
  if (value.available_count > 0) return 'available'
  if (value.reserved_count > 0) return 'reserved'
  return 'sold'
}

const statusLabels = {
  available: 'AVAILABLE',
  reserved: 'RESERVATION IN PROGRESS',
  sold: 'SOLD OUT',
  'not-updated': 'AVAILABILITY NOT UPDATED'
}

export default function PlotInventoryPage() {
  const [listings, setListings] = useState([])
  const [counts, setCounts] = useState({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cityFilter, setCityFilter] = useState('all')
  const [availabilityFilter, setAvailabilityFilter] = useState('all')

  const load = async () => {
    setLoading(true)
    const [{ data: rows, error: listingError }, { data: values, error: valueError }] = await Promise.all([
      supabase.from('listings').select('id,title,city,status').eq('property_type', 'Plot').order('created_at', { ascending: false }),
      supabase.from('plot_availability').select('*')
    ])
    if (listingError || valueError) throw listingError || valueError
    setListings(rows || [])
    const mapped = {}
    ;(values || []).forEach(value => {
      mapped[value.listing_id] = {
        available_count: value.available_count,
        reserved_count: value.reserved_count,
        sold_count: value.sold_count,
        total_count: value.total_count
      }
    })
    setCounts(mapped)
    setLoading(false)
  }

  useEffect(() => {
    load().catch(error => {
      setMessage(error.message || 'Unable to load plot availability.')
      setLoading(false)
    })
  }, [])

  const cities = useMemo(() => (
    [...new Set(listings.map(item => item.city).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  ), [listings])

  const summary = useMemo(() => listings.reduce((result, listing) => {
    const value = { ...empty, ...counts[listing.id] }
    result.plots += 1
    result.total += value.available_count + value.reserved_count + value.sold_count
    result.available += value.available_count
    result.reserved += value.reserved_count
    result.sold += value.sold_count
    return result
  }, { plots: 0, total: 0, available: 0, reserved: 0, sold: 0 }), [listings, counts])

  const filteredListings = useMemo(() => {
    const query = search.trim().toLowerCase()
    return listings.filter(listing => {
      const matchesSearch = !query || [listing.title, listing.city, listing.id]
        .some(value => String(value || '').toLowerCase().includes(query))
      const matchesCity = cityFilter === 'all' || listing.city === cityFilter
      const value = { ...empty, ...counts[listing.id] }
      const hasSavedCounts = Boolean(counts[listing.id])
      const matchesAvailability = availabilityFilter === 'all' ||
        getPlotStatus(value, hasSavedCounts) === availabilityFilter
      return matchesSearch && matchesCity && matchesAvailability
    })
  }, [listings, counts, search, cityFilter, availabilityFilter])

  const change = (id, key, value) => {
    const number = Math.max(0, Math.floor(Number(value) || 0))
    setCounts(old => ({ ...old, [id]: { ...empty, ...old[id], [key]: number } }))
  }

  const save = async listing => {
    const value = { ...empty, ...counts[listing.id] }
    setBusy(true)
    setMessage('')
    const { error } = await supabase.from('plot_availability').upsert({
      listing_id: listing.id,
      available_count: value.available_count,
      reserved_count: value.reserved_count,
      sold_count: value.sold_count,
      updated_at: new Date().toISOString()
    }, { onConflict: 'listing_id' })
    if (error) setMessage('Could not save ' + listing.title + ': ' + error.message)
    else setMessage('Availability saved for ' + listing.title + '.')
    setBusy(false)
    if (!error) await load()
  }

  const resetFilters = () => {
    setSearch('')
    setCityFilter('all')
    setAvailabilityFilter('all')
  }

  return (
    <section className="section page-section plot-inventory-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">INVENTORY CONTROL</span>
          <h1>Plot Availability</h1>
          <p className="muted">Update availability counts for your existing Plot listings.</p>
        </div>
        <Link className="btn btn-ghost" to="/admin">← Admin dashboard</Link>
      </div>

      {message && <p className="notice" role="status">{message}</p>}

      {loading ? <p>Loading Plot listings…</p> : !listings.length ? (
        <div className="empty"><p>No Plot listings found.</p></div>
      ) : (
        <>
          <div className="plot-inventory-summary" aria-label="Plot availability totals">
            <div><span>Plot listings</span><b>{summary.plots}</b></div>
            <div><span>Total units</span><b>{summary.total}</b></div>
            <div><span>Available</span><b>{summary.available}</b></div>
            <div><span>Reserved</span><b>{summary.reserved}</b></div>
            <div><span>Sold</span><b>{summary.sold}</b></div>
          </div>

          <div className="plot-inventory-filters">
            <label className="plot-inventory-search">
              Search plots
              <input
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search by plot name, ID or city / town"
              />
            </label>
            <label>
              City / Town
              <select value={cityFilter} onChange={event => setCityFilter(event.target.value)}>
                <option value="all">All cities / towns</option>
                {cities.map(city => <option key={city} value={city}>{city}</option>)}
              </select>
            </label>
            <label>
              Availability
              <select value={availabilityFilter} onChange={event => setAvailabilityFilter(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="available">Available</option>
                <option value="reserved">Reservation in progress</option>
                <option value="sold">Sold out</option>
                <option value="not-updated">Not updated</option>
              </select>
            </label>
            <button className="btn btn-ghost plot-filter-reset" type="button" onClick={resetFilters}>Clear filters</button>
          </div>

          <p className="plot-filter-result">
            Showing <b>{filteredListings.length}</b> of <b>{listings.length}</b> Plot listings
          </p>

          {!filteredListings.length ? (
            <div className="empty"><p>No plots match these filters.</p><button className="btn btn-ghost" onClick={resetFilters}>Clear filters</button></div>
          ) : (
            <div className="plot-count-list">
              {filteredListings.map(listing => {
                const value = { ...empty, ...counts[listing.id] }
                const total = value.available_count + value.reserved_count + value.sold_count
                const plotStatus = getPlotStatus(value, Boolean(counts[listing.id]))
                return (
                  <article className="plot-count-row" key={listing.id}>
                    <div className="plot-count-title">
                      <b>{listing.title}</b>
                      <small>{[listing.city, listing.status].filter(Boolean).join(' · ')}</small>
                      <span className={'plot-admin-status plot-admin-status-' + plotStatus}>{statusLabels[plotStatus]}</span>
                    </div>
                    <div className="plot-count-fields">
                      <label>Available<input type="number" min="0" step="1" value={value.available_count} onChange={event => change(listing.id, 'available_count', event.target.value)} /></label>
                      <label>Reserved<input type="number" min="0" step="1" value={value.reserved_count} onChange={event => change(listing.id, 'reserved_count', event.target.value)} /></label>
                      <label>Sold<input type="number" min="0" step="1" value={value.sold_count} onChange={event => change(listing.id, 'sold_count', event.target.value)} /></label>
                      <div className="plot-count-total"><small>Total</small><b>{total}</b></div>
                      <button className="btn btn-primary" disabled={busy} onClick={() => save(listing)}>Save</button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}
    </section>
  )
}
