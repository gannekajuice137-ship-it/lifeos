"use client";

import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/AppShell";
import PageWrapper from "@/components/PageWrapper";
import { useAuthCrypto } from "@/lib/context";
import { fetchPeople, createPerson, updatePerson, deletePerson } from "@/lib/db";
import { PlusIcon, TrashIcon, CloseIcon, ClockIcon, PeopleIcon, CheckIcon } from "@/components/icons";
import type { PersonPayload } from "@/lib/types";

interface PersonItem {
  id: string;
  last_contacted: string | null;
  payload: PersonPayload;
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "Never";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - now.getTime()) / 864e5);
}

export default function PeoplePage() {
  const { user, passphrase, cryptoSalt } = useAuthCrypto();
  const [people, setPeople] = useState<PersonItem[]>([]);
  const [editing, setEditing] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<PersonItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [notes, setNotes] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderNote, setReminderNote] = useState("");
  const [tags, setTags] = useState("");

  const loadData = useCallback(async () => {
    if (!user || !passphrase || !cryptoSalt) return;
    try {
      const data = await fetchPeople(user.id, passphrase, cryptoSalt);
      setPeople(data);
    } catch (err) {
      console.error("Failed to load people:", err);
    } finally {
      setLoading(false);
    }
  }, [user, passphrase, cryptoSalt]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => loadData());
    return () => cancelAnimationFrame(raf);
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;

    const payload: PersonPayload = {
      name,
      relationship,
      notes,
      next_reminder: reminderDate ? { date: reminderDate, note: reminderNote } : null,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      avatar: null,
    };

    await createPerson(user.id, passphrase, cryptoSalt, payload);
    resetForm();
    loadData();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedPerson) return;

    const payload: PersonPayload = {
      name,
      relationship,
      notes,
      next_reminder: reminderDate ? { date: reminderDate, note: reminderNote } : null,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      avatar: selectedPerson.payload.avatar,
    };

    await updatePerson(user.id, selectedPerson.id, passphrase, cryptoSalt, { payload });
    setEditing(false);
    setSelectedPerson(null);
    resetForm();
    loadData();
  };

  const handleDelete = async (personId: string) => {
    if (!user) return;
    await deletePerson(user.id, personId);
    if (selectedPerson?.id === personId) {
      setSelectedPerson(null);
    }
    loadData();
  };

  const handleMarkContacted = async (person: PersonItem) => {
    if (!user) return;
    await updatePerson(user.id, person.id, passphrase, cryptoSalt, {
      last_contacted: today(),
    });
    loadData();
  };

  const handleSelectPerson = (person: PersonItem) => {
    setSelectedPerson(person);
    setName(person.payload.name);
    setRelationship(person.payload.relationship);
    setNotes(person.payload.notes);
    setReminderDate(person.payload.next_reminder?.date || "");
    setReminderNote(person.payload.next_reminder?.note || "");
    setTags(person.payload.tags.join(", "));
    setEditing(true);
  };

  const handleNewPerson = () => {
    setSelectedPerson(null);
    resetForm();
    setEditing(true);
  };

  const resetForm = () => {
    setName("");
    setRelationship("");
    setNotes("");
    setReminderDate("");
    setReminderNote("");
    setTags("");
  };

  // Sort by last contacted (null = never = first)
  const sortedPeople = [...people].sort((a, b) => {
    if (!a.last_contacted && !b.last_contacted) return 0;
    if (!a.last_contacted) return -1;
    if (!b.last_contacted) return 1;
    return a.last_contacted.localeCompare(b.last_contacted);
  });

  // Upcoming reminders
  const upcomingReminders = people.filter(
    (p) => p.payload.next_reminder && daysUntil(p.payload.next_reminder.date) <= 7
  );

  if (loading) {
    return (
      <PageWrapper>
        <AppShell>
          <div style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--text-secondary)" }}>
            Loading people...
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
            <div className="module-eyebrow">People</div>
            <h1 className="module-title">Relationships</h1>
            <p className="module-sub">
              {people.length} contacts · {upcomingReminders.length} reminders due
            </p>
          </header>

          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-value">{people.length}</div>
              <div className="stat-label">Contacts</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{upcomingReminders.length}</div>
              <div className="stat-label">Reminders due</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{people.filter((p) => !p.last_contacted).length}</div>
              <div className="stat-label">Never contacted</div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-4)" }}>
            <button className="btn btn-primary" onClick={handleNewPerson}>
              <PlusIcon className="icon" />
              Add Person
            </button>
          </div>

          {/* Upcoming reminders */}
          {upcomingReminders.length > 0 && (
            <div className="card" style={{ marginBottom: "var(--space-4)" }}>
              <h3 className="section-title" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <ClockIcon className="icon" /> Upcoming Reminders
              </h3>
              {upcomingReminders.map((person) => {
                const days = daysUntil(person.payload.next_reminder!.date);
                return (
                  <div
                    key={person.id}
                    className="habit-row"
                    style={{ cursor: "pointer" }}
                    onClick={() => handleSelectPerson(person)}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: "var(--text-sm)" }}>{person.payload.name}</div>
                      <div className="caption">{person.payload.next_reminder!.note}</div>
                    </div>
                    <span className={`badge ${days <= 0 ? "badge-error" : days <= 3 ? "badge-warning" : "badge-accent"}`}>
                      {days <= 0 ? "Overdue" : `${days}d`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add / Edit form */}
          {editing && (
            <div className="card" style={{ marginBottom: "var(--space-4)" }}>
              <div className="card-header">
                <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>
                  {selectedPerson ? "Edit Person" : "Add Person"}
                </h3>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setSelectedPerson(null); }}>
                  <CloseIcon className="icon" />
                </button>
              </div>
              <form onSubmit={selectedPerson ? handleUpdate : handleCreate}>
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input
                    className="input"
                    placeholder="Person's name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Relationship</label>
                  <input
                    className="input"
                    placeholder="e.g. family, friend, colleague"
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Tags (comma-separated)</label>
                  <input
                    className="input"
                    placeholder="e.g. work, mentor"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                  <div className="form-group">
                    <label className="form-label">Reminder Date</label>
                    <input
                      type="date"
                      className="input"
                      value={reminderDate}
                      onChange={(e) => setReminderDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reminder Note</label>
                    <input
                      className="input"
                      placeholder="What to remember"
                      value={reminderNote}
                      onChange={(e) => setReminderNote(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="input"
                    placeholder="Notes about this person..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
                    {selectedPerson ? "Update" : "Add Person"}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => { setEditing(false); setSelectedPerson(null); }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* People list */}
          <div className="card">
            {sortedPeople.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><PeopleIcon /></div>
                <p className="empty-state-title">No people yet</p>
                <p className="empty-state-text">Add your first contact to start tracking</p>
              </div>
            ) : (
              sortedPeople.map((person) => (
                <div
                  key={person.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    padding: "var(--space-3) var(--space-2)",
                    borderBottom: "1px solid var(--separator)",
                  }}
                >
                  {/* Avatar placeholder */}
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "var(--bg-tertiary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 600,
                      fontSize: "var(--text-sm)",
                      color: "var(--text-secondary)",
                      flexShrink: 0,
                    }}
                  >
                    {person.payload.name.charAt(0).toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: "var(--text-sm)" }}>{person.payload.name}</div>
                    <div className="caption" style={{ display: "flex", gap: "var(--space-2)", marginTop: 2, flexWrap: "wrap" }}>
                      {person.payload.relationship && <span>{person.payload.relationship}</span>}
                      {person.payload.relationship && person.last_contacted && <span>·</span>}
                      {person.last_contacted && <span>Last: {formatDate(person.last_contacted)}</span>}
                    </div>
                    {person.payload.tags.length > 0 && (
                      <div style={{ display: "flex", gap: "var(--space-1)", marginTop: "var(--space-1)" }}>
                        {person.payload.tags.map((tag) => (
                          <span key={tag} className="badge badge-accent" style={{ fontSize: "10px" }}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "var(--space-1)" }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleMarkContacted(person)}
                      title="Mark contacted today"
                    >
                      <CheckIcon className="icon" /> Contacted
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleSelectPerson(person)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleDelete(person.id)}
                    >
                      <TrashIcon className="icon" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </AppShell>
    </PageWrapper>
  );
}
