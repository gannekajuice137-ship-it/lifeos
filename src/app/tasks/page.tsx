"use client";

import { useState, useEffect, useCallback } from "react";
import type { ComponentType } from "react";
import AppShell from "@/components/AppShell";
import PageWrapper from "@/components/PageWrapper";
import { useAuthCrypto } from "@/lib/context";
import {
  fetchTasksForDate,
  createTask,
  updateTask,
  deleteTask,
  fetchHabits,
  createHabit,
  deleteHabit,
  fetchHabitLogs,
  logHabit,
} from "@/lib/db";
import { CheckIcon, PlusIcon, TrashIcon, CloseIcon, ListIcon, TargetIcon, FlameIcon, ZapIcon, BookOpenIcon, CodeIcon, DumbbellIcon, MoonIcon, GraduationCapIcon, HeartIcon, StarIcon } from "@/components/icons";

interface TaskItem {
  id: string;
  status: string;
  due_date: string;
  sort_order: number;
  payload: {
    title: string;
    notes: string;
    priority: string;
    recurring: string | null;
    completed_at: string | null;
  };
}

interface HabitItem {
  id: string;
  payload: {
    name: string;
    emoji: string;
    color: string;
    target_days_per_week: number | null;
  };
}

const HABIT_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  zap: ZapIcon,
  book: BookOpenIcon,
  code: CodeIcon,
  gym: DumbbellIcon,
  sleep: MoonIcon,
  study: GraduationCapIcon,
  health: HeartIcon,
  star: StarIcon,
};

const HABIT_COLORS = ["#0a84ff", "#bf5af2", "#ff9f0a", "#ffd60a", "#30d158", "#ff375f"];

function HabitAvatar({ icon, color, className }: { icon: string; color: string; className?: string }) {
  const Icon = HABIT_ICONS[icon] ?? ZapIcon;
  return (
    <span className={className} style={{ ["--habit-color" as string]: color }}>
      <Icon />
    </span>
  );
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function formatDisplayDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// Calendar grid component for habit visualization
function HabitCalendarGrid({ logs, weeks = 15 }: { logs: Set<string>; weeks?: number }) {
  const cells: { date: string; filled: boolean; today: boolean }[] = [];
  const todayStr = today();
  const now = new Date();

  for (let w = weeks - 1; w >= 0; w--) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() - (w * 7 + (6 - d)));
      const dateStr = date.toISOString().split("T")[0];
      cells.push({
        date: dateStr,
        filled: logs.has(dateStr),
        today: dateStr === todayStr,
      });
    }
  }

  return (
    <div className="calendar-grid">
      {cells.map((cell) => (
        <div
          key={cell.date}
          className={`calendar-cell ${cell.filled ? "filled" : ""} ${cell.today ? "today" : ""}`}
          title={cell.date}
        />
      ))}
    </div>
  );
}

