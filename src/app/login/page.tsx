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
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({} as any));
      setErr(j.error || 'Login failed');
      return;
    }
    router.replace(next);
  }

  return (
    <main className="min-h-[100dvh] grid place-items-center px-4 py-8 bg-slate-50">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <h1 className="text-2xl font-semibold">Inventory Login</h1>
          <p className="text-slate-500 text-sm mt-1">Enter the admin password to continue.</p>
        </div>

        <input
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          className="w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring focus:ring-slate-200"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {err ? <div className="text-red-600 text-sm">{err}</div> : null}

        <button
          className="w-full rounded-lg bg-slate-900 text-white py-2.5 hover:opacity-90"
          type="submit"
        >
          Sign in
        </button>
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
