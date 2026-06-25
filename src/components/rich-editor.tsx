"use client";

import { useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { uploadBodyImage } from "@/app/admin/articles/actions";

/** tiptap-markdown adds `storage.markdown` at runtime but not in the types. */
function getMarkdown(editor: Editor): string {
  const storage = editor.storage as unknown as {
    markdown?: { getMarkdown: () => string };
  };
  return storage.markdown?.getMarkdown() ?? "";
}

/**
 * WordPress-style WYSIWYG editor (TipTap). Formatting is shown live while
 * typing; the body is stored as Markdown (agent/Kalonji content compatible,
 * rendered on the public site by react-markdown).
 */
export function RichEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: {
          openOnClick: false,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        },
      }),
      Image,
      Placeholder.configure({
        placeholder: "Article body yahan likho… toolbar se format karo / image add karo.",
      }),
      Markdown.configure({ html: false, transformPastedText: true, linkify: true }),
    ],
    content: value,
    editorProps: { attributes: { class: "min-h-[22rem]" } },
    onUpdate: ({ editor }) => {
      onChange(getMarkdown(editor));
    },
  });

  if (!editor) {
    return (
      <div className="rounded-lg border border-neutral-300 px-3 py-6 text-sm text-ink-mute dark:border-neutral-700">
        Loading editor…
      </div>
    );
  }

  function promptLink() {
    const prev = editor!.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL:", prev || "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor!.chain().focus().unsetLink().run();
      return;
    }
    editor!.chain().focus().setLink({ href: url.trim() }).run();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadBodyImage(fd);
      editor!
        .chain()
        .focus()
        .setImage({ src: res.url, alt: file.name.replace(/\.[^.]+$/, "") })
        .run();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="rich-editor rounded-lg border border-neutral-300 dark:border-neutral-700">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-neutral-200 bg-surface px-1.5 py-1 dark:border-neutral-800">
        <TB editor={editor} cmd={(e) => e.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold (Ctrl+B)">
          <span className="font-bold">B</span>
        </TB>
        <TB editor={editor} cmd={(e) => e.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic (Ctrl+I)">
          <span className="italic">I</span>
        </TB>
        <TB editor={editor} cmd={(e) => e.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
          <span className="line-through">S</span>
        </TB>
        <Divider />
        <TB editor={editor} cmd={(e) => e.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading">H2</TB>
        <TB editor={editor} cmd={(e) => e.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Subheading">H3</TB>
        <TB editor={editor} cmd={(e) => e.chain().focus().setParagraph().run()} active={editor.isActive("paragraph")} title="Normal text">¶</TB>
        <Divider />
        <TB editor={editor} cmd={(e) => e.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">• List</TB>
        <TB editor={editor} cmd={(e) => e.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">1.</TB>
        <TB editor={editor} cmd={(e) => e.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Quote">❝</TB>
        <TB editor={editor} cmd={(e) => e.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="Code block">{"</>"}</TB>
        <Divider />
        <TB editor={editor} cmd={promptLink} active={editor.isActive("link")} title="Link">Link</TB>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
        <TB editor={editor} cmd={() => fileRef.current?.click()} disabled={uploading} title="Insert image">
          {uploading ? "⏳…" : "🖼 Image"}
        </TB>
        <TB editor={editor} cmd={(e) => e.chain().focus().setHorizontalRule().run()} title="Divider">―</TB>
        <Divider />
        <TB editor={editor} cmd={(e) => e.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">↶</TB>
        <TB editor={editor} cmd={(e) => e.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">↷</TB>
      </div>

      {err && <p className="px-3 pt-2 text-xs text-red-600">{err}</p>}

      <EditorContent editor={editor} className="px-4 py-3" />
    </div>
  );
}

function TB({
  editor,
  cmd,
  active,
  disabled,
  title,
  children,
}: {
  editor: Editor;
  cmd: (editor: Editor) => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => cmd(editor)}
      className={
        "flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-sm transition-colors disabled:opacity-40 " +
        (active
          ? "bg-accent-soft text-accent"
          : "text-ink-soft hover:bg-white hover:text-ink")
      }
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-neutral-300 dark:bg-neutral-700" />;
}
