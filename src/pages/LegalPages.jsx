import { Link, useParams } from 'react-router-dom'

const contact = { email: 'mrsasolutions2@gmail.com', phone: '88380 37689' }

const pages = {
  disclaimer: {
    title: 'Disclaimer',
    intro: 'MrSa Properties is a free online property listing and enquiry platform serving users interested in property opportunities in Tamil Nadu.',
    sections: [
      ['Platform role', 'MrSa Properties provides a place for property owners, sellers, authorised representatives, buyers and channel partners to publish or discover property information and make contact. Unless separately agreed in writing, MrSa is not the owner, seller, developer, legal adviser, broker or guarantor of a listed property or transaction.'],
      ['User-submitted information', 'Property titles, descriptions, photographs, prices, measurements, locations, availability and other listing details are supplied by users or their representatives. Listings may be reviewed for publication, but that review is not an independent verification or certification of ownership, title, approvals, measurements, claims or legal status.'],
      ['Buyer due diligence', 'Before paying an advance or purchasing, buyers should independently inspect the property and verify the seller’s identity and authority, title and ownership documents, encumbrance records, applicable patta and revenue records, planning and building approvals, access and boundaries, taxes, loans, disputes and RERA registration or other approvals wherever applicable. Obtain advice from a qualified property lawyer and relevant professionals.'],
      ['No guarantee or professional advice', 'MrSa does not guarantee that a property is available, accurately described, legally transferable, free from disputes or suitable for a particular purpose. Website content is general information and is not legal, financial, valuation or investment advice.'],
      ['Transactions and third parties', 'Users are responsible for their own discussions, inspections, negotiations, agreements and payments. Do not transfer money solely because a listing appears on this website. Any agreement or payment made directly between users is their responsibility, subject to applicable law. Third-party services such as WhatsApp may have their own terms and privacy practices.'],
      ['Reporting concerns', 'If you believe a listing is false, unauthorised or misleading, contact us with the listing URL and details so we can review it.']
    ]
  },
  'privacy-policy': {
    title: 'Privacy Policy',
    intro: 'This policy explains how MrSa Properties handles information when you browse the website, create an account, submit a property or send an enquiry.',
    sections: [
      ['Information we may collect', 'Depending on the features you use, information may include your name, phone number, email address, account and authentication details, property listing details, photographs, enquiry messages, city or locality, property preferences, saved properties, and technical or usage information needed to operate and secure the website.'],
      ['How information is used', 'We use information to create and manage accounts, review and publish listings, respond to enquiries, connect buyers with the relevant owner or authorised representative, provide customer support, maintain saved-property and account features, prevent misuse, protect the website and improve our services.'],
      ['Enquiry sharing', 'When you send an enquiry about a property, relevant details such as your name, contact information and message may be shared with the concerned property owner, seller or channel partner so they can respond. Please avoid including sensitive personal information in enquiry messages.'],
      ['Service providers and disclosures', 'We may use service providers for hosting, database, authentication, storage, security and communication, including Cloudflare, Supabase and WhatsApp where those services are used. Information may also be disclosed where required by law or where reasonably necessary to protect users, the platform or legal rights. We do not sell personal information as a business activity.'],
      ['Security and retention', 'We use reasonable technical and organisational safeguards appropriate to the information and service. No internet transmission or storage system can be guaranteed completely secure. We retain information for as long as reasonably necessary for the purposes described, account operation, dispute handling, security and applicable legal requirements.'],
      ['Your choices and requests', 'You may contact us to request access to, correction of or deletion of personal information, withdraw consent where applicable, or raise a privacy concern. We will handle requests in accordance with applicable law. Some information may need to be retained where required by law or for legitimate security and dispute-resolution purposes.'],
      ['Cookies and technical data', 'The website and its service providers may use essential browser storage, cookies or similar technical mechanisms for login, saved properties, security and website functionality. Browser settings may allow you to manage some cookies, although disabling essential storage may affect features.'],
      ['Policy updates', 'We may update this policy as the website or applicable law changes. The revised version and effective date will be published on this page.']
    ]
  },
  'terms-and-conditions': {
    title: 'Terms & Conditions',
    intro: 'By accessing or using MrSa Properties, you agree to these terms. If you do not agree, please do not use the website.',
    sections: [
      ['Who may use the platform', 'You must use the website lawfully and provide information that is accurate to the best of your knowledge. You are responsible for activity carried out through your account and for keeping your login credentials secure.'],
      ['Property owners and listing submitters', 'You must own the property or have the owner’s permission or other lawful authority to advertise it. You must provide accurate, current and non-misleading details and use photographs and other content you are authorised to share. Tell us promptly if a property is sold, withdrawn or no longer available.'],
      ['Buyers and enquirers', 'You are responsible for independently checking property details, the seller’s authority, documents, approvals, price and availability. You should inspect the property and obtain independent professional advice before making a commitment or payment.'],
      ['Agents and channel partners', 'Agents and channel partners must have appropriate authority to advertise the properties they submit, must not misrepresent their role or relationship with an owner, and must handle enquiry information lawfully and only for the relevant purpose.'],
      ['Listing review and moderation', 'Listings may be reviewed before publication. MrSa may request clarification, decline, edit for formatting, suspend or remove content that appears incomplete, misleading, unlawful, unauthorised, duplicated, abusive or inconsistent with these terms. Publication approval is not legal verification or a guarantee.'],
      ['Prohibited use', 'Do not post fraudulent or misleading listings, impersonate another person, upload content without permission, misuse personal information, harass users, interfere with website security, attempt unauthorised access or use the platform for unlawful activity.'],
      ['Free service and no platform commission', 'MrSa Properties currently provides property browsing, account registration, listing submission and enquiry features free of charge. MrSa currently charges no listing fee, buyer enquiry fee, brokerage, commission or platform service fee. This does not prevent an independent third party from separately charging a fee under an agreement directly with you; any such fee is not an MrSa fee and should be disclosed and agreed independently.'],
      ['Availability and liability', 'We aim to keep the website available and useful but do not promise uninterrupted or error-free operation. To the extent permitted by law, MrSa is not responsible for user-submitted content, third-party conduct, direct dealings between users or losses arising from reliance on unverified listing information. Nothing in these terms excludes liability or consumer rights that cannot lawfully be excluded.'],
      ['Suspension and changes', 'We may restrict accounts or remove content for suspected misuse, fraud, security concerns or breach of these terms. We may update these terms; the latest version will appear on this page.']
    ]
  },
  'pricing-policy': {
    title: 'Pricing Policy',
    intro: 'MrSa Properties currently operates as a free property listing and enquiry platform.',
    sections: [
      ['Current platform charges', 'There is currently no charge by MrSa for browsing properties, creating a buyer account, submitting a property listing, sending a property enquiry or participating as a channel partner. MrSa currently collects no brokerage, commission or platform service fee from property transactions.'],
      ['Property prices', 'The property price displayed in a listing is supplied by the owner, seller or their authorised representative. It may change or the property may become unavailable. Contact the seller to confirm the latest price, availability and terms before travelling, negotiating or paying.'],
      ['Other transaction costs', 'Stamp duty, registration charges, taxes, legal fees, loan costs, inspection costs and any independently agreed third-party brokerage or professional fees are not MrSa charges and are not included unless a listing expressly says otherwise. Confirm all costs with the relevant provider or authority.'],
      ['Future paid services', 'If MrSa introduces any paid feature in the future, its price, scope, payment terms and applicable cancellation or refund conditions will be clearly shown before you choose to purchase it. No future fee applies unless you are informed of it and agree to it.']
    ]
  },
  'refund-policy': {
    title: 'Refund & Cancellation Policy',
    intro: 'MrSa Properties currently provides free property listing and enquiry features and does not collect platform fees.',
    sections: [
      ['Current position', 'Because MrSa currently charges no listing fee, registration fee, enquiry fee, brokerage, commission or service fee, there are no current MrSa platform charges to refund or cancel.'],
      ['Payments between users', 'Any advance, deposit, sale consideration or other payment made directly between a buyer and seller is not collected by MrSa. The parties must address such payments under their own agreement and applicable law. MrSa does not hold or process these transaction payments as part of its current free listing model.'],
      ['Future paid services', 'If paid services are introduced, separate cancellation, refund, eligibility and processing terms will be displayed before payment is accepted.']
    ]
  },
  contact: {
    title: 'Contact & Grievance Redressal',
    intro: 'Contact MrSa Properties for website support, listing concerns, privacy requests or complaints.',
    sections: [
      ['What you can report', 'You may contact us about inaccurate or duplicate listings, suspected fraud, unauthorised photographs, account access, misuse of contact details, privacy concerns, website problems or other platform-related complaints.'],
      ['How to submit a complaint', 'Please include your name, a reply contact, the property listing URL or relevant account detail, a clear description of the issue and any supporting information. Do not send passwords, OTPs or unnecessary sensitive personal information.'],
      ['Review and response', 'We will review complaints and respond within a reasonable period, taking into account the nature of the issue and applicable legal requirements. Where necessary, we may ask for additional information or restrict a listing while reviewing a credible concern.']
    ]
  },
  'buyer-safety': {
    title: 'Buyer Safety Guidelines',
    intro: 'Take time to check every property and seller independently before making a commitment.',
    sections: [
      ['Meet and identify', 'Meet the owner or authorised representative where practical. Confirm their identity and written authority to sell or advertise the property.'],
      ['Check documents', 'Ask an independent property lawyer to review title and ownership documents, encumbrance records, applicable revenue records, planning and building approvals, RERA details wherever applicable, and any loans, disputes or restrictions.'],
      ['Inspect the property', 'Visit the actual site, check boundaries, access, measurements, utilities and surrounding conditions. Do not rely only on photographs, maps or verbal assurances.'],
      ['Confirm price and payment terms', 'Confirm the final price, inclusions, timelines and payment conditions in writing. Make payments only after appropriate checks, to the verified entitled person, and obtain receipts. Avoid cash or transfers to unrelated third parties.'],
      ['Remember', 'A listing being visible or approved for publication on MrSa does not mean its ownership, documents or legal status have been certified by MrSa.']
    ]
  }
}

export default function LegalPages() {
  const { slug } = useParams()
  const page = pages[slug]
  if (!page) return <section className="section page-section"><h1>Policy page not found</h1><Link to="/">Return home</Link></section>
  return <section className="section page-section legal-page">
    <div className="legal-page-heading"><span className="eyebrow">MRSA PROPERTIES · WEBSITE POLICIES</span><h1>{page.title}</h1><p className="muted">{page.intro}</p><p className="legal-effective">Effective date: 9 November 2026</p></div>
    <div className="legal-content">{page.sections.map(([heading, body]) => <section className="legal-section" key={heading}><h2>{heading}</h2><p>{body}</p></section>)}</div>
    <div className="legal-contact"><h2>Need assistance?</h2><p>Email: <a href={`mailto:${contact.email}`}>{contact.email}</a></p><p>Phone: <a href={`tel:${contact.phone.replace(/\s/g, '')}`}>{contact.phone}</a></p><Link className="text-link" to="/">Return to MrSa Properties →</Link></div>
  </section>
}
