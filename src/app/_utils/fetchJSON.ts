// app/_utils/fetchJSON.ts
export async function jsonFetch(url: string, options: RequestInit = {}) {
  const token = document.cookie.split('; ').find(x => x.startsWith('csrf_token='))?.split('=')[1] || '';
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type':'application/json', 'x-csrf-token': token, ...(options.headers || {}) }
  });
  return res;
}
