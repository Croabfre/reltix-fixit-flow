// Services around the flat that tenants ask about besides repairs: internet,
// energy, insurance, moving, cleaning and everyday questions. Providers and
// prices are fictional. The assistant may only quote what is in here.

export const SERVICE_CATEGORIES = ['internet', 'energy', 'insurance', 'moving', 'cleaning', 'other'];

const OFFERS = [
  // internet – availability depends on the building (see connectivityFor)
  { category: 'internet', provider: 'Example Fibre', product: 'Fibre 500', price: '€34.99/month (first 6 months €19.99), 24 months', needs: 'fibre', setup: 'One technician visit to connect the fibre box in the basement; usually within 10 working days.', data_needed: ['name', 'address', 'start date', 'email'] },
  { category: 'internet', provider: 'Example Fibre', product: 'Fibre 1000', price: '€49.99/month, 24 months', needs: 'fibre', setup: 'As Fibre 500.', data_needed: ['name', 'address', 'start date', 'email'] },
  { category: 'internet', provider: 'CityCable', product: 'Cable 250', price: '€29.99/month, monthly cancellable', needs: 'cable', setup: 'Router by post, self-install via the TV socket; live in 3–5 days.', data_needed: ['name', 'address', 'start date', 'email'] },
  { category: 'internet', provider: 'TeleNet', product: 'DSL 100', price: '€24.99/month, 24 months', needs: 'dsl', setup: 'Line switched on remotely; router by post; about 7 days.', data_needed: ['name', 'address', 'start date', 'email'] },
  { category: 'internet', provider: 'SkyMobile', product: '5G Home 300', price: '€29.99/month, monthly cancellable', needs: null, setup: 'Plug-in 5G router, works the next day – good as a bridge until a line is active.', data_needed: ['name', 'address', 'email'] },

  // energy – the meter number comes from the flat record, so no meter reading form
  { category: 'energy', provider: 'GreenGrid Energy', product: 'Green Electricity 12', price: '€0.29/kWh + €11.90/month base, 12-month price guarantee', setup: 'Switch takes about 3 weeks; GreenGrid cancels the old contract for you. Your meter number is already on file.', data_needed: ['name', 'address', 'meter number', 'start date'] },
  { category: 'energy', provider: 'City Utilities', product: 'Basic supply', price: '€0.36/kWh + €13.50/month base, cancellable anytime', setup: 'Applies automatically if you have not chosen a supplier.', data_needed: [] },

  // insurance – the landlord's building insurance does NOT cover the tenant's own things
  { category: 'insurance', provider: 'HomeSafe', product: 'Contents insurance', price: 'from €4.90/month for a flat up to 70 m² (€6.90 up to 100 m²)', setup: 'Online in a few minutes; covers furniture and belongings against fire, water damage, burglary and storm.', data_needed: ['name', 'address', 'flat size', 'start date'] },
  { category: 'insurance', provider: 'SafeHand', product: 'Personal liability insurance', price: '€5.50/month', setup: 'Covers damage you cause to others – including to the rented flat (e.g. a dropped pan cracking the hob).', data_needed: ['name', 'date of birth', 'address'] },
  { category: 'insurance', provider: 'HomeSafe', product: 'Glass breakage add-on', price: '€1.20/month', setup: 'Covers glass hobs, windows and mirrors.', data_needed: [] },

  // moving & cleaning
  { category: 'moving', provider: 'MoveEasy', product: 'Local move', price: 'from €390 for a 2-room flat in the same city, €540 for 3 rooms; boxes delivered free', setup: 'Free video survey, fixed price before the move.', data_needed: ['name', 'old and new address', 'moving date', 'flat size'] },
  { category: 'moving', provider: 'MoveEasy', product: 'Furniture assembly', price: '€45/hour', setup: 'Book together with the move or on its own.', data_needed: ['name', 'address', 'date'] },
  { category: 'cleaning', provider: 'Sparkle & Co', product: 'Move-out cleaning', price: '€3.20/m² (e.g. €218 for 68 m²), including windows', setup: 'Book at least 5 days before the handover.', data_needed: ['name', 'address', 'flat size', 'date'] },
  { category: 'cleaning', provider: 'Sparkle & Co', product: 'Regular home cleaning', price: '€32/hour, every week or every two weeks', setup: 'Same cleaner each time.', data_needed: ['name', 'address'] },
];

// Plain answers to everyday questions that are not repairs or offers.
export const GENERAL_ANSWERS = {
  broadcasting_fee: 'The German broadcasting fee (Rundfunkbeitrag) is €18.36 per household per month; register once per flat at rundfunkbeitrag.de within a month of moving in.',
  address_registration: 'You have to register your address at the city citizens\' office within 2 weeks of moving in. Your property manager provides the landlord confirmation (Wohnungsgeberbestätigung) – ask here and it is sent to you.',
  lost_keys: 'Replacement keys are ordered through the caretaker. If a key was lost, the tenant pays for the replacement (about €25–60 per key; if a building master key is lost the lock system may need changing).',
  bulky_waste: 'Bulky waste (old furniture, mattresses) is collected free twice a year per household – book online with the city waste service.',
  parking: 'There are no private parking spaces in the demo buildings; residents\' parking permits are issued by the city.',
  subletting: 'Subletting part of the flat needs the landlord\'s written permission – the property manager decides, the assistant cannot approve it.',
  pets: 'Small pets (fish, hamsters) are fine. Cats and dogs need the landlord\'s permission – the property manager answers this.',
};

/** What the building can get: fibre, cable, DSL. */
export function connectivityFor(property) {
  return property.connectivity ?? { fibre: false, cable: true, dsl: 100 };
}

/** Offers that actually apply to this flat (internet filtered by what the building has). */
export function offersFor(property) {
  const c = connectivityFor(property);
  return OFFERS.filter((o) => o.category !== 'internet' || o.needs == null || (o.needs === 'fibre' ? c.fibre : o.needs === 'cable' ? c.cable : !!c.dsl));
}

export function serviceCategory(text) {
  const t = text.toLowerCase();
  if (/(internet|wifi|wi-fi|wlan|broadband|fibre|fiber|glasfaser|router|dsl|5g)/.test(t)) return 'internet';
  if (/(electricity|energy|power contract|power supplier|gas contract|gas supplier|tariff|strom|stromvertrag|energie)/.test(t)) return 'energy';
  if (/(insurance|insured|versicherung|liability|haftpflicht|hausrat)/.test(t)) return 'insurance';
  if (/(moving|move out|move in|removal|umzug|movers)/.test(t)) return 'moving';
  if (/(cleaning|cleaner|reinigung|putzen)/.test(t)) return 'cleaning';
  if (/(broadcast|tv licen|rundfunk|register my address|anmeldung|bulky waste|sperrmüll|parking|sublet|pet\b|dog|cat\b|key)/.test(t)) return 'other';
  return null;
}

/** Fallback answer without an AI key: list the matching offers. */
export function ruleServiceReply(category, property, firstName) {
  if (category === 'other') {
    return `Thanks ${firstName} – your property manager will answer this here shortly.`;
  }
  const list = offersFor(property).filter((o) => o.category === category);
  if (!list.length) return `Thanks ${firstName} – your property manager will get back to you about this here.`;
  const lines = list.slice(0, 3).map((o) => `• ${o.provider} ${o.product}: ${o.price}`).join('\n');
  return `Here is what reltix partners offer for your flat:\n${lines}\nReply "yes" with the one you want and we'll ask them to send you a pre-filled offer – you only confirm it.`;
}
