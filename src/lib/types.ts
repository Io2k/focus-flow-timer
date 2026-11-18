export type TaskKind = 'work' | 'personal'
export type TaskSection = 'today' | 'later'

export interface Task {
  id: string
  user_id: string
  title: string
  notes: string
  kind: TaskKind
  section: TaskSection
  tags: string[]
  done: boolean
  created_at: string
  completed_at: string | null
}

export interface NewTaskInput {
  title: string
  notes: string
  kind: TaskKind
  section: TaskSection
  tags: string[]
}

export type TaskUpdate = Partial<
  Pick<Task, 'title' | 'notes' | 'kind' | 'section' | 'tags' | 'done' | 'completed_at'>
>
