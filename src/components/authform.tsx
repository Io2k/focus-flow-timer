import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase.ts'

export default function AuthForm() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({ email, password })
        if (err) throw err
        // If email confirmation is on, Supabase returns a user with no
        // session — tell the user to check their inbox.
        if (data.session) {
          setNotice('Account created — you are signed in.')
        } else {
          setNotice(
            'Account created. Check your email for a confirmation link, then sign in.',
          )
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong signing in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4 py-10">
      <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur md:p-8">
        <div className="mb-6 text-center">
          <div className="text-3xl font-bold tracking-tight">
            <span className="text-indigo-400">Focus</span>Flow
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Your to-do list, with a focus timer that keeps you on task.
          </p>
        </div>

        <div className="mb-5 flex rounded-xl bg-slate-900/70 p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => {
              setMode('signin')
              setError(null)
              setNotice(null)
            }}
            className={`flex-1 rounded-lg px-3 py-2 transition ${
              mode === 'signin' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup')
              setError(null)
              setNotice(null)
            }}
            className={`flex-1 rounded-lg px-3 py-2 transition ${
              mode === 'signup' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="auth-email" className="mb-1 block text-xs font-semibold text-slate-400">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-slate-700/60 bg-slate-900/70 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="mb-1 block text-xs font-semibold text-slate-400">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full rounded-xl border border-slate-700/60 bg-slate-900/70 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:opacity-60"
          >
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs leading-relaxed text-slate-500">
          Single-user app — your tasks are private to your account.
        </p>
      </div>
    </div>
  )
}
