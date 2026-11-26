import { useState } from 'react'
import type { FormEvent } from 'react'
import type { NewTaskInput, Task, TaskKind, TaskSection, TaskUpdate } from '../lib/types.ts'

type StatusFilter = 'all' | 'open' | 'done'
type KindFilter = 'all' | TaskKind

interface TaskListProps {
  tasks: Task[]
  onAdd: (input: NewTaskInput) => Promise<void>
  onUpdate: (id: string, update: TaskUpdate) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onToggle: (task: Task) => Promise<void>
  onClearDone: () => Promise<void>
  onStartFocus: (tasks: Task[]) => void
}

/** Split freeform tag input ("#PCH, #Paragould" or "PCH Paragould") into tags. */
export function parseTags(input: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input.split(/[\s,]+/)) {
    const tag = raw.replace(/^#+/, '').trim()
    if (tag && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase())
      out.push(tag)
    }
  }
  return out
}

function kindBadge(kind: TaskKind) {
  return kind === 'work'
    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
}

export default function TaskList({
  tasks,
  onAdd,
  onUpdate,
  onDelete,
  onToggle,
  onClearDone,
  onStartFocus,
}: TaskListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [showDone, setShowDone] = useState(true)
  const [editing, setEditing] = useState<Task | null>(null)
  const [busy, setBusy] = useState(false)

  // Multi-task focus selection: tick open tasks, then start one session.
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Add form state
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<TaskKind>('work')
  const [section, setSection] = useState<TaskSection>('today')
  const [tagsInput, setTagsInput] = useState('')
  const [notes, setNotes] = useState('')

  function matches(task: Task): boolean {
    if (statusFilter === 'open' && task.done) return false
    if (statusFilter === 'done' && !task.done) return false
    if (kindFilter !== 'all' && task.kind !== kindFilter) return false
    return true
  }

  const todayOpen = tasks.filter((t) => t.section === 'today' && !t.done && matches(t))
  const laterOpen = tasks.filter((t) => t.section === 'later' && !t.done && matches(t))
  const completed = tasks.filter((t) => t.done && matches(t))

  // Selected tasks in display order (Today before Later, then oldest first)
  // — this is the order they run in a focus session.
  const selectedTasks = tasks
    .filter((t) => !t.done && selectedIds.includes(t.id))
    .sort((a, b) => {
      if (a.section !== b.section) return a.section === 'today' ? -1 : 1
      return a.created_at.localeCompare(b.created_at)
    })

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function startSelectedFocus() {
    if (selectedTasks.length === 0) return
    onStartFocus(selectedTasks)
    setSelectedIds([])
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setBusy(true)
    try {
      await onAdd({
        title: trimmed,
        notes: notes.trim(),
        kind,
        section,
        tags: parseTags(tagsInput),
      })
      setTitle('')
      setTagsInput('')
      setNotes('')
    } finally {
      setBusy(false)
    }
  }

  async function handleClearDone() {
    if (!completed.length) return
    setBusy(true)
    try {
      await onClearDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Add task */}
      <form
        onSubmit={handleAdd}
        className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur md:p-5"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What are you working on?"
          required
          className="w-full rounded-xl border border-slate-700/60 bg-slate-900/70 px-3.5 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-slate-900/70 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setKind('work')}
              className={`rounded-lg px-3 py-1.5 transition ${kind === 'work' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Work
            </button>
            <button
              type="button"
              onClick={() => setKind('personal')}
              className={`rounded-lg px-3 py-1.5 transition ${kind === 'personal' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Personal
            </button>
          </div>
          <div className="flex rounded-xl bg-slate-900/70 p-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setSection('today')}
              className={`rounded-lg px-3 py-1.5 transition ${section === 'today' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSection('later')}
              className={`rounded-lg px-3 py-1.5 transition ${section === 'later' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Later
            </button>
          </div>
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Tags, e.g. #PCH, #Paragould"
            className="min-w-0 flex-1 rounded-xl border border-slate-700/60 bg-slate-900/70 px-3.5 py-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
          />
          <button
            type="submit"
            disabled={busy || !title.trim()}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:opacity-60"
          >
            Add task
          </button>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          className="mt-3 w-full resize-y rounded-xl border border-slate-700/60 bg-slate-900/70 px-3.5 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
        />
      </form>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-slate-900/70 p-1 text-xs font-medium">
          {(['all', 'open', 'done'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={`rounded-lg px-3 py-1.5 capitalize transition ${statusFilter === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex rounded-xl bg-slate-900/70 p-1 text-xs font-medium">
          {(['all', 'work', 'personal'] as KindFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setKindFilter(f)}
              className={`rounded-lg px-3 py-1.5 capitalize transition ${kindFilter === f ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {f === 'all' ? 'Work + Personal' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Multi-select focus bar — appears when tasks are ticked */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-500/40 bg-indigo-600/15 px-4 py-3">
          <span className="text-sm font-medium text-indigo-200">
            {selectedIds.length} task{selectedIds.length === 1 ? '' : 's'} selected for
            focus
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={startSelectedFocus}
              disabled={selectedTasks.length === 0}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-indigo-500 disabled:opacity-60"
            >
              Focus · 25 min
            </button>
          </div>
        </div>
      )}

      {/* Today */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-slate-400">
          Today
        </h2>
        {todayOpen.length === 0 ? (
          <p className="rounded-2xl border border-white/5 bg-slate-900/40 px-4 py-3 text-sm text-slate-500">
            All done here — completed tasks are at the bottom.
          </p>
        ) : (
          <ul className="space-y-2">
            {todayOpen.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onToggle={onToggle}
                onEdit={() => setEditing(t)}
                onDelete={onDelete}
                onStartFocus={onStartFocus}
                selected={selectedIds.includes(t.id)}
                onSelectToggle={toggleSelect}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Later */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-slate-400">
          Later
        </h2>
        {laterOpen.length === 0 ? (
          <p className="rounded-2xl border border-white/5 bg-slate-900/40 px-4 py-3 text-sm text-slate-500">
            All done here — completed tasks are at the bottom.
          </p>
        ) : (
          <ul className="space-y-2">
            {laterOpen.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onToggle={onToggle}
                onEdit={() => setEditing(t)}
                onDelete={onDelete}
                onStartFocus={onStartFocus}
                selected={selectedIds.includes(t.id)}
                onSelectToggle={toggleSelect}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Completed — one section at the very bottom */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
            Completed {completed.length > 0 ? `(${completed.length})` : ''}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              className="rounded-lg border border-white/10 bg-slate-900/60 px-2.5 py-1 text-xs text-slate-300 transition hover:bg-slate-800"
            >
              {showDone ? 'Hide' : 'Show'}
            </button>
            {completed.length > 0 && (
              <button
                type="button"
                onClick={handleClearDone}
                disabled={busy}
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-60"
              >
                Clear done
              </button>
            )}
          </div>
        </div>
        {showDone &&
          (completed.length === 0 ? (
            <p className="rounded-2xl border border-white/5 bg-slate-900/40 px-4 py-3 text-sm text-slate-500">
              Nothing completed yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {completed.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onToggle={onToggle}
                  onEdit={() => setEditing(t)}
                  onDelete={onDelete}
                  onStartFocus={onStartFocus}
                  selected={false}
                  onSelectToggle={toggleSelect}
                />
              ))}
            </ul>
          ))}
      </section>

      {editing && (
        <EditSheet
          task={editing}
          onClose={() => setEditing(null)}
          onSave={async (update) => {
            await onUpdate(editing.id, update)
            setEditing(null)
          }}
          onDelete={async () => {
            await onDelete(editing.id)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
  onStartFocus,
  selected,
  onSelectToggle,
}: {
  task: Task
  onToggle: (task: Task) => Promise<void>
  onEdit: () => void
  onDelete: (id: string) => Promise<void>
  onStartFocus: (tasks: Task[]) => void
  selected: boolean
  onSelectToggle: (id: string) => void
}) {
  return (
    <li className="rounded-2xl border border-white/10 bg-white/5 p-3.5 shadow backdrop-blur">
      <div className="flex items-start gap-3">
        {/* Left controls: "Focus" (add to a focus session) and "Done" (mark
            complete) are separate, labeled pills with a divider between them
            so they can't be mistaken for each other. */}
        <div className="flex shrink-0 items-start gap-2.5">
          {!task.done && (
            <button
              type="button"
              onClick={() => onSelectToggle(task.id)}
              aria-label={
                selected ? 'Remove from focus selection' : 'Select for focus session'
              }
              title={
                selected ? 'Remove from focus selection' : 'Select for focus session'
              }
              className={`mt-0.5 flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium transition ${
                selected
                  ? 'border-indigo-500 bg-indigo-600 text-white'
                  : 'border-slate-600 text-slate-400 hover:border-indigo-400 hover:text-indigo-300'
              }`}
            >
              <span
                className={`flex h-3.5 w-3.5 items-center justify-center rounded border text-[10px] leading-none ${
                  selected ? 'border-white/70 text-white' : 'border-current text-transparent'
                }`}
              >
                ✓
              </span>
              Focus
            </button>
          )}
          {!task.done && (
            <span aria-hidden="true" className="mt-0.5 h-7 w-px shrink-0 bg-white/15" />
          )}
          <button
            type="button"
            onClick={() => void onToggle(task)}
            aria-label={task.done ? 'Mark as not done' : 'Mark as done'}
            className={`mt-0.5 flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium transition ${
              task.done
                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                : 'border-slate-600 text-slate-400 hover:border-emerald-400 hover:text-emerald-300'
            }`}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full border text-[10px] leading-none ${
                task.done
                  ? 'border-emerald-400 bg-emerald-500 text-white'
                  : 'border-current text-transparent'
              }`}
            >
              ✓
            </span>
            Done
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-sm font-medium ${task.done ? 'text-slate-500 line-through' : 'text-slate-100'}`}
            >
              {task.title}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${kindBadge(task.kind)}`}
            >
              {task.kind}
            </span>
            {task.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[11px] font-medium text-indigo-300"
              >
                #{tag}
              </span>
            ))}
          </div>
          {task.notes && (
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-400">
              {task.notes}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center">
          {!task.done && (
            <button
              type="button"
              onClick={() => onStartFocus([task])}
              className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-indigo-500"
            >
              Focus · 25 min
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-white/10 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-300 transition hover:bg-slate-800"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => void onDelete(task.id)}
            aria-label="Delete task"
            className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300 transition hover:bg-rose-500/20"
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  )
}

function EditSheet({
  task,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task
  onClose: () => void
  onSave: (update: TaskUpdate) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes)
  const [kind, setKind] = useState<TaskKind>(task.kind)
  const [section, setSection] = useState<TaskSection>(task.section)
  const [tagsInput, setTagsInput] = useState(task.tags.map((t) => `#${t}`).join(' '))
  const [busy, setBusy] = useState(false)

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    try {
      await onSave({
        title: title.trim(),
        notes: notes.trim(),
        kind,
        section,
        tags: parseTags(tagsInput),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl border border-white/10 bg-slate-900 p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100">Edit task</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg border border-white/10 bg-slate-800 px-2.5 py-1 text-sm text-slate-300 hover:bg-slate-700"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="edit-title" className="mb-1 block text-xs font-semibold text-slate-400">
              Title
            </label>
            <input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-xl bg-slate-950/70 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setKind('work')}
                className={`rounded-lg px-3 py-1.5 transition ${kind === 'work' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Work
              </button>
              <button
                type="button"
                onClick={() => setKind('personal')}
                className={`rounded-lg px-3 py-1.5 transition ${kind === 'personal' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Personal
              </button>
            </div>
            <div className="flex rounded-xl bg-slate-950/70 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setSection('today')}
                className={`rounded-lg px-3 py-1.5 transition ${section === 'today' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setSection('later')}
                className={`rounded-lg px-3 py-1.5 transition ${section === 'later' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Later
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="edit-tags" className="mb-1 block text-xs font-semibold text-slate-400">
              Tags
            </label>
            <input
              id="edit-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="#PCH, #Paragould"
              className="w-full rounded-xl border border-slate-700/60 bg-slate-950/70 px-3.5 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
          <div>
            <label htmlFor="edit-notes" className="mb-1 block text-xs font-semibold text-slate-400">
              Notes
            </label>
            <textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-xl border border-slate-700/60 bg-slate-950/70 px-3.5 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => void onDelete()}
              disabled={busy}
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-60"
            >
              Delete task
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !title.trim()}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:opacity-60"
              >
                Save changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
