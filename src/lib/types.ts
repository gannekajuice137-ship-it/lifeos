// Database types matching the PRD schema

export interface Task {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string | null;
  status: "pending" | "done" | "cancelled";
  due_date: string;
  sort_order: number;
  payload_enc: string; // encrypted: { title, notes, priority, recurring, completed_at }
}

export interface TaskPayload {
  title: string;
  notes: string;
  priority: "low" | "medium" | "high";
  recurring: string | null;
  completed_at: string | null;
}

export interface Habit {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string | null;
  payload_enc: string; // encrypted: { name, emoji, color, target_days_per_week }
}

export interface HabitPayload {
  name: string;
  emoji: string;
  color: string;
  target_days_per_week: number | null;
}

export interface HabitLog {
  id: string;
  user_id: string;
  created_at: string;
  log_date: string;
  habit_id: string;
  payload_enc: string | null; // encrypted: { note } or null
}

export interface GateTopic {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string | null;
  subject: string;
  topic_no: number;
  stage: string; // S0-S6
  next_review: string;
  weak: boolean;
  status: "not_started" | "in_progress" | "done";
  payload_enc: string; // encrypted: { topic_name, notes, resources, error_book_entries }
}

export interface GateTopicPayload {
  topic_name: string;
  notes: string;
  resources: string;
  error_book_entries: Array<{ date: string; entry: string }>;
}

export interface CfEntry {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string | null;
  entry_date: string;
  entry_type: "rating" | "problem" | "contest";
  payload_enc: string;
}

export interface CfEntryBase {
  id: string;
  entry_date: string;
}

export interface CfContestEntry extends CfEntryBase {
  entry_type: "rating" | "contest";
  payload: CfContestPayload;
}

export interface CfProblemEntry extends CfEntryBase {
  entry_type: "problem";
  payload: CfProblemPayload;
}

export type CfEntryItem = CfContestEntry | CfProblemEntry;

export interface CfContestPayload {
  contest_name: string;
  rating: number;
  rank: number;
  delta: number;
}

export interface CfProblemPayload {
  problem_name: string;
  problem_link?: string;
  difficulty?: number;
  problem_rating?: number; // legacy field — pre-difficulty entries
  time_taken?: number; // minutes
  tags: string[];
  mistakes?: string;
  verdict: "solved" | "upsolved";
  notes: string;
}

export interface Note {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string | null;
  entry_date: string;
  payload_enc: string; // encrypted: { title, content, images, mood }
}

export interface NotePayload {
  title: string;
  content: string;
  images: Array<{ path: string; mime: string; caption?: string }>;
  mood: number | null;
}

export interface WikiPage {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string | null;
  slug: string;
  category: "short-notes" | "error-book" | "general";
  payload_enc: string; // encrypted: { title, content, images, tags }
}

export interface WikiPagePayload {
  title: string;
  content: string;
  images: Array<{ path: string; mime: string; caption?: string }>;
  tags: string[];
}

export interface Person {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string | null;
  last_contacted: string | null;
  payload_enc: string; // encrypted: { name, relationship, notes, next_reminder, tags, avatar }
}

export interface PersonPayload {
  name: string;
  relationship: string;
  notes: string;
  next_reminder: { date: string; note: string } | null;
  tags: string[];
  avatar: string | null; // storage ref
}

export interface CryptoMeta {
  user_id: string;
  salt: string;
  created_at: string;
}

export type TableName =
  | "tasks"
  | "habits"
  | "habit_logs"
  | "gate_topics"
  | "cf_entries"
  | "notes"
  | "wiki_pages"
  | "people"
  | "crypto_meta";