export default function TasksPage() {
  const { user, passphrase, cryptoSalt } = useAuthCrypto();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [habits, setHabits] = useState<HabitItem[]>([]);
  const [habitLogs, setHabitLogs] = useState<Record<string, Set<string>>>({});
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");
  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitIcon, setNewHabitIcon] = useState("zap");
  const [newHabitColor, setNewHabitColor] = useState("#0a84ff");
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user || !passphrase || !cryptoSalt) return;
    try {
      const [tasksData, habitsData] = await Promise.all([
        fetchTasksForDate(user.id, passphrase, cryptoSalt, today()),
        fetchHabits(user.id, passphrase, cryptoSalt),
      ]);
      setTasks(tasksData as TaskItem[]);
      setHabits(habitsData as HabitItem[]);

      // Load habit logs for last 15 weeks
      const logs: Record<string, Set<string>> = {};
      for (const habit of habitsData) {
        const habitLogsData = await fetchHabitLogs(user.id, habit.id);
        logs[habit.id] = new Set(habitLogsData.map((l) => l.log_date));
      }
      setHabitLogs(logs);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setLoading(false);
    }
  }, [user, passphrase, cryptoSalt]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => loadData());
    return () => cancelAnimationFrame(raf);
  }, [loadData]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !user) return;

    const sortOrder = tasks.length;
    await createTask(user.id, passphrase, cryptoSalt, {
      title: newTaskTitle,
      notes: "",
      priority: newTaskPriority as "low" | "medium" | "high",
      recurring: null,
      completed_at: null,
      due_date: today(),
      sort_order: sortOrder,
    });

    setNewTaskTitle("");
    loadData();
  };

  const handleToggleTask = async (task: TaskItem) => {
    if (!user) return;
    const newStatus = task.status === "done" ? "pending" : "done";
    await updateTask(user.id, task.id, passphrase, cryptoSalt, {
      status: newStatus,
      payload: {
        title: task.payload.title,
        notes: task.payload.notes,
        priority: task.payload.priority as "low" | "medium" | "high",
        recurring: task.payload.recurring,
        completed_at: newStatus === "done" ? new Date().toISOString() : null,
      },
    });
    loadData();
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!user) return;
    await deleteTask(user.id, taskId);
    loadData();
  };

  const handleToggleHabit = async (habitId: string) => {
    if (!user) return;
    await logHabit(user.id, habitId, today());
    loadData();
  };

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim() || !user) return;

    await createHabit(user.id, passphrase, cryptoSalt, {
      name: newHabitName,
      emoji: newHabitIcon,
      color: newHabitColor,
      target_days_per_week: null,
    });

    setNewHabitName("");
    setNewHabitIcon("zap");
    setNewHabitColor("#0a84ff");
    setShowAddHabit(false);
    loadData();
  };

  const handleDeleteHabit = async (habitId: string) => {
    if (!user) return;
    await deleteHabit(user.id, habitId);
    loadData();
  };

  const getStreak = (habitId: string): number => {
    const logs = habitLogs[habitId];
    if (!logs || logs.size === 0) return 0;

    let streak = 0;
    const now = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      if (logs.has(dateStr)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  };

  if (loading) {
    return (
      <PageWrapper>
        <AppShell>
          <div style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--text-secondary)" }}>
            Loading tasks...
          </div>
        </AppShell>
      </PageWrapper>
    );
  }

  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const doneTasks = tasks.filter((t) => t.status === "done");

  return (
    <PageWrapper>
      <AppShell>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <header className="module-header">
            <div className="module-eyebrow">Tasks</div>
            <h1 className="module-title">Today</h1>
            <p className="module-sub">
              {formatDisplayDate(today())} · {pendingTasks.length} open · {doneTasks.length} completed
            </p>
          </header>

          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-value">{pendingTasks.length}</div>
              <div className="stat-label">Open tasks</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{doneTasks.length}</div>
              <div className="stat-label">Completed</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{habits.length}</div>
              <div className="stat-label">Active habits</div>
            </div>
          </div>

          {/* Tasks Section */}
          <section style={{ marginBottom: "var(--space-8)" }}>
            <div className="card">
              {/* Add task form */}
              <form onSubmit={handleAddTask} style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)" }}>
                <input
                  type="text"
                  className="input"
                  placeholder="Add a task..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  style={{ flex: 1 }}
                />
                <select
                  className="select"
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value)}
                  style={{ width: "auto", minWidth: 100 }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <button type="submit" className="btn btn-primary" disabled={!newTaskTitle.trim()}>
                  <PlusIcon className="icon" />
                </button>
              </form>

              {/* Pending tasks */}
              {pendingTasks.length === 0 && doneTasks.length === 0 && (
                <div className="empty-state" style={{ padding: "var(--space-8) var(--space-4)" }}>
                  <div className="empty-state-icon"><ListIcon /></div>
                  <p className="empty-state-text">No tasks for today. Add one above!</p>
                </div>
              )}

              {pendingTasks.map((task) => (
                <div
                  key={task.id}
                  className="habit-row"
                  style={{
                    borderBottom: "1px solid var(--separator)",
                    paddingBottom: "var(--space-3)",
                    marginBottom: "var(--space-1)",
                  }}
                >
                  <button
                    className="checkbox"
                    onClick={() => handleToggleTask(task)}
                    aria-label="Mark done"
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: "var(--text-sm)" }}>{task.payload.title}</div>
                    {task.payload.notes && (
                      <div className="caption" style={{ marginTop: 2 }}>{task.payload.notes}</div>
                    )}
                  </div>
                  <span className={`badge badge-${task.payload.priority}`}>{task.payload.priority}</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDeleteTask(task.id)}
                    aria-label="Delete"
                  >
                    <TrashIcon className="icon" />
                  </button>
                </div>
              ))}

              {/* Done tasks */}
              {doneTasks.length > 0 && (
                <>
                  <div style={{ padding: "var(--space-3) 0", fontSize: "var(--text-xs)", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Completed
                  </div>
                  {doneTasks.map((task) => (
                    <div
                      key={task.id}
                      className="habit-row"
                      style={{ opacity: 0.5, paddingBottom: "var(--space-2)" }}
                    >
                      <button
                        className="checkbox checked"
                        onClick={() => handleToggleTask(task)}
                        aria-label="Mark pending"
                      >
                        <CheckIcon className="icon" />
                      </button>
                      <div style={{ flex: 1, textDecoration: "line-through", fontSize: "var(--text-sm)" }}>
                        {task.payload.title}
                      </div>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDeleteTask(task.id)}
                        aria-label="Delete"
                      >
                        <TrashIcon className="icon" />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>

          {/* Habits Section */}
          <section>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
              <h2 className="section-title" style={{ margin: 0 }}>Habits</h2>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAddHabit(!showAddHabit)}
              >
                {showAddHabit ? <CloseIcon className="icon" /> : <PlusIcon className="icon" />}
                {showAddHabit ? "Cancel" : "Add Habit"}
              </button>
            </div>

            {showAddHabit && (
              <div className="card" style={{ marginBottom: "var(--space-4)" }}>
                <form onSubmit={handleAddHabit}>
                  <div className="habit-picker">
                    <input
                      type="text"
                      className="input"
                      placeholder="Habit name"
                      value={newHabitName}
                      onChange={(e) => setNewHabitName(e.target.value)}
                    />
                    <div className="hp-icons" role="group" aria-label="Habit icon">
                      {Object.entries(HABIT_ICONS).map(([key, Icon]) => (
                        <button
                          key={key}
                          type="button"
                          className={`hp-icon ${newHabitIcon === key ? "active" : ""}`}
                          onClick={() => setNewHabitIcon(key)}
                          aria-label={`Icon ${key}`}
                        >
                          <Icon />
                        </button>
                      ))}
                    </div>
                    <div className="hp-colors" role="group" aria-label="Habit color">
                      {HABIT_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`hp-color ${newHabitColor === c ? "active" : ""}`}
                          style={{ background: c, ["--habit-pick-color" as string]: c }}
                          onClick={() => setNewHabitColor(c)}
                          aria-label={`Color ${c}`}
                        />
                      ))}
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={!newHabitName.trim()}>
                      Add Habit
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="card">
              {habits.length === 0 ? (
                <div className="empty-state" style={{ padding: "var(--space-8) var(--space-4)" }}>
                  <div className="empty-state-icon"><TargetIcon /></div>
                  <p className="empty-state-title">No habits yet</p>
                  <p className="empty-state-text">Start building consistency!</p>
                </div>
              ) : (
                habits.map((habit) => {
                  const todayLogged = habitLogs[habit.id]?.has(today());
                  const streak = getStreak(habit.id);
                  return (
                    <div key={habit.id}>
                      <div className="habit-row">
                        <button
                          className={`checkbox ${todayLogged ? "checked" : ""}`}
                          onClick={() => handleToggleHabit(habit.id)}
                          aria-label={todayLogged ? "Uncheck habit" : "Check habit"}
                        >
                          {todayLogged && <CheckIcon className="icon" />}
                        </button>
                        <HabitAvatar icon={habit.payload.emoji} color={habit.payload.color} className="habit-avatar" />
                        <div className="habit-info">
                          <div className="habit-name">{habit.payload.name}</div>
                          <div className="habit-streak">
                            {streak > 0 ? (<><FlameIcon /> {streak} day streak</>) : "No streak yet"}
                          </div>
                        </div>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleDeleteHabit(habit.id)}
                          aria-label="Delete habit"
                        >
                          <TrashIcon className="icon" />
                        </button>
                      </div>
                      <div style={{ padding: "0 var(--space-4) var(--space-4)" }}>
                        <HabitCalendarGrid logs={habitLogs[habit.id] || new Set()} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </AppShell>
    </PageWrapper>
  );
}
