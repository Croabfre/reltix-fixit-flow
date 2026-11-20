// Classify a tenant's free-text report: trade, urgency, short summary.
// Uses one LLM call when ANTHROPIC_API_KEY is set, otherwise keyword rules.

const TRADES = {
  heating: ['heating', 'heater', 'radiator', 'boiler', 'heizung', 'heizkörper', 'therme', 'warm water', 'hot water', 'warmwasser', 'cold flat', 'kalt'],
  plumbing: ['leak', 'water', 'pipe', 'toilet', 'drain', 'tap', 'wasser', 'rohr', 'abfluss', 'tropft'],
  electrical: ['power', 'socket', 'light', 'fuse', 'strom', 'steckdose', 'sicherung'],
  locksmith: ['lock', 'key', 'door won', 'schlüssel', 'schloss'],
};

const HIGH = ['no heating', 'not working', 'cold', 'broken', 'kaputt', 'keine heizung', 'ausgefallen', 'since yesterday', 'seit gestern', 'gas smell', 'flood', 'baby', 'no hot water', 'kein warmwasser'];

function isHeatingSeason(date = new Date()) {
  const m = date.getMonth(); // 0 = Jan
  return m >= 9 || m <= 3; // Oct–Apr
}

export function ruleTriage(text) {
  const t = text.toLowerCase();
  let trade = 'general';
  let best = 0;
  for (const [name, words] of Object.entries(TRADES)) {
    const hits = words.filter((w) => t.includes(w)).length;
    if (hits > best) {
      best = hits;
      trade = name;
    }
  }
  const reasons = [];
  let urgency = 'normal';
  if (HIGH.some((w) => t.includes(w))) {
    urgency = 'high';
    reasons.push('report describes a complete outage');
  }
  if (trade === 'heating' && isHeatingSeason()) {
    urgency = 'high';
    reasons.push('heating season (Oct–Apr): landlord must restore heat quickly');
  }
  if (t.includes('gas smell') || t.includes('gasgeruch')) {
    urgency = 'emergency';
    reasons.push('possible gas leak');
  }
  const summary = trade === 'heating'
    ? `Heating failure in the flat${t.includes('hot water') || t.includes('warmwasser') ? ', also no hot water' : ''}. Tenant: "${text.trim()}"`
    : `Tenant report: "${text.trim()}"`;
  return { trade, urgency, summary, reasons, title: ruleTitle(t, trade), source: 'rules' };
}

/** Which LLM provider is configured: OpenAI wins if both keys are set. */
export function aiProvider() {
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return null;
}

const TRADE_VALUES = ['heating', 'plumbing', 'electrical', 'locksmith', 'general', 'service'];
const URGENCY_VALUES = ['emergency', 'high', 'normal', 'low'];

function systemPrompt() {
  return (
    'You triage tenant repair reports for a German property manager. Reports may be in German or English; always write title, summary and reasons in English. ' +
    'Reply with a JSON object only: ' +
    `{"trade":"${TRADE_VALUES.join('|')}","urgency":"${URGENCY_VALUES.join('|')}",` +
    '"title":"2-4 word name for the request, e.g. Heating not working","summary":"one sentence in English telling the craftsman what is wrong","reasons":["short reason for the urgency"]}. ' +
    `Today is ${new Date().toDateString()}. A heating outage between October and April is at least "high". ` +
    'A gas smell is "emergency". Radiators, boilers and thermostats are always "heating". Furniture, doors, windows, blinds and other small fixes are "general". ' +
    'If nothing needs fixing and the tenant wants a service or information (internet, electricity or gas contract, insurance, moving, cleaning, registration, keys, parking), the trade is "service", urgency "low", and the title names the service (e.g. "Internet contract").'
  );
}

