"use client";

import { useEffect, useState } from "react";
import { Plus, Loader2, Tag } from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
}

function slugify(v: string) {
  return v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function CategoriesManager() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/categories");
    const data = await res.json();
    setCategories(data.categories ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), slug: slugify(name), sortOrder: categories?.length ?? 0 }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Could not add category.");
      return;
    }
    setName("");
    load();
  }

  return (
    <div className="card space-y-4 p-5">
      <h2 className="font-display text-base font-semibold text-ink">Categories</h2>

      {categories === null ? (
        <Loader2 size={16} className="animate-spin text-ink-faint" />
      ) : (
        <div className="flex flex-wrap gap-2">
          {categories.length === 0 && <p className="text-sm text-ink-muted">No categories yet.</p>}
          {categories.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1.5 rounded-pill border border-border px-3 py-1.5 text-xs text-ink">
              <Tag size={12} className="text-accent" /> {c.name}
            </span>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. AI Snake Reels" className="input" />
        <button type="submit" disabled={saving} className="btn-secondary shrink-0">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Add
        </button>
      </form>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
