import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from './lib/supabase.ts'
import type { NewTaskInput, Task, TaskUpdate } from './lib/types.ts'
import AuthForm from './components/authform.tsx'
import TaskList from './components/tasklist.tsx'
import FocusMode from './components/focusmode.tsx'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  // Focus session: an ordered queue of task ids plus the index of the
  // current task. The queue lives here (in App) while the timer lives
  // inside FocusMode, so adding tasks or advancing the queue never
  // touches the timer.
  const [focusQueueIds, setFocusQueueIds] = useState<string[] | null>(null)
  const [focusIndex, setFocusIndex] = useState(0)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setUser(data.session?.user ?? null)
      setAuthReady(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const fetchTasks = useCallback(async (userId: string) => {
    setLoadingTasks(true)
    setDataError(null)
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (error) {
      setDataError(error.message)
      setTasks([])
    } else {
      setTasks((data ?? []) as Task[])
    }
    setLoadingTasks(false)
  }, [])

  useEffect(() => {
    if (user) void fetchTasks(user.id)
    else setTasks([])
  }, [user, fetchTasks])

  async function addTask(input: NewTaskInput) {
    if (!user) return
    const { data, error } = await supabase
      .from('tasks')
      .insert({ ...input, user_id: user.id })
      .select()
      .single()
    if (error) throw new Error(error.message)
    if (data) setTasks((prev) => [...prev, data as Task])
  }

  async function updateTask(id: string, update: TaskUpdate) {
    const { data, error } = await supabase
      .from('tasks')
      .update(update)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    if (data) setTasks((prev) => prev.map((t) => (t.id === id ? (data as Task) : t)))
  }

  async function deleteTask(id: string) {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) throw new Error(error.message)
    setTasks((prev) => prev.filter((t) => t.id !== id))
    setFocusQueueIds((prev) => {
      if (!prev) return prev
      const next = prev.filter((qid) => qid !== id)
      return next.length === 0 ? null : next
    })
  }

  async function toggleTask(task: Task) {
    const done = !task.done
    await updateTask(task.id, {
      done,
      completed_at: done ? new Date().toISOString() : null,
    })
  }

  async function clearDone() {
    if (!user) return
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('user_id', user.id)
      .eq('done', true)
    if (error) throw new Error(error.message)
    setTasks((prev) => prev.filter((t) => !t.done))
  }

  /** Start a focus session for the given tasks, in the order given. */
  function startFocusSession(selected: Task[]) {
    if (selected.length === 0) return
    setFocusQueueIds(selected.map((t) => t.id))
    setFocusIndex(0)
  }

  /** Append a task to the running session's queue. Never touches the timer. */
  function addToFocusQueue(id: string) {
    if (!focusQueueIds || focusQueueIds.includes(id)) return
    const nextIds = [...focusQueueIds, id]
    setFocusQueueIds(nextIds)
    // If the session was already complete, jump straight to the new task.
    const allDone = focusQueueIds.every((qid) => tasks.find((t) => t.id === qid)?.done)
    if (allDone) setFocusIndex(nextIds.length - 1)
  }

  /**
   * Mark the current task done and advance to the next undone task in the
   * queue — without stopping or resetting the timer (the timer lives in
   * FocusMode and is untouched by this). When nothing is left undone, the
   * index runs past the end of the queue and FocusMode shows the
   * session-complete state.
   */
  async function markDoneFromFocus(id: string) {
    await updateTask(id, { done: true, completed_at: new Date().toISOString() })
    if (!focusQueueIds) return
    const updated = tasks.map((t) => (t.id === id ? { ...t, done: true } : t))
    const isUndone = (qid: string) => {
      const t = updated.find((u) => u.id === qid)
      return !!t && !t.done
    }
    const after = focusQueueIds.findIndex((qid, i) => i > focusIndex && isUndone(qid))
    if (after !== -1) {
      setFocusIndex(after)
      return
    }
    const earlier = focusQueueIds.findIndex((qid) => isUndone(qid))
    setFocusIndex(earlier === -1 ? focusQueueIds.length : earlier)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setFocusQueueIds(null)
  }

  const openTasks = tasks.filter((t) => !t.done)
  const openWork = openTasks.filter((t) => t.kind === 'work').length
  const openPersonal = openTasks.filter((t) => t.kind === 'personal').length

  // Resolve the session queue to live task objects (titles/done status stay
  // current if a task changes while the session runs).
  const focusQueueTasks = focusQueueIds
    ? focusQueueIds
        .map((id) => tasks.find((t) => t.id === id))
        .filter((t): t is Task => !!t)
    : []

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Loading…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {!supabaseConfigured && (
        <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-300">
          Supabase isn&apos;t configured yet. Add{' '}
          <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
          <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> to your{' '}
          <code className="font-mono">.env</code> file (and to Netlify&apos;s environment
          variables), then restart.
        </div>
      )}

      {!user ? (
        <AuthForm />
      ) : (
        <div className="mx-auto w-full max-w-3xl px-4 py-6 md:py-10">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-100">
                <span className="text-indigo-400">Focus</span>Flow
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                {openTasks.length} open ({openWork} work · {openPersonal} personal)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="max-w-44 truncate text-xs text-slate-500">{user.email}</span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800"
              >
                Sign out
              </button>
            </div>
          </header>

          {dataError && (
            <p className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              Couldn&apos;t load tasks: {dataError}
            </p>
          )}

          {loadingTasks ? (
            <p className="py-10 text-center text-sm text-slate-400">Loading tasks…</p>
          ) : (
            <>
              {tasks.length === 0 && (
                <div className="mb-6 rounded-3xl border border-indigo-500/30 bg-indigo-500/10 p-5">
                  <h2 className="text-base font-semibold text-indigo-200">
                    Your list is empty — let&apos;s fix that.
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                    Add your first task above. Pick <strong>Work</strong> or{' '}
                    <strong>Personal</strong>, <strong>Today</strong> or{' '}
                    <strong>Later</strong>, and add tags like #PCH to keep things grouped.
                    When you&apos;re ready to work on something, tap{' '}
                    <strong>Focus · 25 min</strong> on a task — or tick several
                    tasks and start one focus session for all of them — to start
                    a Pomodoro timer with lo-fi or classical music.
                  </p>
                </div>
              )}
              <TaskList
                tasks={tasks}
                onAdd={addTask}
                onUpdate={updateTask}
                onDelete={deleteTask}
                onToggle={toggleTask}
                onClearDone={clearDone}
                onStartFocus={startFocusSession}
              />
            </>
          )}

          {focusQueueIds && (
            <FocusMode
              tasks={focusQueueTasks}
              currentIndex={focusIndex}
              openTasks={openTasks}
              onExit={() => setFocusQueueIds(null)}
              onMarkDone={(id) => void markDoneFromFocus(id)}
              onAddTask={addToFocusQueue}
              onSelectTask={setFocusIndex}
            />
          )}
        </div>
      )}
    </div>
  )
}
