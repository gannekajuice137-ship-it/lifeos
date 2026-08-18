"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/AppShell";
import PageWrapper from "@/components/PageWrapper";
import { useAuthCrypto } from "@/lib/context";
import { fetchNotes, upsertNote, deleteNote } from "@/lib/db";
import { PlusIcon, TrashIcon, CloseIcon, CalendarIcon, NotesIcon, MoodIcon } from "@/components/icons";
import type { NotePayload } from "@/lib/types";

interface NoteItem {
  id: string;
  entry_date: string;
  payload: NotePayload;
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const MOOD_LABELS = ["Rough", "Meh", "Okay", "Good", "Great"] as const;
const moodLevel = (idx: number): 1 | 2 | 3 | 4 | 5 => (idx + 1) as 1 | 2 | 3 | 4 | 5;

export default function NotesPage() {
  const { user, passphrase, cryptoSalt } = useAuthCrypto();
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [selectedDate, setSelectedDate] = useState(today());
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!user || !passphrase || !cryptoSalt) return;
    try {
      const data = await fetchNotes(user.id, passphrase, cryptoSalt);
      setNotes(data);

      // Load today's note if it exists
      const todayNote = data.find((note) => note.entry_date === selectedDate);
      if (todayNote) {
        setTitle(todayNote.payload.title);
        setContent(todayNote.payload.content);
        setMood(todayNote?.payload.mood ?? null);
      }
    } catch (err) {
      console.error("Failed to load notes:", err);
    } finally {
      setLoading(false);
    }
  }, [user, passphrase, cryptoSalt, selectedDate]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => loadData());
    return () => cancelAnimationFrame(raf);
  }, [loadData]);

  const handleSave = async () => {
    if (!user) return;

    const payload: NotePayload = {
      title,
      content,
      images: notes.find((n) => n.entry_date === selectedDate)?.payload.images || [],
      mood,
    };

    await upsertNote(user.id, passphrase, cryptoSalt, selectedDate, payload);
    setEditing(false);
    loadData();
  };

  const handleDelete = async () => {
    if (!user) return;
    const note = notes.find((noteItem) => noteItem.entry_date === selectedDate);
    if (note) {
      await deleteNote(user.id, note.id);
      setTitle("");
      setContent("");
      setMood(null);
      loadData();
    }
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    const note = notes.find((n) => n.entry_date === date);
    if (note) {
      setTitle(note.payload.title);
      setContent(note.payload.content);
      setMood(note.payload.mood);
    } else {
      setTitle("");
      setContent("");
      setMood(null);
    }
    setEditing(false);
  };

  const currentNote = notes.find((n) => n.entry_date === selectedDate);

  if (loading) {
    return (
      <PageWrapper>
        <AppShell>
          <div style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--text-secondary)" }}>
            Loading notes...
          </div>
        </AppShell>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <AppShell>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <header className="module-header">
            <div className="module-eyebrow">Notes</div>
            <h1 className="module-title">Daily Journal</h1>
            <p className="module-sub">{notes.length} entries · {formatDate(selectedDate)}</p>
          </header>

          {/* Date navigation */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-6)" }}>
            <input
              type="date"
              className="input"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              style={{ width: "auto" }}
            />
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleDateChange(today())}
            >
              <CalendarIcon className="icon" />
              Today
            </button>
            <span style={{ flex: 1 }} />
            {currentNote && !editing && (
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
                  Edit
                </button>
                <button className="btn btn-ghost btn-sm" onClick={handleDelete}>
                  <TrashIcon className="icon" />
                </button>
              </div>
            )}
          </div>

          {/* Note display / edit */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
              <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>
                {formatDate(selectedDate)}
              </h2>
              {mood !== null && <MoodIcon level={moodLevel(mood)} className="mood-current" />}
            </div>

            {editing || !currentNote ? (
              <div>
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input
                    className="input"
                    placeholder="Note title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Mood</label>
                  <div className="mood-row">
                    {MOOD_LABELS.map((label, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={`mood-btn ${mood === idx ? "active" : ""}`}
                        onClick={() => setMood(mood === idx ? null : idx)}
                      >
                        <MoodIcon level={moodLevel(idx)} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Content (Markdown)</label>
                  <textarea
                    className="input"
                    placeholder="Write your note here... (supports Markdown)"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={12}
                    style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}
                  />
                </div>

                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <button className="btn btn-primary" onClick={handleSave}>
                    Save Note
                  </button>
                  {currentNote && (
                    <button className="btn btn-ghost" onClick={() => setEditing(false)}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                {currentNote.payload.title && (
                  <h3 style={{ fontSize: "var(--text-xl)", fontWeight: 600, marginBottom: "var(--space-4)" }}>
                    {currentNote.payload.title}
                  </h3>
                )}
                <div className="markdown-content" style={{ whiteSpace: "pre-wrap" }}>
                  {currentNote.payload.content || (
                    <span style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>
                      No content yet. Click Edit to add a note.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Recent notes list */}
          <div className="card" style={{ marginTop: "var(--space-4)" }}>
            <h3 className="section-title">Recent Notes</h3>
            {notes.length === 0 ? (
              <div className="empty-state" style={{ padding: "var(--space-6)" }}>
                <div className="empty-state-icon"><NotesIcon /></div>
                <p className="empty-state-title">No notes yet</p>
                <p className="empty-state-text">Start writing your first daily note!</p>
              </div>
            ) : (
              notes.slice(0, 10).map((note) => (
                <button
                  key={note.id}
                  className="habit-row"
                  onClick={() => handleDateChange(note.entry_date)}
                  style={{ cursor: "pointer", width: "100%", textAlign: "left", background: "none", border: "none" }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: "var(--text-sm)" }}>
                      {note.payload.title || formatDate(note.entry_date)}
                    </div>
                    <div className="caption" style={{ marginTop: 2 }}>
                      {note.entry_date}
                      {note.payload.mood !== null && ` · ${MOOD_LABELS[note.payload.mood]}`}
                    </div>
                  </div>
                  {note.payload.content && (
                    <div className="caption" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {note.payload.content.substring(0, 60)}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </AppShell>
    </PageWrapper>
  );
}
