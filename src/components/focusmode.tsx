import { useEffect, useRef, useState } from 'react'
import type { Task } from '../lib/types.ts'
import { SILENCE_ID, STATIONS, stationById } from '../lib/stations.ts'

type Phase = 'focus' | 'break' | 'done'

const BREAK_MINUTES = 5
const RING_RADIUS = 120
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function playChime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 1.2)
  } catch {
    // Audio not available — the timer still works.
  }
}

interface FocusModeProps {
  /** The session queue, in order. Resolved to live task objects by App. */
  tasks: Task[]
  /** Index of the current task in the queue (>= tasks.length = all done). */
  currentIndex: number
  /** All open tasks — candidates to add to the session mid-timer. */
  openTasks: Task[]
  onExit: () => void
  onMarkDone: (id: string) => void
  onAddTask: (id: string) => void
  onSelectTask: (index: number) => void
}

export default function FocusMode({
  tasks,
  currentIndex,
  openTasks,
  onExit,
  onMarkDone,
  onAddTask,
  onSelectTask,
}: FocusModeProps) {
  const [phase, setPhase] = useState<Phase>('focus')
  const [duration, setDuration] = useState(25)
  const [remaining, setRemaining] = useState(25 * 60)
  const [running, setRunning] = useState(true) // auto-starts on open

  // Focus music state — independent of the timer by design: switching
  // stations never touches `running` or `remaining`.
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [stationId, setStationId] = useState<string>(SILENCE_ID)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(0.5)
  const [musicCollapsed, setMusicCollapsed] = useState(true) // starts collapsed
  const [audioError, setAudioError] = useState<string | null>(null)
  const [addPickerOpen, setAddPickerOpen] = useState(false)

  // The current task is the queue item at currentIndex. When the index runs
  // past the end, every queued task is done and the session is complete.
  const task = tasks[currentIndex]
  const sessionComplete = tasks.length === 0 || currentIndex >= tasks.length
  const doneCount = tasks.filter((t) => t.done).length
  // Open tasks not already in this session — candidates to add mid-session.
  const addable = openTasks.filter((t) => !tasks.some((q) => q.id === t.id))

  const station = stationById(stationId)
  const totalSeconds = phase === 'break' ? BREAK_MINUTES * 60 : duration * 60
  const progress = totalSeconds > 0 ? remaining / totalSeconds : 0

  // Timer tick
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [running])

  // Timer finished → chime, then auto-start the 5-minute break (or finish)
  useEffect(() => {
    if (!running || remaining > 0) return
    playChime()
    if (phase === 'focus') {
      setPhase('break')
      setRemaining(BREAK_MINUTES * 60)
      // running stays true — the break starts on its own
    } else if (phase === 'break') {
      setPhase('done')
      setRunning(false)
    }
  }, [remaining, running, phase])

  // Volume / mute applied to the audio element
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.volume = volume
    a.muted = muted
  }, [volume, muted])

  // Station / play state applied to the audio element
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    if (!playing || !station) {
      a.pause()
      return
    }
    if (a.getAttribute('data-station') !== station.id) {
      a.src = station.url
      a.setAttribute('data-station', station.id)
    }
    a.play().catch(() => {
      setAudioError(`“${station.name}” isn't responding right now — pick another station.`)
      setPlaying(false)
    })
  }, [playing, station])

  // Stop the music when focus mode closes
  useEffect(() => {
    const a = audioRef.current
    return () => {
      a?.pause()
    }
  }, [])

  function handleAudioError() {
    setAudioError(
      station
        ? `“${station.name}” isn't responding right now — pick another station.`
        : 'That station isn’t responding right now — pick another station.',
    )
    setPlaying(false)
  }

  function pickStation(id: string) {
    setAudioError(null)
    setStationId(id)
    setMusicCollapsed(true) // picking a station collapses the section again
    setPlaying(id !== SILENCE_ID)
  }

  function changeDuration(minutes: number) {
    setDuration(minutes)
    setPhase('focus')
    setRemaining(minutes * 60)
    setRunning(false)
  }

  function resetTimer() {
    setRemaining(phase === 'break' ? BREAK_MINUTES * 60 : duration * 60)
    setRunning(false)
  }

  function backToFocus() {
    setPhase('focus')
    setRemaining(duration * 60)
    setRunning(false)
  }

  const phaseLabel =
    phase === 'focus'
      ? 'Deep Focus Session'
      : phase === 'break'
        ? 'Short Break — 5 minutes'
        : 'Session complete'

  const ringColor = phase === 'focus' ? '#6366f1' : phase === 'break' ? '#10b981' : '#f59e0b'

  const lofiStations = STATIONS.filter((s) => s.genre === 'lofi')
  const classicalStations = STATIONS.filter((s) => s.genre === 'classical')

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950">
      {/* The audio element lives here, outside the collapsible music section,
          so collapsing/expanding never remounts it and never stops playback. */}
      <audio ref={audioRef} preload="none" onError={handleAudioError} className="hidden" />

      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center px-4 py-8">
        <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur md:p-8">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {task ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
                    Focusing on · Task {currentIndex + 1} of {tasks.length}
                  </p>
                  <h2 className="mt-1 truncate text-xl font-bold text-slate-100">
                    {task.title}
                  </h2>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="rounded-full border border-indigo-500/30 bg-indigo-500/20 px-2 py-0.5 text-[11px] font-medium capitalize text-indigo-300">
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
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
                    Session complete
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-100">
                    All {tasks.length} task{tasks.length === 1 ? '' : 's'} done — nice
                    work.
                  </h2>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={onExit}
              aria-label="Exit focus mode"
              className="shrink-0 rounded-lg border border-white/10 bg-slate-800 px-2.5 py-1.5 text-sm text-slate-300 transition hover:bg-slate-700"
            >
              ✕ Exit
            </button>
          </div>

          {/* Timer ring */}
          <div className="relative mx-auto my-6 flex h-64 w-64 items-center justify-center md:h-80 md:w-80">
            <svg className="h-full w-full">
              <circle
                className="text-slate-800/60"
                strokeWidth={8}
                stroke="currentColor"
                fill="transparent"
                r={RING_RADIUS}
                cx="50%"
                cy="50%"
              />
              <circle
                strokeWidth={8}
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE - progress * RING_CIRCUMFERENCE}
                strokeLinecap="round"
                stroke={ringColor}
                fill="transparent"
                r={RING_RADIUS}
                cx="50%"
                cy="50%"
                style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.35s' }}
              />
            </svg>
            <div className="absolute flex flex-col items-center text-center">
              <span className="font-mono text-6xl font-bold tracking-tighter text-slate-100 md:text-7xl">
                {formatTime(remaining)}
              </span>
              <span className="mt-2 text-xs font-semibold uppercase tracking-widest text-indigo-400">
                {phaseLabel}
              </span>
              <span className="mt-1 text-xs text-slate-400">
                {running ? 'Focusing…' : phase === 'done' ? 'Nice work.' : 'Paused'}
              </span>
            </div>
          </div>

          {/* Duration pills */}
          <div className="mx-auto mb-5 flex w-full max-w-xs rounded-2xl bg-slate-900/60 p-1.5 text-sm font-medium">
            {[15, 25, 50].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => changeDuration(m)}
                disabled={phase === 'break'}
                className={`flex-1 rounded-xl py-2 transition ${
                  duration === m && phase !== 'break'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white'
                } disabled:opacity-40`}
              >
                {m} min
              </button>
            ))}
          </div>

          {/* Timer controls */}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={resetTimer}
              className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/20"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => setRunning((v) => !v)}
              disabled={phase === 'done'}
              className="rounded-2xl bg-indigo-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {running ? 'Pause' : 'Start'}
            </button>
            {phase === 'done' ? (
              <button
                type="button"
                onClick={backToFocus}
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/20"
              >
                Another focus
              </button>
            ) : task ? (
              <button
                type="button"
                onClick={() => onMarkDone(task.id)}
                className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500"
              >
                ✓ Mark done
              </button>
            ) : (
              <span className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300">
                ✓ All done
              </span>
            )}
          </div>

          {/* Session tasks — the queue, with an add-mid-session picker.
              Everything here only touches the queue; the timer and the
              music above/below are fully independent. */}
          <div className="mt-7 rounded-3xl border border-white/10 bg-slate-900/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Session tasks · {doneCount}/{tasks.length} done
              </p>
              <button
                type="button"
                onClick={() => setAddPickerOpen((v) => !v)}
                aria-expanded={addPickerOpen}
                className="rounded-lg border border-white/10 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700"
              >
                {addPickerOpen ? 'Hide' : '+ Add a task'}
              </button>
            </div>

            {tasks.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">No tasks in this session.</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {tasks.map((q, i) => {
                  const isCurrent = i === currentIndex && !q.done
                  const isDone = q.done
                  return (
                    <li key={q.id}>
                      <button
                        type="button"
                        disabled={isDone || isCurrent}
                        onClick={() => onSelectTask(i)}
                        title={
                          isDone
                            ? 'Done'
                            : isCurrent
                              ? 'Current task'
                              : 'Jump to this task'
                        }
                        className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition ${
                          isCurrent
                            ? 'border-indigo-500 bg-indigo-600/20 text-indigo-100'
                            : isDone
                              ? 'border-white/5 bg-slate-900/40 text-slate-500'
                              : 'border-white/10 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                            isDone
                              ? 'border-emerald-500 bg-emerald-500 text-white'
                              : isCurrent
                                ? 'border-indigo-400 bg-indigo-600 text-white'
                                : 'border-slate-500 text-transparent'
                          }`}
                        >
                          {isDone ? '✓' : isCurrent ? '▶' : ''}
                        </span>
                        <span
                          className={`min-w-0 flex-1 truncate ${isDone ? 'line-through' : ''}`}
                        >
                          {q.title}
                        </span>
                        {isCurrent && (
                          <span className="shrink-0 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                            Now
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            {sessionComplete && (
              <p className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                Session complete — every task in the queue is done. The timer
                keeps running; add more tasks below or exit when you&apos;re
                ready.
              </p>
            )}

            {addPickerOpen && (
              <div className="mt-3 border-t border-white/10 pt-3">
                {addable.length === 0 ? (
                  <p className="text-sm text-slate-400">No other open tasks to add.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {addable.map((t) => (
                      <li key={t.id} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-300">
                          {t.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => onAddTask(t.id)}
                          className="shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
                        >
                          + Add
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Adding a task never stops or resets the timer.
                </p>
              </div>
            )}
          </div>

          {/* Focus music — collapsible, starts collapsed */}
          <div className="mt-7 rounded-3xl border border-white/10 bg-slate-900/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  Focus music
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-slate-200">
                  {station ? station.name : 'Silence'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (station) setPlaying((v) => !v)
                  }}
                  disabled={!station}
                  aria-label={playing ? 'Pause music' : 'Play music'}
                  className="rounded-lg bg-indigo-600/30 px-3 py-1.5 text-sm text-indigo-200 transition hover:bg-indigo-600/50 disabled:opacity-40"
                >
                  {playing ? '❚❚ Pause' : '▶ Play'}
                </button>
                <button
                  type="button"
                  onClick={() => setMuted((v) => !v)}
                  aria-label={muted ? 'Unmute' : 'Mute'}
                  className="rounded-lg border border-white/10 bg-slate-800 px-2.5 py-1.5 text-sm text-slate-300 transition hover:bg-slate-700"
                >
                  {muted ? 'Muted' : 'Mute'}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  aria-label="Volume"
                  className="w-20 accent-indigo-500 sm:w-24"
                />
                <button
                  type="button"
                  onClick={() => setMusicCollapsed((v) => !v)}
                  aria-expanded={!musicCollapsed}
                  className="rounded-lg border border-white/10 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700"
                >
                  {musicCollapsed ? 'Show stations' : 'Hide stations'}
                </button>
              </div>
            </div>

            {audioError && (
              <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                {audioError}
              </p>
            )}

            {!musicCollapsed && (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Lo-Fi
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {lofiStations.map((s) => (
                      <StationCard
                        key={s.id}
                        name={s.name}
                        blurb={s.blurb}
                        active={stationId === s.id}
                        playing={playing && stationId === s.id}
                        onSelect={() => pickStation(s.id)}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Classical
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {classicalStations.map((s) => (
                      <StationCard
                        key={s.id}
                        name={s.name}
                        blurb={s.blurb}
                        active={stationId === s.id}
                        playing={playing && stationId === s.id}
                        onSelect={() => pickStation(s.id)}
                      />
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => pickStation(SILENCE_ID)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                    stationId === SILENCE_ID
                      ? 'border-indigo-500 bg-indigo-600/20 text-indigo-200'
                      : 'border-white/10 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="font-medium">Silence</span>
                  <span className="block text-xs text-slate-400">No music — just the timer</span>
                </button>
                <p className="text-xs leading-relaxed text-slate-500">
                  Streams play free with no sign-in. Picking a station never stops the timer.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StationCard({
  name,
  blurb,
  active,
  playing,
  onSelect,
}: {
  name: string
  blurb: string
  active: boolean
  playing: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-xl border px-3 py-2.5 text-left transition ${
        active
          ? 'border-indigo-500 bg-indigo-600/20 text-indigo-200'
          : 'border-white/10 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
      }`}
    >
      <span className="flex items-center justify-between gap-2 text-sm font-medium">
        {name}
        {playing && (
          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">
            Playing
          </span>
        )}
      </span>
      <span className="mt-0.5 block text-xs text-slate-400">{blurb}</span>
    </button>
  )
}
