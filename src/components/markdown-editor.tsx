"use client";

import { useRef, useState } from "react";
import { ArticleBody } from "@/components/article-body";
import { uploadBodyImage } from "@/app/admin/articles/actions";

type Sel = { value: string; start: number; end: number };

export function MarkdownEditor({
  value,
  onChange,
  rows = 20,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function apply(transform: (sel: Sel) => Sel) {
    const ta = ref.current;
    if (!ta) return;
    const res = transform({ value, start: ta.selectionStart, end: ta.selectionEnd });
    onChange(res.value);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(res.start, res.end);
    });
  }

  function wrap(token: string, tokenEnd = token, placeholder = "text") {
    apply(({ value, start, end }) => {
      const selected = value.slice(start, end) || placeholder;
      const newValue = value.slice(0, start) + token + selected + tokenEnd + value.slice(end);
      const s = start + token.length;
      return { value: newValue, start: s, end: s + selected.length };
    });
  }

  function prefixLine(prefix: string) {
    apply(({ value, start, end }) => {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const newValue = value.slice(0, lineStart) + prefix + value.slice(lineStart);
      return { value: newValue, start: start + prefix.length, end: end + prefix.length };
    });
  }

  function insert(text: string) {
    apply(({ value, start, end }) => {
      const newValue = value.slice(0, start) + text + value.slice(end);
      const pos = start + text.length;
      return { value: newValue, start: pos, end: pos };
    });
  }

  function link() {
    apply(({ value, start, end }) => {
      const selected = value.slice(start, end) || "link text";
      const md = `[${selected}](https://)`;
      const newValue = value.slice(0, start) + md + value.slice(end);
      const pos = start + selected.length + 3 + 8; // inside the url, after https://
      return { value: newValue, start: pos, end: pos };
    });
  }

  async function onImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadBodyImage(fd);
      const alt = file.name.replace(/\.[^.]+$/, "");
      insert(`\n\n![${alt}](${res.url})\n\n`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const btn =
    "flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm text-ink-soft transition-colors hover:bg-white hover:text-ink";

  return (
    <div className="rounded-lg border border-neutral-300 dark:border-neutral-700">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-neutral-200 bg-surface px-1.5 py-1 dark:border-neutral-800">
        <button type="button" onClick={() => wrap("**", "**", "bold")} className={`${btn} font-bold`} title="Bold">B</button>
        <button type="button" onClick={() => wrap("*", "*", "italic")} className={`${btn} italic`} title="Italic">I</button>
        <Divider />
        <button type="button" onClick={() => prefixLine("## ")} className={`${btn} font-semibold`} title="Heading (big)">H2</button>
        <button type="button" onClick={() => prefixLine("### ")} className={`${btn} font-semibold`} title="Subheading">H3</button>
        <Divider />
        <button type="button" onClick={() => prefixLine("- ")} className={btn} title="Bullet list">• List</button>
        <button type="button" onClick={() => prefixLine("1. ")} className={btn} title="Numbered list">1.</button>
        <button type="button" onClick={() => prefixLine("> ")} className={btn} title="Quote">❝</button>
        <button type="button" onClick={link} className={btn} title="Link">Link</button>
        <Divider />
        <input ref={fileRef} type="file" accept="image/*" onChange={onImageFile} className="hidden" />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className={`${btn} disabled:opacity-50`}
          title="Insert image"
        >
          {uploading ? "⏳ Uploading…" : "🖼 Image"}
        </button>
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => setPreview((p) => !p)}
            className={`${btn} ${preview ? "bg-accent-soft text-accent" : ""}`}
            title="Toggle preview"
          >
            {preview ? "Edit" : "Preview"}
          </button>
        </div>
      </div>

      {err && <p className="px-3 pt-2 text-xs text-red-600">{err}</p>}

      {/* Editor / Preview */}
      {preview ? (
        <div className="min-h-[20rem] px-4 py-3">
          {value.trim() ? (
            <ArticleBody body={value} />
          ) : (
            <p className="text-sm text-ink-mute">Nothing to preview yet.</p>
          )}
        </div>
      ) : (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className="block w-full resize-y rounded-b-lg bg-transparent px-3 py-2 font-mono text-sm outline-none"
          placeholder="Write in Markdown… **bold**, ## Heading, - list, or use the toolbar."
        />
      )}
    </div>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-neutral-300 dark:bg-neutral-700" />;
}
