export const cityTowns = ['Ranipet','Vellore','Arcot','Anaicut','Walajah','Katpadi','Gudiyatham']

// Keep the existing required database district column populated without asking users to select a district.
export const districtForCity = city => ({
  Ranipet: 'Ranipet',
  Vellore: 'Vellore',
  Arcot: 'Ranipet',
  Anaicut: 'Vellore',
  Walajah: 'Ranipet',
  Katpadi: 'Vellore',
  Gudiyatham: 'Vellore'
}[city] || 'Vellore')
export const money = n => n == null ? 'Price on request' : new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n)
export const waLink = (phone, title) => {
  const p = String(phone || import.meta.env.VITE_WHATSAPP_DEFAULT || '').replace(/\D/g,'')
  const msg = encodeURIComponent(`Hello, I am interested in this property: ${title}`)
  return p ? `https://wa.me/${p}?text=${msg}` : `https://wa.me/?text=${msg}`
}
export const placeholder = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1000'
