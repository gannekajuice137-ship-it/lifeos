// Database access layer for all modules
// Handles CRUD operations with encryption/decryption

import { supabase } from "./supabase";
import {
  encryptPayload,
  decryptPayload,
  encryptBytes,
  decryptBytes,
} from "./crypto";
import type {
  Task,
  TaskPayload,
  Habit,
  HabitPayload,
  HabitLog,
  GateTopic,
  GateTopicPayload,
  CfEntryItem,
  CfContestPayload,
  CfProblemPayload,
  Note,
  NotePayload,
  WikiPage,
  WikiPagePayload,
  Person,
  PersonPayload,
} from "./types";

// ============================================================
// Tasks
// ============================================================

export async function fetchTasks(
  userId: string,
  passphrase: string,
  salt: string
): Promise<(Task & { payload: TaskPayload })[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .order("due_date", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return Promise.all(
    (data || []).map(async (row) => ({
      ...row,
      payload: await decryptPayload<TaskPayload>(row.payload_enc, passphrase, salt),
    }))
  );
}

export async function fetchTasksForDate(
  userId: string,
  passphrase: string,
  salt: string,
  date: string
) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .lte("due_date", date)
    .neq("status", "cancelled")
    .order("due_date", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return Promise.all(
    (data || []).map(async (row) => ({
      ...row,
      payload: await decryptPayload<TaskPayload>(row.payload_enc, passphrase, salt),
    }))
  );
}

export async function createTask(
  userId: string,
  passphrase: string,
  salt: string,
  task: { due_date: string; sort_order: number } & TaskPayload
) {
  const { ciphertext } = await encryptPayload(
    {
      title: task.title,
      notes: task.notes,
      priority: task.priority,
      recurring: task.recurring,
      completed_at: null,
    },
    passphrase,
    salt
  );

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      status: "pending",
      due_date: task.due_date,
      sort_order: task.sort_order,
      payload_enc: ciphertext,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTask(
  userId: string,
  taskId: string,
  passphrase: string,
  salt: string,
  updates: {
    status?: string;
    payload?: TaskPayload;
  }
) {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.status) updateData.status = updates.status;
  if (updates.payload) {
    const { ciphertext } = await encryptPayload(updates.payload, passphrase, salt);
    updateData.payload_enc = ciphertext;
  }

  const { error } = await supabase
    .from("tasks")
    .update(updateData)
    .eq("id", taskId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function deleteTask(userId: string, taskId: string) {
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", userId);

  if (error) throw error;
}

// ============================================================
// Habits & Habit Logs
// ============================================================

export async function fetchHabits(
  userId: string,
  passphrase: string,
  salt: string
): Promise<(Habit & { payload: HabitPayload })[]> {
  const { data, error } = await supabase
    .from("habits")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return Promise.all(
    (data || []).map(async (row) => ({
      ...row,
      payload: await decryptPayload<HabitPayload>(row.payload_enc, passphrase, salt),
    }))
  );
}

export async function createHabit(
  userId: string,
  passphrase: string,
  salt: string,
  habit: HabitPayload
) {
  const { ciphertext } = await encryptPayload(habit, passphrase, salt);

  const { data, error } = await supabase
    .from("habits")
    .insert({ user_id: userId, payload_enc: ciphertext })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteHabit(userId: string, habitId: string) {
  const { error } = await supabase
    .from("habits")
    .delete()
    .eq("id", habitId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function fetchHabitLogs(
  userId: string,
  habitId: string,
  startDate?: string,
  endDate?: string
): Promise<HabitLog[]> {
  let query = supabase
    .from("habit_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("habit_id", habitId)
    .order("log_date", { ascending: false });

  if (startDate) query = query.gte("log_date", startDate);
  if (endDate) query = query.lte("log_date", endDate);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function logHabit(
  userId: string,
  habitId: string,
  logDate: string
) {
  // Upsert: check if already logged
  const { data: existing } = await supabase
    .from("habit_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("habit_id", habitId)
    .eq("log_date", logDate)
    .single();

  if (existing) {
    // Unlog (toggle)
    const { error } = await supabase
      .from("habit_logs")
      .delete()
      .eq("id", existing.id);
    if (error) throw error;
    return false; // unlogged
  }

  const { error } = await supabase
    .from("habit_logs")
    .insert({ user_id: userId, habit_id: habitId, log_date: logDate });

  if (error) throw error;
  return true; // logged
}

// ============================================================
// GATE Topics
// ============================================================

export async function fetchGateTopics(
  userId: string,
  passphrase: string,
  salt: string
): Promise<(GateTopic & { payload: GateTopicPayload })[]> {
  const { data, error } = await supabase
    .from("gate_topics")
    .select("*")
    .eq("user_id", userId)
    .order("subject", { ascending: true })
    .order("topic_no", { ascending: true });

  if (error) throw error;

  return Promise.all(
    (data || []).map(async (row) => ({
      ...row,
      payload: await decryptPayload<GateTopicPayload>(
        row.payload_enc,
        passphrase,
        salt
      ),
    }))
  );
}

export async function createGateTopic(
  userId: string,
  passphrase: string,
  salt: string,
  topic: {
    subject: string;
    topic_no: number;
    stage: string;
    next_review: string;
    status: string;
  } & GateTopicPayload
) {
  const { ciphertext } = await encryptPayload(
    {
      topic_name: topic.topic_name,
      notes: topic.notes,
      resources: topic.resources,
      error_book_entries: topic.error_book_entries,
    },
    passphrase,
    salt
  );

  const { data, error } = await supabase
    .from("gate_topics")
    .insert({
      user_id: userId,
      subject: topic.subject,
      topic_no: topic.topic_no,
      stage: topic.stage,
      next_review: topic.next_review,
      weak: false,
      status: topic.status,
      payload_enc: ciphertext,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateGateTopic(
  userId: string,
  topicId: string,
  passphrase: string,
  salt: string,
  updates: {
    stage?: string;
    next_review?: string;
    weak?: boolean;
    status?: string;
    payload?: GateTopicPayload;
  }
) {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.stage !== undefined) updateData.stage = updates.stage;
  if (updates.next_review !== undefined) updateData.next_review = updates.next_review;
  if (updates.weak !== undefined) updateData.weak = updates.weak;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.payload) {
    const { ciphertext } = await encryptPayload(updates.payload, passphrase, salt);
    updateData.payload_enc = ciphertext;
  }

  const { error } = await supabase
    .from("gate_topics")
    .update(updateData)
    .eq("id", topicId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function deleteGateTopic(userId: string, topicId: string) {
  const { error } = await supabase
    .from("gate_topics")
    .delete()
    .eq("id", topicId)
    .eq("user_id", userId);

  if (error) throw error;
}

// ============================================================
// CF Entries
// ============================================================

export async function fetchCfEntries(
  userId: string,
  passphrase: string,
  salt: string
): Promise<CfEntryItem[]> {
  const { data, error } = await supabase
    .from("cf_entries")
    .select("*")
    .eq("user_id", userId)
    .order("entry_date", { ascending: false });

  if (error) throw error;

  // payload shape correlates with entry_type at runtime; cast is honest
  return Promise.all(
    (data || []).map(async (row) => ({
      ...row,
      payload: await decryptPayload<CfContestPayload | CfProblemPayload>(row.payload_enc, passphrase, salt),
    }))
  ) as Promise<CfEntryItem[]>;
}

export async function createCfEntry(
  userId: string,
  passphrase: string,
  salt: string,
  entry: {
    entry_date: string;
    entry_type: string;
  } & (CfContestPayload | CfProblemPayload)
) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { entry_date, entry_type, ...payload } = entry;

  const { ciphertext } = await encryptPayload(payload, passphrase, salt);

  const { data, error } = await supabase
    .from("cf_entries")
    .insert({
      user_id: userId,
      entry_date: entry.entry_date,
      entry_type: entry.entry_type,
      payload_enc: ciphertext,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCfEntry(userId: string, entryId: string) {
  const { error } = await supabase
    .from("cf_entries")
    .delete()
    .eq("id", entryId)
    .eq("user_id", userId);

  if (error) throw error;
}

// ============================================================
// Notes
// ============================================================

export async function fetchNotes(
  userId: string,
  passphrase: string,
  salt: string
): Promise<(Note & { payload: NotePayload })[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .order("entry_date", { ascending: false });

  if (error) throw error;

  return Promise.all(
    (data || []).map(async (row) => ({
      ...row,
      payload: await decryptPayload<NotePayload>(row.payload_enc, passphrase, salt),
    }))
  );
}

export async function upsertNote(
  userId: string,
  passphrase: string,
  salt: string,
  entryDate: string,
  payload: NotePayload
) {
  const { ciphertext } = await encryptPayload(payload, passphrase, salt);

  const { data, error } = await supabase
    .from("notes")
    .upsert(
      {
        user_id: userId,
        entry_date: entryDate,
        payload_enc: ciphertext,
      },
      { onConflict: "user_id,entry_date" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteNote(userId: string, noteId: string) {
  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", noteId)
    .eq("user_id", userId);

  if (error) throw error;
}

// ============================================================
// Wiki Pages
// ============================================================

export async function fetchWikiPages(
  userId: string,
  passphrase: string,
  salt: string
): Promise<(WikiPage & { payload: WikiPagePayload })[]> {
  const { data, error } = await supabase
    .from("wiki_pages")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return Promise.all(
    (data || []).map(async (row) => ({
      ...row,
      payload: await decryptPayload<WikiPagePayload>(row.payload_enc, passphrase, salt),
    }))
  );
}

export async function createWikiPage(
  userId: string,
  passphrase: string,
  salt: string,
  page: { slug: string; category: string } & WikiPagePayload
) {
  const { ciphertext } = await encryptPayload(
    {
      title: page.title,
      content: page.content,
      images: page.images,
      tags: page.tags,
    },
    passphrase,
    salt
  );

  const { data, error } = await supabase
    .from("wiki_pages")
    .insert({
      user_id: userId,
      slug: page.slug,
      category: page.category,
      payload_enc: ciphertext,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateWikiPage(
  userId: string,
  pageId: string,
  passphrase: string,
  salt: string,
  updates: { slug?: string; category?: string; payload?: WikiPagePayload }
) {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.slug) updateData.slug = updates.slug;
  if (updates.category) updateData.category = updates.category;
  if (updates.payload) {
    const { ciphertext } = await encryptPayload(updates.payload, passphrase, salt);
    updateData.payload_enc = ciphertext;
  }

  const { error } = await supabase
    .from("wiki_pages")
    .update(updateData)
    .eq("id", pageId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function deleteWikiPage(userId: string, pageId: string) {
  const { error } = await supabase
    .from("wiki_pages")
    .delete()
    .eq("id", pageId)
    .eq("user_id", userId);

  if (error) throw error;
}

// ============================================================
// People
// ============================================================

export async function fetchPeople(
  userId: string,
  passphrase: string,
  salt: string
): Promise<(Person & { payload: PersonPayload })[]> {
  const { data, error } = await supabase
    .from("people")
    .select("*")
    .eq("user_id", userId)
    .order("last_contacted", { ascending: false, nullsFirst: true });

  if (error) throw error;

  return Promise.all(
    (data || []).map(async (row) => ({
      ...row,
      payload: await decryptPayload<PersonPayload>(row.payload_enc, passphrase, salt),
    }))
  );
}

export async function createPerson(
  userId: string,
  passphrase: string,
  salt: string,
  payload: PersonPayload
) {
  const { ciphertext } = await encryptPayload(payload, passphrase, salt);

  const { data, error } = await supabase
    .from("people")
    .insert({
      user_id: userId,
      last_contacted: null,
      payload_enc: ciphertext,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePerson(
  userId: string,
  personId: string,
  passphrase: string,
  salt: string,
  updates: { last_contacted?: string; payload?: PersonPayload }
) {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.last_contacted !== undefined)
    updateData.last_contacted = updates.last_contacted;
  if (updates.payload) {
    const { ciphertext } = await encryptPayload(updates.payload, passphrase, salt);
    updateData.payload_enc = ciphertext;
  }

  const { error } = await supabase
    .from("people")
    .update(updateData)
    .eq("id", personId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function deletePerson(userId: string, personId: string) {
  const { error } = await supabase
    .from("people")
    .delete()
    .eq("id", personId)
    .eq("user_id", userId);

  if (error) throw error;
}

// ============================================================
// Crypto Meta
// ============================================================

export async function fetchCryptoMeta(userId: string) {
  const { data, error } = await supabase
    .from("crypto_meta")
    .select("salt")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function saveCryptoMeta(userId: string, salt: string) {
  const { error } = await supabase
    .from("crypto_meta")
    .insert({ user_id: userId, salt });

  if (error) throw error;
}

// ============================================================
// Storage (images)
// ============================================================

export async function uploadEncryptedImage(
  userId: string,
  passphrase: string,
  salt: string,
  file: File
): Promise<{ path: string; mime: string }> {
  // Downscale to max 2000px
  const canvas = document.createElement("canvas");
  const img = await createImageBitmap(file);
  const maxDim = 2000;
  let { width, height } = img;

  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);

  // Convert to JPEG
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.8);
  });

  const arrayBuffer = await blob.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);

  // Encrypt
  const saltBytes = new Uint8Array(
    atob(salt)
      .split("")
      .map((c) => c.charCodeAt(0))
  );
  const encrypted = await encryptBytes(uint8, passphrase, saltBytes);

  const filename = `${crypto.randomUUID()}.enc`;
  const path = `${userId}/${filename}`;

  const { error } = await supabase.storage
    .from("lifeos")
    .upload(path, encrypted, {
      contentType: "application/octet-stream",
    });

  if (error) throw error;

  return { path, mime: "image/jpeg" };
}

export async function getDecryptedImageUrl(
  userId: string,
  passphrase: string,
  salt: string,
  imagePath: string
): Promise<string> {
  // Download ciphertext
  const { data, error } = await supabase.storage
    .from("lifeos")
    .download(imagePath);

  if (error) throw error;

  const arrayBuffer = await data.arrayBuffer();
  const encrypted = new Uint8Array(arrayBuffer);

  // Decrypt
  const decrypted = await decryptBytes(encrypted, passphrase, salt);

  // Create blob URL
  const blob = new Blob([decrypted], { type: "image/jpeg" });
  return URL.createObjectURL(blob);
}

export async function deleteEncryptedImage(imagePath: string) {
  const { error } = await supabase.storage
    .from("lifeos")
    .remove([imagePath]);

  if (error) throw error;
}
