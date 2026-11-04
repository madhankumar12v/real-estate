export const districts = [
  'Ariyalur','Chengalpattu','Chennai','Coimbatore','Cuddalore','Dharmapuri','Dindigul','Erode',
  'Kallakurichi','Kancheepuram','Kanniyakumari','Karur','Krishnagiri','Madurai','Mayiladuthurai',
  'Nagapattinam','Namakkal','Nilgiris','Perambalur','Pudukkottai','Ramanathapuram','Ranipet',
  'Salem','Sivaganga','Tenkasi','Thanjavur','Theni','Thoothukudi','Tiruchirappalli','Tirunelveli',
  'Tirupathur','Tiruppur','Tiruvallur','Tiruvannamalai','Tiruvarur','Vellore','Viluppuram','Virudhunagar'
]
export const money = n => n == null ? 'Price on request' : new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n)
export const waLink = (phone, title) => {
  const p = String(phone || import.meta.env.VITE_WHATSAPP_DEFAULT || '').replace(/\D/g,'')
  const msg = encodeURIComponent(`Hello, I am interested in this property: ${title}`)
  return p ? `https://wa.me/${p}?text=${msg}` : `https://wa.me/?text=${msg}`
}
export const placeholder = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1000'
