"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import AppShell from "@/components/AppShell";
import PageWrapper from "@/components/PageWrapper";
import { useAuthCrypto } from "@/lib/context";
import { fetchWikiPages, createWikiPage, updateWikiPage, deleteWikiPage } from "@/lib/db";
import { PlusIcon, TrashIcon, CloseIcon, SearchIcon, NotesIcon, BugIcon, BookOpenIcon } from "@/components/icons";
import type { WikiPagePayload } from "@/lib/types";

interface WikiPageItem {
  id: string;
  slug: string;
  category: string;
  updated_at: string | null;
  payload: WikiPagePayload;
}

const CATEGORIES = [
  { key: "short-notes", label: "Short Notes", Icon: NotesIcon },
  { key: "error-book", label: "Error Book", Icon: BugIcon },
  { key: "general", label: "General", Icon: BookOpenIcon },
] as const;

export default function WikiPage_() {
  const { user, passphrase, cryptoSalt } = useAuthCrypto();
  const [pages, setPages] = useState<WikiPageItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("short-notes");
  const [selectedPage, setSelectedPage] = useState<WikiPageItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");

  const loadData = useCallback(async () => {
    if (!user || !passphrase || !cryptoSalt) return;
    try {
      const data = await fetchWikiPages(user.id, passphrase, cryptoSalt);
      setPages(data);
    } catch (err) {
      console.error("Failed to load wiki pages:", err);
    } finally {
      setLoading(false);
    }
  }, [user, passphrase, cryptoSalt]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => loadData());
    return () => cancelAnimationFrame(raf);
  }, [loadData]);

  const filteredPages = useMemo(() => {
    let result = pages.filter((p) => p.category === selectedCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.payload.title.toLowerCase().includes(q) ||
          p.payload.content.toLowerCase().includes(q) ||
          p.payload.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return result.sort((a, b) => {
      const aDate = a.updated_at || a.id;
      const bDate = b.updated_at || b.id;
      return bDate.localeCompare(aDate);
    });
  }, [pages, selectedCategory, searchQuery]);

  const handleCreate = async () => {
    if (!user || !title.trim()) return;

    const pageSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    await createWikiPage(user.id, passphrase, cryptoSalt, {
      slug: pageSlug,
      category: selectedCategory,
      title,
      content,
      images: [],
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });

    setTitle("");
    setSlug("");
    setContent("");
    setTags("");
    setEditing(false);
    loadData();
  };

  const handleUpdate = async () => {
    if (!user || !selectedPage) return;

    await updateWikiPage(user.id, selectedPage.id, passphrase, cryptoSalt, {
      payload: {
        title,
        content,
        images: selectedPage.payload.images,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      },
    });

    setEditing(false);
    loadData();
  };

  const handleDelete = async (pageId: string) => {
    if (!user) return;
    await deleteWikiPage(user.id, pageId);
    if (selectedPage?.id === pageId) {
      setSelectedPage(null);
    }
    loadData();
  };

  const handleSelectPage = (page: WikiPageItem) => {
    setSelectedPage(page);
    setTitle(page.payload.title);
    setSlug(page.slug);
    setContent(page.payload.content);
    setTags(page.payload.tags.join(", "));
    setEditing(false);
  };

  const handleNewPage = () => {
    setSelectedPage(null);
    setTitle("");
    setSlug("");
    setContent("");
    setTags("");
    setEditing(true);
  };

  if (loading) {
    return (
      <PageWrapper>
        <AppShell>
          <div style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--text-secondary)" }}>
            Loading wiki...
          </div>
        </AppShell>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <AppShell>
        <div style={{ display: "flex", gap: "var(--space-6)", height: "calc(100vh - 4rem)" }}>
          {/* Sidebar list */}
          <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
              <div>
                <div className="module-eyebrow">Knowledge</div>
                <h1 className="page-title" style={{ marginBottom: 0 }}>Wiki</h1>
              </div>
              <button className="btn btn-primary btn-sm" onClick={handleNewPage} aria-label="New page">
                <PlusIcon className="icon" />
              </button>
            </div>

            {/* Category tabs */}
            <div className="tabs" style={{ marginBottom: "var(--space-3)" }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  className={`tab ${selectedCategory === cat.key ? "active" : ""}`}
                  onClick={() => {
                    setSelectedCategory(cat.key);
                    setSelectedPage(null);
                  }}
                  style={{ fontSize: "var(--text-xs)", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                >
                  <cat.Icon className="icon" />
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="search-bar" style={{ marginBottom: "var(--space-3)" }}>
              <SearchIcon />
              <input
                className="input"
                placeholder="Search pages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Page list */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {filteredPages.length === 0 ? (
                <div className="empty-state" style={{ padding: "var(--space-6)" }}>
                  <p className="caption">No pages yet</p>
                </div>
              ) : (
                filteredPages.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => handleSelectPage(page)}
                    className="habit-row"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: selectedPage?.id === page.id ? "var(--sidebar-item-bg-active)" : "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: "var(--text-sm)" }}>{page.payload.title}</div>
                      <div className="caption" style={{ marginTop: 2 }}>
                        {page.payload.tags.length > 0 && (
                          <span>{page.payload.tags.slice(0, 3).join(", ")}</span>
                        )}
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(page.id);
                      }}
                    >
                      <TrashIcon className="icon" />
                    </button>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Content area */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {editing || (!selectedPage && !editing) ? (
              <div className="card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                <div className="card-header">
                  <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>
                    {selectedPage ? "Edit Page" : "New Page"}
                  </h2>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                    <CloseIcon className="icon" />
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input
                    className="input"
                    placeholder="Page title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Tags (comma-separated)</label>
                  <input
                    className="input"
                    placeholder="e.g. algorithms, recursion, dp"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  <label className="form-label">Content (Markdown)</label>
                  <textarea
                    className="input"
                    placeholder="Write your page content here... (supports Markdown)"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", minHeight: 300 }}
                  />
                </div>

                <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
                  <button
                    className="btn btn-primary"
                    onClick={selectedPage ? handleUpdate : handleCreate}
                    disabled={!title.trim()}
                  >
                    {selectedPage ? "Update" : "Create"}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : selectedPage ? (
              <div className="card" style={{ height: "100%", overflowY: "auto" }}>
                <div className="card-header">
                  <div>
                    <h2 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, letterSpacing: "-0.02em" }}>
                      {selectedPage.payload.title}
                    </h2>
                    {selectedPage.payload.tags.length > 0 && (
                      <div style={{ display: "flex", gap: "var(--space-1)", marginTop: "var(--space-2)" }}>
                        {selectedPage.payload.tags.map((tag) => (
                          <span key={tag} className="badge badge-accent">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
                    Edit
                  </button>
                </div>
                <div className="markdown-content" style={{ whiteSpace: "pre-wrap" }}>
                  {selectedPage.payload.content}
                </div>
              </div>
            ) : (
              <div className="card" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="empty-state">
                  <div className="empty-state-icon"><BookOpenIcon /></div>
                  <p className="empty-state-title">Select a page or create a new one</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </AppShell>
    </PageWrapper>
  );
}
