'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';

function LoginInner() {
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next') || '/';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error || 'Login failed');
      return;
    }
    router.replace(next);
  }

  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border p-6 shadow-sm bg-white">
        <h1 className="text-xl font-semibold">Inventory Login</h1>
        <input
          type="password"
          placeholder="Password"
          className="w-full border rounded px-3 py-2"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        {err ? <div className="text-red-600 text-sm">{err}</div> : null}
        <button className="w-full rounded bg-black text-white py-2 hover:opacity-90">Sign in</button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
