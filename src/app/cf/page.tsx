"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import AppShell from "@/components/AppShell";
import PageWrapper from "@/components/PageWrapper";
import { useAuthCrypto } from "@/lib/context";
import { fetchCfEntries, createCfEntry, deleteCfEntry } from "@/lib/db";
import {
  PlusIcon,
  TrashIcon,
  CloseIcon,
  TrophyIcon,
  MonitorIcon,
  ChartIcon,
  ExternalLinkIcon,
  ClockIcon,
} from "@/components/icons";
import type { CfEntryItem, CfContestEntry, CfProblemEntry } from "@/lib/types";

const isContest = (e: CfEntryItem): e is CfContestEntry =>
  e.entry_type === "contest" || e.entry_type === "rating";

const isProblem = (e: CfEntryItem): e is CfProblemEntry =>
  e.entry_type === "problem";

const DIFFICULTIES = [800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600];

function today() {
  return new Date().toISOString().split("T")[0];
}

// Simple SVG chart for rating timeline
function RatingChart({ entries }: { entries: CfEntryItem[] }) {
  const ratingEntries = entries
    .filter((e) => e.entry_type === "contest" || e.entry_type === "rating")
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date));

  if (ratingEntries.length < 2) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-8)", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>
        Add at least 2 contest entries to see a rating chart
      </div>
    );
  }

  const width = 600;
  const height = 200;
  const padding = 40;

  const points = ratingEntries.map((_, i) => {
    const x = padding + (i / (ratingEntries.length - 1)) * (width - 2 * padding);
    const y = height / 2; // placeholder
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
      <defs>
        <linearGradient id="ratingGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--module-accent, var(--accent))" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--module-accent, var(--accent))" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="var(--module-accent, var(--accent))"
        strokeWidth="2"
      />
      <polyline
        points={`${padding},${height - padding} ${points.join(" ")} ${width - padding},${height - padding}`}
        fill="url(#ratingGrad)"
      />
      {ratingEntries.map((entry, i) => {
        const x = padding + (i / (ratingEntries.length - 1)) * (width - 2 * padding);
        return (
          <circle
            key={entry.id}
            cx={x}
            cy={height / 2}
            r="4"
            fill="var(--module-accent, var(--accent))"
          />
        );
      })}
    </svg>
  );
}

