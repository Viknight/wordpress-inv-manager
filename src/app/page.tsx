'use client';
import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';

/* ---------- Types ---------- */
type Product = {
  id: number; name: string; sku: string; type: 'simple' | 'variable';
  manage_stock: boolean; stock_quantity: number | null; stock_status: string;
  regular_price: string; price: string;
};
type Variation = {
  id: number; sku: string; regular_price: string;
  manage_stock: boolean; stock_quantity: number | null; stock_status: string;
  attributes: { name: string; option: string }[];
};
type ExpandedMap = Partial<Record<number, Variation[] | 'loading'>>;
type ProdDraft = { manage_stock?: boolean; stock_quantity?: number; regular_price?: string };
type VarDraft = { manage_stock?: boolean; stock_quantity?: number; regular_price?: string };
type SortKey = 'id' | 'name' | 'type' | 'price' | 'qty';

/* ---------- Tiny Toasts ---------- */
type Toast = { id: number; text: string; tone: 'success' | 'error' };
function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  function push(text: string, tone: Toast['tone'] = 'success') {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, text, tone }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2500);
  }
  return { toasts, push };
}

/* ---------- Page ---------- */
export default function InventoryDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<Product[]>([]);
  const [expanded, setExpanded] = useState<ExpandedMap>({});
  const [editing, setEditing] = useState(false);

  const [prodDrafts, setProdDrafts] = useState<Record<number, ProdDraft>>({});
  const [varDrafts, setVarDrafts] = useState<Record<number, Record<number, VarDraft>>>({});
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'id', dir: 'asc' });
  // pages
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const { toasts, push } = useToasts();
  const hasSearch = search.trim().length > 0;

  // loader – ALWAYS set rows to an array
  async function load(q: string = search, p: number = page, pp: number = perPage) {
    setLoading(true);
    const res = await fetch(`/api/products?per_page=${pp}&page=${p}&search=${encodeURIComponent(q)}`);
    const j = await res.json();

    // j can be the new object OR (if you hit old code) a raw array.
    const items: Product[] = Array.isArray(j) ? j : j.items ?? [];
    setRows(items);
    setPage(Array.isArray(j) ? p : (j.page ?? p));
    setPerPage(Array.isArray(j) ? pp : (j.perPage ?? pp));
    setTotal(Array.isArray(j) ? items.length : (j.total ?? 0));
    setTotalPages(Array.isArray(j) ? 1 : (j.totalPages ?? 1));

    setLoading(false);
  }

  function toggleSort(key: SortKey) {
    setSort(s => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }

  // initial load
  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [sidebarOpen]);


  async function loadVariations(productId: number) {
    setExpanded(prev => ({ ...prev, [productId]: 'loading' }));
    const res = await fetch(`/api/variations/${productId}`);
    const data = await res.json();
    setExpanded(prev => ({ ...prev, [productId]: data as Variation[] }));
  }

  function closeVariations(productId: number) {
    setExpanded(prev => {
      const clone = { ...prev };
      delete clone[productId];
      return clone;
    });
  }

  function startEdit() { setEditing(true); setProdDrafts({}); setVarDrafts({}); }
  function cancelEdit() { setEditing(false); setProdDrafts({}); setVarDrafts({}); load(); }

  const dirtyCount = useMemo(() => {
    const p = Object.keys(prodDrafts).length;
    const v = Object.values(varDrafts).reduce((acc, m) => acc + Object.keys(m).length, 0);
    return p + v;
  }, [prodDrafts, varDrafts]);

  async function saveAll() {
    try {
      const prodUpdate = Object.entries(prodDrafts).map(([id, draft]) => ({ id: Number(id), ...draft }));
      if (prodUpdate.length) {
        const res = await fetch(`/api/products/batch`, { method: 'POST', body: JSON.stringify({ update: prodUpdate }) });
        if (!res.ok) throw new Error('Products batch failed');
      }
      for (const [pidStr, map] of Object.entries(varDrafts)) {
        const update = Object.entries(map).map(([vid, draft]) => ({ id: Number(vid), ...draft }));
        if (!update.length) continue;
        const res = await fetch(`/api/variations/${pidStr}/batch`, {
          method: 'POST',
          body: JSON.stringify({ update })
        });
        if (!res.ok) throw new Error(`Variations batch failed for product ${pidStr}`);
      }
      push('All changes saved', 'success');
      setEditing(false); setProdDrafts({}); setVarDrafts({}); load();
    } catch {
      push('Save failed', 'error');
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    location.href = '/login';
  }

  /* ---------- KPIs ---------- */
  const lowStockThreshold = 5;
  const totalProducts = rows.length;
  const lowStock = rows.filter(p => p.type === 'simple' && p.manage_stock && (p.stock_quantity ?? 0) > 0 && (p.stock_quantity ?? 0) <= lowStockThreshold).length;
  const outOfStock = rows.filter(p => (p.type === 'simple' && ((p.stock_quantity ?? 0) <= 0 || p.stock_status === 'outofstock'))).length;
  const valueOfStock = useMemo(() => {
    let sum = 0;
    for (const p of rows) {
      if (p.type === 'simple') {
        const qty = p.stock_quantity ?? 0;
        const price = parseFloat(p.regular_price || p.price || '0') || 0;
        sum += qty * price;
      } else {
        const state = expanded[p.id];
        if (Array.isArray(state)) {
          for (const v of state) {
            const qty = v.stock_quantity ?? 0;
            const price = parseFloat(v.regular_price || '0') || 0;
            sum += qty * price;
          }
        }
      }
    }
    return sum;
  }, [rows, expanded]);

  /* ---------- Draft helpers ---------- */
  function updateProdDraft(id: number, patch: Partial<ProdDraft>) {
    setProdDrafts(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
  }
  function updateVarDraft(pid: number, vid: number, patch: Partial<VarDraft>) {
    setVarDrafts(prev => ({
      ...prev,
      [pid]: { ...(prev[pid] || {}), [vid]: { ...(prev[pid]?.[vid] || {}), ...patch } }
    }));
  }

  //sorting helpers that consider drafts
  const displayPrice = useCallback((p: Product) => {
    if (p.type === 'variable') return Number.NaN;
    const raw = (prodDrafts[p.id]?.regular_price ?? p.regular_price ?? p.price ?? '0');
    return parseFloat(String(raw)) || 0;
  }, [prodDrafts]);

  const displayQty = useCallback((p: Product) => {
    if (p.type === 'variable') return Number.NaN;
    return Number(prodDrafts[p.id]?.stock_quantity ?? p.stock_quantity ?? 0);
  }, [prodDrafts]);

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    const dir = sort.dir === 'asc' ? 1 : -1;

    arr.sort((a, b) => {
      if (sort.key === 'id') return dir * (a.id - b.id);
      if (sort.key === 'name') return dir * String(a.name).localeCompare(String(b.name));
      if (sort.key === 'type') return dir * String(a.type).localeCompare(String(b.type));
      if (sort.key === 'price') {
        if (a.type === 'variable' && b.type !== 'variable') return 1;
        if (b.type === 'variable' && a.type !== 'variable') return -1;
        return dir * (displayPrice(a) - displayPrice(b));
      }
      if (sort.key === 'qty') {
        if (a.type === 'variable' && b.type !== 'variable') return 1;
        if (b.type === 'variable' && a.type !== 'variable') return -1;
        return dir * (displayQty(a) - displayQty(b));
      }
      return 0;
    });

    return arr;
  }, [rows, sort, displayPrice, displayQty]);

  function SortBtn({ label, k }: { label: string; k: SortKey }) {
    const active = sort.key === k;
    const arrow = !active ? '↕' : sort.dir === 'asc' ? '↑' : '↓';
    return (
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={`inline-flex items-center gap-1 select-none ${active ? 'font-semibold' : ''}`}
        title={`Sort by ${label}`}
      >
        {label} <span className="text-slate-400">{arrow}</span>
      </button>
    );
  }

  function Pager() {
    return (
      <div className="flex items-center gap-2 px-2 py-3 text-sm">
        <span className="text-slate-500">Total: {total}</span>
        <div className="ml-auto flex items-center gap-2">
          <button className="rounded border px-2 py-1 disabled:opacity-50"
            onClick={() => load(search, 1, perPage)} disabled={page <= 1}>« First</button>
          <button className="rounded border px-2 py-1 disabled:opacity-50"
            onClick={() => load(search, page - 1, perPage)} disabled={page <= 1}>‹ Prev</button>
          <span>Page {page} / {totalPages}</span>
          <button className="rounded border px-2 py-1 disabled:opacity-50"
            onClick={() => load(search, page + 1, perPage)} disabled={page >= totalPages}>Next ›</button>
          <button className="rounded border px-2 py-1 disabled:opacity-50"
            onClick={() => load(search, totalPages, perPage)} disabled={page >= totalPages}>Last »</button>

          <select
            className="rounded border px-2 py-1"
            value={perPage}
            onChange={(e) => { const pp = Number(e.target.value); setPerPage(pp); load(search, 1, pp); }}
          >
            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}/page</option>)}
          </select>
        </div>
      </div>
    );
  }



  /* ---------- UI ---------- */
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 flex">
      {/* Sidebar (overlay on mobile, pinned on md+) */}
      <aside
        className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                  md:translate-x-0 fixed inset-y-0 left-0 w-64 z-50
                bg-slate-900 text-white transition-transform`}
      >
        <div className="h-screen flex flex-col overflow-hidden">
          <div className="p-4 text-lg font-semibold">B+V Studio Admin</div>
          <nav className="px-3 flex-1 overflow-y-auto">
            {/* menu items */}
            <a className="block rounded px-3 py-2 bg-white/10 mb-1">Inventory</a>
            <a className="block rounded px-3 py-2 hover:bg-white/10 mb-1">Orders (future)</a>
            <a className="block rounded px-3 py-2 hover:bg-white/10 mb-1">Suppliers (future)</a>
            <a className="block rounded px-3 py-2 hover:bg-white/10 mb-1">Reports (future)</a>
            <a className="block rounded px-3 py-2 hover:bg-white/10">Settings (future)</a>
          </nav>
          <div className="p-4 border-t border-white/10">
            <button onClick={logout} className="w-full rounded px-3 py-2 bg-white/10 hover:bg-white/20">Logout</button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay behind sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Main */}
      <main className="flex-1 min-w-0 md:ml-64">
        {/* Sticky header (title + menu only) */}
        <header className="sticky top-0 z-30 bg-slate-900 text-white min-h-[56px]">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <button className="md:hidden rounded bg-white/10 px-3 py-2" onClick={() => setSidebarOpen(s => !s)}>Menu</button>
              <div className="text-xl font-semibold">Inventory Management</div>
              <span className="text-white/60 hidden md:inline">Dashboard</span>
            </div>
          </div>
        </header>

        {/* Toolbar row (search + Edit/Exit on the same line) */}
        <div className="px-4 pt-4">
          <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center">
            <div className="flex gap-2 flex-1">
              {hasSearch && (
                <button
                  className="rounded px-3 py-2 bg-slate-200 hover:bg-slate-300"
                  onClick={() => { setSearch(''); load('', 1, perPage); }}
                >
                  ← Back
                </button>
              )}
              <input
                placeholder="Search by name/SKU"
                className="flex-1 rounded px-3 py-2 bg-white text-slate-900 border"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button className="rounded px-3 py-2 bg-slate-900 text-white hover:opacity-90"
                onClick={() => load(search, 1, perPage)}>
                Search
              </button>
            </div>

          </div>
        </div>

        {/* KPI cards (compact) */}
        <section className="px-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">Total Products</div>
              <div className="text-3xl font-semibold mt-1">{totalProducts}</div>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">Low stock ≤ {lowStockThreshold}</div>
              <div className="text-3xl font-semibold mt-1 text-amber-600">{lowStock}</div>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">Out of stock</div>
              <div className="text-3xl font-semibold mt-1 text-rose-600">{outOfStock}</div>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">Value of stock (approx)</div>
              <div className="text-3xl font-semibold mt-1">₹{valueOfStock.toLocaleString()}</div>
            </div>
          </div>
        </section>

        {/* Edit / Exit Edit button relocated here */}
        <div className='px-4 pb-2 flex justify-start'>
          {!editing ? (
            <button className="rounded px-3 py-2 bg-amber-400 text-slate-900 hover:opacity-90"
              onClick={startEdit}>
              Edit Inventory
            </button>
          ) : (
            <button className="rounded px-3 py-2 bg-amber-400 text-slate-900 hover:opacity-90"
              onClick={cancelEdit}>
              Exit Edit
            </button>
          )}
        </div>

        {/* Table */}
        <section className="px-4 pb-24">
          <div className="rounded-xl bg-white shadow-sm overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[900px]">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left py-2 px-2"><SortBtn label="ID" k="id" /></th>
                  <th className="text-left px-2"><SortBtn label="Name" k="name" /></th>
                  <th className="px-2"><SortBtn label="Type" k="type" /></th>
                  <th className="px-2"><SortBtn label="Price" k="price" /></th>
                  <th className="px-2"><SortBtn label="Stock qty" k="qty" /></th>
                  <th className="px-2">Track stock</th>
                  <th className="px-2 w-[220px]"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="p-4">Loading…</td></tr>
                ) : sortedRows.map((p) => (
                  <Fragment key={p.id}>
                    {/* product row */}
                    <tr className="border-b">
                      <td className="py-2 px-2">{p.id}</td>
                      <td className="px-2">
                        <div className="font-medium">{p.name}</div>
                        {p.sku ? <div className="text-slate-500 text-xs">SKU: {p.sku}</div> : null}
                      </td>
                      <td className="text-center px-2">{p.type}</td>
                      <td className="px-2">
                        {p.type === 'variable' ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <input
                            className="border rounded px-2 py-1 w-24 text-right disabled:bg-slate-100"
                            value={(prodDrafts[p.id]?.regular_price ?? p.regular_price) ?? ''}
                            disabled={!editing}
                            onChange={e => updateProdDraft(p.id, { regular_price: e.target.value })}
                          />
                        )}
                      </td>
                      <td className="px-2">
                        {p.type === 'variable' ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <input
                            type="number"
                            className="border rounded px-2 py-1 w-24 text-right disabled:bg-slate-100"
                            value={(prodDrafts[p.id]?.stock_quantity ?? p.stock_quantity ?? 0)}
                            disabled={!editing}
                            onChange={e => updateProdDraft(p.id, { stock_quantity: Number(e.target.value) })}
                          />
                        )}
                      </td>
                      <td className="text-center px-2">
                        {p.type === 'variable' ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <label className="inline-flex items-center gap-1 text-sm">
                            <input
                              type="checkbox"
                              checked={prodDrafts[p.id]?.manage_stock ?? p.manage_stock}
                              disabled={!editing}
                              onChange={e => updateProdDraft(p.id, { manage_stock: e.target.checked })}
                            />
                            <span className="text-slate-600">Track</span>
                          </label>
                        )}
                      </td>
                      <td className="text-right px-2 py-2">
                        {p.type === 'variable' && (
                          <button
                            className="rounded px-3 py-1 border hover:bg-slate-50"
                            onClick={() => {
                              const state = expanded[p.id];
                              if (state) closeVariations(p.id);
                              else loadVariations(p.id);
                            }}
                          >
                            {expanded[p.id] ? 'Close variations' : 'Load variations'}
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* variations / loading */}
                    {(() => {
                      const state = expanded[p.id];
                      if (!state) return null;
                      if (state === 'loading') {
                        return (
                          <tr key={`loading-${p.id}`}>
                            <td colSpan={7} className="py-2 pl-8">Loading variations…</td>
                          </tr>
                        );
                      }
                      return state.map((v: Variation) => (
                        <tr key={`v-${v.id}`} className="border-b bg-slate-50/60">
                          <td className="py-2 pl-8 px-2">↳ {v.id}</td>
                          <td className="px-2">
                            {v.attributes.map(a => `${a.name}:${a.option}`).join(' • ')}
                            {v.sku ? <span className="text-slate-500 text-xs ml-2">({v.sku})</span> : null}
                          </td>
                          <td className="text-center px-2">variation</td>
                          <td className="px-2">
                            <input
                              className="border rounded px-2 py-1 w-24 text-right disabled:bg-slate-100"
                              value={varDrafts[p.id]?.[v.id]?.regular_price ?? v.regular_price ?? ''}
                              disabled={!editing}
                              onChange={e => updateVarDraft(p.id, v.id, { regular_price: e.target.value })}
                            />
                          </td>
                          <td className="px-2">
                            <input
                              type="number"
                              className="border rounded px-2 py-1 w-24 text-right disabled:bg-slate-100"
                              value={varDrafts[p.id]?.[v.id]?.stock_quantity ?? v.stock_quantity ?? 0}
                              disabled={!editing}
                              onChange={e => updateVarDraft(p.id, v.id, { stock_quantity: Number(e.target.value) })}
                            />
                          </td>
                          <td className="text-center px-2">
                            <label className="inline-flex items-center gap-1 text-sm">
                              <input
                                type="checkbox"
                                checked={varDrafts[p.id]?.[v.id]?.manage_stock ?? v.manage_stock}
                                disabled={!editing}
                                onChange={e => updateVarDraft(p.id, v.id, { manage_stock: e.target.checked })}
                              />
                              <span className="text-slate-600">Track</span>
                            </label>
                          </td>
                          <td />
                        </tr>
                      ));
                    })()}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <Pager />

        {/* Bottom Action Bar */}
        {editing && dirtyCount > 0 && (
          <div className="fixed bottom-0 left-0 right-0 md:left-64 z-[60]">
            <div className="mx-auto max-w-6xl px-4 pb-4">
              <div className="rounded-2xl border bg-white shadow-lg p-3 flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-medium">{dirtyCount}</span> change{dirtyCount > 1 ? 's' : ''} pending
                </div>
                <div className="flex gap-2">
                  <button className="rounded px-4 py-2 border hover:bg-slate-50" onClick={cancelEdit}>Discard</button>
                  <button className="rounded px-4 py-2 bg-slate-900 text-white hover:opacity-90" onClick={saveAll}>Save All</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* toasts */}
        <div className="fixed top-3 right-3 space-y-2 z-50">
          {toasts.map(t => (
            <div key={t.id} className={`rounded-lg px-3 py-2 shadow text-white ${t.tone === 'success' ? 'bg-green-600' : 'bg-rose-600'}`}>
              {t.text}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
