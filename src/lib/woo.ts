import 'server-only';

const base = process.env.WOOCOMMERCE_URL!;
const key = process.env.WOOCOMMERCE_KEY!;
const secret = process.env.WOOCOMMERCE_SECRET!;

function authHeaders(extra: HeadersInit = {}) {
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  return { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json', ...extra };
}

export async function woo(path: string, init: RequestInit = {}) {
  const url = `${base.replace(/\/$/, '')}/wp-json/wc/v3${path}`;
  const res = await fetch(url, { ...init, headers: authHeaders(init.headers), cache: 'no-store' });
  if (!res.ok) throw new Error(`Woo API ${res.status} ${res.statusText}: ${await res.text()}`);
  return res.json();
}

// Same as woo(), but also returns totals for list endpoints
export async function wooJsonWithTotals(path: string, init: RequestInit = {}) {
  const url = `${base.replace(/\/$/, '')}/wp-json/wc/v3${path}`;
  const res = await fetch(url, { ...init, headers: authHeaders(init.headers), cache: 'no-store' });
  if (!res.ok) throw new Error(`Woo API ${res.status} ${res.statusText}: ${await res.text()}`);
  const data = await res.json();
  const total = Number(res.headers.get('x-wp-total') || 0);
  const totalPages = Number(res.headers.get('x-wp-totalpages') || 0);
  return { data, total, totalPages };
}