export default function CfPage() {
  const { user, passphrase, cryptoSalt } = useAuthCrypto();
  const [entries, setEntries] = useState<CfEntryItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [entryType, setEntryType] = useState<"contest" | "problem">("contest");
  const [entryDate, setEntryDate] = useState(today());
  const [contestName, setContestName] = useState("");
  const [rating, setRating] = useState("");
  const [rank, setRank] = useState("");
  const [delta, setDelta] = useState("");
  const [problemName, setProblemName] = useState("");
  const [problemLink, setProblemLink] = useState("");
  const [difficulty, setDifficulty] = useState("1200");
  const [timeTaken, setTimeTaken] = useState("");
  const [topics, setTopics] = useState("");
  const [mistakes, setMistakes] = useState("");
  const [verdict, setVerdict] = useState<"solved" | "upsolved">("solved");

  const loadData = useCallback(async () => {
    if (!user || !passphrase || !cryptoSalt) return;
    try {
      const data = await fetchCfEntries(user.id, passphrase, cryptoSalt);
      setEntries(data);
    } catch (err) {
      console.error("Failed to load CF entries:", err);
    } finally {
      setLoading(false);
    }
  }, [user, passphrase, cryptoSalt]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => loadData());
    return () => cancelAnimationFrame(raf);
  }, [loadData]);

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (entryType === "contest") {
      await createCfEntry(user.id, passphrase, cryptoSalt, {
        entry_date: entryDate,
        entry_type: "contest",
        contest_name: contestName,
        rating: parseInt(rating) || 0,
        rank: parseInt(rank) || 0,
        delta: parseInt(delta) || 0,
      });
    } else {
      await createCfEntry(user.id, passphrase, cryptoSalt, {
        entry_date: entryDate,
        entry_type: "problem",
        problem_name: problemName || problemLink,
        problem_link: problemLink,
        difficulty: parseInt(difficulty) || 1200,
        time_taken: timeTaken ? parseInt(timeTaken) : undefined,
        tags: topics
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        mistakes,
        verdict,
        notes: "",
      });
    }

    setShowAdd(false);
    resetForm();
    loadData();
  };

  const resetForm = () => {
    setContestName("");
    setRating("");
    setRank("");
    setDelta("");
    setProblemName("");
    setProblemLink("");
    setDifficulty("1200");
    setTimeTaken("");
    setTopics("");
    setMistakes("");
    setEntryDate(today());
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!user) return;
    await deleteCfEntry(user.id, entryId);
    loadData();
  };

  const contestEntries = entries.filter(isContest);
  const problemEntries = entries.filter(isProblem);

  // Problems grouped by difficulty, for the bottom breakdown
  const difficultyStats = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const e of problemEntries) {
      const d = e.payload.difficulty ?? e.payload.problem_rating;
      if (d) counts[d] = (counts[d] ?? 0) + 1;
    }
    const rows = Object.entries(counts)
      .map(([d, count]) => ({ diff: Number(d), count }))
      .sort((a, b) => a.diff - b.diff);
    const max = Math.max(1, ...rows.map((r) => r.count));
    return rows.map((r) => ({ ...r, max }));
  }, [problemEntries]);

  if (loading) {
    return (
      <PageWrapper>
        <AppShell>
          <div style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--text-secondary)" }}>
            Loading CF tracker...
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
            <div className="module-eyebrow">Codeforces</div>
            <h1 className="module-title">Competitive Tracker</h1>
            <p className="module-sub">
              {entries.length} entries logged · {problemEntries.length} problems solved
            </p>
          </header>

          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-value">{contestEntries.length}</div>
              <div className="stat-label">Contests</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{problemEntries.length}</div>
              <div className="stat-label">Problems solved</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{entries.length}</div>
              <div className="stat-label">Total entries</div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--space-4)" }}>
            <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>
              {showAdd ? <CloseIcon className="icon" /> : <PlusIcon className="icon" />}
              {showAdd ? "Cancel" : "Add Entry"}
            </button>
          </div>

          {/* Rating Chart */}
          <div className="card" style={{ marginBottom: "var(--space-6)" }}>
            <h3 className="section-title">Rating Timeline</h3>
            <RatingChart entries={entries} />
          </div>

          {/* Add form */}
          {showAdd && (
            <div className="card" style={{ marginBottom: "var(--space-4)" }}>
              <form onSubmit={handleAddEntry}>
                <div className="tabs" style={{ marginBottom: "var(--space-4)" }}>
                  <button
                    type="button"
                    className={`tab ${entryType === "contest" ? "active" : ""}`}
                    onClick={() => setEntryType("contest")}
                  >
                    Contest
                  </button>
                  <button
                    type="button"
                    className={`tab ${entryType === "problem" ? "active" : ""}`}
                    onClick={() => setEntryType("problem")}
                  >
                    Problem
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="input"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                  />
                </div>

                {entryType === "contest" ? (
                  <>
                    <div className="form-group">
                      <label className="form-label">Contest Name</label>
                      <input
                        className="input"
                        placeholder="e.g. Codeforces Round #900"
                        value={contestName}
                        onChange={(e) => setContestName(e.target.value)}
                        required
                      />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-3)" }}>
                      <div className="form-group">
                        <label className="form-label">Rating</label>
                        <input
                          className="input"
                          type="number"
                          placeholder="1200"
                          value={rating}
                          onChange={(e) => setRating(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Rank</label>
                        <input
                          className="input"
                          type="number"
                          placeholder="500"
                          value={rank}
                          onChange={(e) => setRank(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Delta</label>
                        <input
                          className="input"
                          type="number"
                          placeholder="+32"
                          value={delta}
                          onChange={(e) => setDelta(e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-group">
                      <label className="form-label">Problem Link</label>
                      <input
                        className="input"
                        type="url"
                        placeholder="https://codeforces.com/problemset/problem/1900/A"
                        value={problemLink}
                        onChange={(e) => setProblemLink(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Problem Name (optional — falls back to link)</label>
                      <input
                        className="input"
                        placeholder="e.g. Sorting by Subsegments"
                        value={problemName}
                        onChange={(e) => setProblemName(e.target.value)}
                      />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                      <div className="form-group">
                        <label className="form-label">Difficulty</label>
                        <select
                          className="select"
                          value={difficulty}
                          onChange={(e) => setDifficulty(e.target.value)}
                        >
                          {DIFFICULTIES.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Time Taken (minutes)</label>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          placeholder="45"
                          value={timeTaken}
                          onChange={(e) => setTimeTaken(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Topics</label>
                      <input
                        className="input"
                        placeholder="e.g. dp, greedy, math"
                        value={topics}
                        onChange={(e) => setTopics(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Mistakes I Made</label>
                      <textarea
                        className="input"
                        placeholder="e.g. missed the edge case, off-by-one, wrong modulo..."
                        value={mistakes}
                        onChange={(e) => setMistakes(e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Verdict</label>
                      <select
                        className="select"
                        value={verdict}
                        onChange={(e) => setVerdict(e.target.value as "solved" | "upsolved")}
                      >
                        <option value="solved">Solved</option>
                        <option value="upsolved">Upsolved</option>
                      </select>
                    </div>
                  </>
                )}

                <button type="submit" className="btn btn-primary">Add Entry</button>
              </form>
            </div>
          )}

          {/* Recent entries */}
          <div className="card">
            <h3 className="section-title">Recent Entries</h3>
            {entries.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><ChartIcon /></div>
                <p className="empty-state-title">No entries yet</p>
                <p className="empty-state-text">Log your first contest or problem</p>
              </div>
            ) : (
              entries.slice(0, 20).map((entry) => {
                return (
                  <div
                    key={entry.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "var(--space-3)",
                      padding: "var(--space-3) 0",
                      borderBottom: "1px solid var(--separator)",
                    }}
                  >
                    <span className={`badge ${isContest(entry) ? "badge-accent" : "badge-success"}`}>
                      {isContest(entry) ? (<><TrophyIcon /> Contest</>) : (<><MonitorIcon /> Problem</>)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isContest(entry) ? (
                        <>
                          <div style={{ fontWeight: 500, fontSize: "var(--text-sm)" }}>
                            {entry.payload.contest_name || "Contest"}
                          </div>
                          <div className="caption" style={{ marginTop: 2 }}>
                            {entry.entry_date}
                            {entry.payload.rating ? ` · Rating ${entry.payload.rating}` : ""}
                            {entry.payload.delta ? ` · ${entry.payload.delta > 0 ? "+" : ""}${entry.payload.delta}` : ""}
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontWeight: 500, fontSize: "var(--text-sm)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            {entry.payload.problem_link ? (
                              <a
                                href={entry.payload.problem_link}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: "var(--text-primary)", display: "inline-flex", alignItems: "center", gap: 4 }}
                              >
                                {entry.payload.problem_name}
                                <ExternalLinkIcon style={{ width: 12, height: 12, color: "var(--text-tertiary)" }} />
                              </a>
                            ) : (
                              <span>{entry.payload.problem_name}</span>
                            )}
                            <span className="badge badge-accent">{entry.payload.difficulty ?? entry.payload.problem_rating ?? "—"}</span>
                          </div>
                          <div className="caption" style={{ marginTop: 2, display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "center" }}>
                            <span>{entry.entry_date}</span>
                            {entry.payload.time_taken ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                <ClockIcon style={{ width: 12, height: 12 }} /> {entry.payload.time_taken}m
                              </span>
                            ) : null}
                            {entry.payload.verdict === "upsolved" && <span className="badge badge-warning">Upsolved</span>}
                          </div>
                          {entry.payload.tags.length > 0 && (
                            <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                              {entry.payload.tags.slice(0, 5).map((t) => (
                                <span key={t} className="badge" style={{ color: "var(--text-secondary)" }}>{t}</span>
                              ))}
                            </div>
                          )}
                          {entry.payload.mistakes && (
                            <div className="caption" style={{ marginTop: 4, color: "var(--warning)" }}>
                              Mistakes: {entry.payload.mistakes}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleDeleteEntry(entry.id)}
                      aria-label="Delete entry"
                    >
                      <TrashIcon className="icon" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Problems by difficulty */}
          {difficultyStats.length > 0 && (
            <div className="card" style={{ marginTop: "var(--space-4)" }}>
              <h3 className="section-title">Problems by Difficulty</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {difficultyStats.map(({ diff, count, max }) => (
                  <div key={diff} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <span style={{ width: 48, fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)" }}>
                      {diff}
                    </span>
                    <div className="progress-bar" style={{ flex: 1 }}>
                      <div className="progress-bar-fill" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                    <span style={{ width: 32, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", fontWeight: 600 }}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </PageWrapper>
  );
}