/** One LLM call with any system prompt and chat history. Returns the text answer. */
export async function llm(system, messages, { json = false, maxTokens = 400 } = {}) {
  const provider = aiProvider();
  if (!provider) throw new Error('no API key');
  if (provider === 'openai') {
    const res = await fetch(`${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        ...(json ? { response_format: { type: 'json_object' } } : {}),
        temperature: json ? 0 : 0.3,
        max_tokens: maxTokens,
        messages: [{ role: 'system', content: system }, ...messages],
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return (await res.json()).choices?.[0]?.message?.content ?? '';
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5', max_tokens: maxTokens, system, messages }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).content?.find((c) => c.type === 'text')?.text ?? '';
}

async function callOpenAI(text) {
  const res = await fetch(`${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      response_format: { type: 'json_object' },
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt() },
        { role: 'user', content: text },
      ],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callAnthropic(text) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
      max_tokens: 300,
      system: systemPrompt(),
      messages: [{ role: 'user', content: text }],
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.content?.find((c) => c.type === 'text')?.text ?? '';
}

/** Validate the model's answer; anything missing or invalid falls back to the rules' value. */
function normalise(raw, fallback) {
  const parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
  const out = { ...fallback };
  if (TRADE_VALUES.includes(parsed.trade)) out.trade = parsed.trade;
  if (URGENCY_VALUES.includes(parsed.urgency)) out.urgency = parsed.urgency;
  if (typeof parsed.summary === 'string' && parsed.summary.trim()) out.summary = parsed.summary.trim();
  if (typeof parsed.title === 'string' && parsed.title.trim()) out.title = parsed.title.trim().slice(0, 40);
  if (Array.isArray(parsed.reasons)) out.reasons = parsed.reasons.filter((r) => typeof r === 'string').slice(0, 4);
  // Safety net: never let the model downgrade a heating outage in heating season.
  if (fallback.urgency === 'high' && out.urgency !== 'emergency' && out.trade === 'heating') out.urgency = 'high';
  return out;
}

// Short case name the tenant sees in their request list.
function ruleTitle(t, trade) {
  if (t.includes('gas smell') || t.includes('gasgeruch')) return 'Gas smell';
  if (t.includes('hot water') || t.includes('warmwasser')) return 'No hot water';
  if (trade === 'heating') {
    if (t.includes('noise') || t.includes('geräusch') || t.includes('laut')) return 'Noisy heating';
    if (t.includes('leak') || t.includes('tropft') || t.includes('undicht')) return 'Leaking radiator';
    return 'Heating not working';
  }
  if (trade === 'plumbing') return t.includes('leak') || t.includes('tropft') ? 'Water leak' : 'Plumbing problem';
  if (['sofa', 'couch', 'furniture', 'möbel', 'wardrobe', 'schrank', 'shelf', 'regal'].some((w) => t.includes(w))) return 'Broken furniture';
  if (['door', 'window', 'tür', 'fenster', 'blind', 'rollladen'].some((w) => t.includes(w))) return 'Door or window problem';
  if (/(internet|wifi|wlan|broadband|fibre|glasfaser)/.test(t)) return 'Internet connection';
  if (/(electricity|energy|strom|gas contract|tariff)/.test(t) && !/(no power|outage|fuse)/.test(t)) return 'Energy contract';
  if (/(insurance|versicherung|liability)/.test(t)) return 'Insurance';
  if (/(moving|umzug|removal)/.test(t)) return 'Moving help';
  if (/(cleaning|reinigung)/.test(t)) return 'Cleaning service';
  if (trade === 'electrical') return 'Electrical problem';
  if (trade === 'locksmith') return 'Lock or key problem';
  return 'Repair request';
}

export async function triage(text, { useAi } = {}) {
  const rules = ruleTriage(text);
  const provider = aiProvider();
  if (!useAi || !provider) return rules;
  try {
    const raw = provider === 'openai' ? await callOpenAI(text) : await callAnthropic(text);
    return { ...normalise(raw, rules), source: 'ai', provider };
  } catch (err) {
    console.warn(`[triage] ${provider} failed, using rules:`, err.message);
    return { ...rules, ai_error: err.message };
  }
}
