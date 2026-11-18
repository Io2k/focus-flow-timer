# FocusFlow — To Do list + Pomodoro focus timer

A standalone web app: a to-do list (Work/Personal, Today/Later, tags, notes)
with a full-screen Pomodoro focus mode and direct-stream focus music.
Replaces the single-page timer previously deployed at
focus-flow-timer.netlify.app.

Stack: Vite + React + TypeScript + Tailwind CSS, with a Supabase backend
(Postgres + Auth, email/password). Single-user app — your tasks are private
to your account.

## What it does

- **Tasks:** add (title, Work/Personal picker, Today/Later picker, freeform
  tags like `#PCH`, notes), edit in a sheet, delete, check off.
- **Order:** Today open tasks first, Later open tasks directly beneath them,
  then one Completed section at the very bottom (collapsible, with
  "Clear done"). A section that is fully done reads "All done here —
  completed tasks are at the bottom".
- **Header:** open counts, e.g. `3 open (3 work · 0 personal)`.
- **Filters:** All / Open / Done and Work / Personal (both apply).
- **Focus mode:** every open task has a **Focus · 25 min** button. It opens a
  full-screen view and auto-starts a 25-minute Pomodoro (15 / 25 / 50 min
  pills, Pause/Reset, progress ring, a 5-minute break when the timer
  finishes, and a **Mark done** button right from focus mode).
- **Multi-task sessions:** tick the checkbox on several open tasks and tap
  **Focus · 25 min** to run one session through all of them. Focus mode
  shows the session queue with the current task highlighted — **Mark done**
  moves to the next task without stopping or resetting the timer, and you
  can tap any upcoming task to jump to it. While the timer is running, tap
  **+ Add a task** in the session panel to add more tasks to the queue; the
  timer and music are untouched. When the last task is done the session
  shows a session-complete state (the timer keeps running — add more tasks
  or exit). A single task still works exactly as before: a queue of one.
- **Focus music:** six live stations plus Silence, played as direct audio
  streams through a plain `<audio>` element — no YouTube embeds, no Spotify,
  no sign-in. Lo-fi: Lofi Chill Beats, Ambient Deep Focus, Chillhop Radio.
  Classical: Radio Swiss Classic, France Musique, Classical 24. Play/pause,
  mute, and volume controls; if a station fails, the app says so and tells
  you to pick another one instead of failing silently. The music section
  starts collapsed (timer front and center) and switching stations never
  stops the timer.

## Setup

### 1. Supabase project

1. Create a project at https://supabase.com/dashboard (free tier is fine).
2. In the Supabase dashboard, open **SQL Editor** and run the migration:
   `supabase/migrations/001_focusflow.sql`. This creates the `tasks` table
   with Row Level Security so a signed-in user can only see their own rows.
3. Under **Authentication → Providers → Email**, make sure Email is enabled.
   - If you want sign-up to work without a confirmation email, turn **off**
     "Confirm email" (under Authentication → Settings). Otherwise new users
     must click the confirmation link in their inbox before signing in.
4. Copy the project URL and anon key from **Settings → API**.

### 2. Local run

```bash
cp .env.example .env
# edit .env with your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

### 3. Deploy to Netlify

1. Push this folder to a GitHub repo.
2. In Netlify, **Add new site → Import an existing project**, pick the repo.
3. Build settings are already in `netlify.toml` (build command
   `npm run build`, publish directory `dist`). Netlify should pick them up
   automatically.
4. Under **Site settings → Environment variables**, add:
   - `VITE_SUPABASE_URL` — your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` — your Supabase anon key
5. Deploy. Then sign up in the app with your email and password.

## Notes

- Filenames are all lowercase — capitalized filenames break the Netlify build.
- The app starts empty (no seeded tasks). Your data lives in Supabase, so
  signing in from any device shows the same list.
- Focus music streams are third-party live radio streams; if one ever stops
  responding, pick another station. Stream URLs live in
  `src/lib/stations.ts`.
