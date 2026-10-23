'use client';

import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import {
  Bold,
  Code,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Strikethrough,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Plain legacy descriptions become paragraphs so they open ready to edit. */
export function plainToHtml(text: string | null): string {
  if (!text) return '';
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/**
 * §4 rich text description. The editor emits HTML, but the server owns sanitization —
 * this component only decides what tools the writer gets.
 */
export function RichTextEditor({
  value,
  editable,
  placeholder,
  onChange,
  onBlur,
}: {
  value: string;
  editable: boolean;
  placeholder: string;
  onChange: (html: string) => void;
  onBlur: () => void;
}) {
  const t = useTranslations('Tasks');
  const editor = useEditor({
    // The sheet renders on the server first; TipTap must not touch the DOM until hydration.
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: value,
    editorProps: {
      attributes: {
        'aria-label': t('descriptionLabel'),
        class: cn(
          'min-h-24 rounded-md border bg-transparent px-3 py-2 text-sm leading-relaxed',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
          'empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]',
          '[&_p]:my-1 [&_h1]:my-2 [&_h1]:text-lg [&_h1]:font-semibold',
          '[&_h2]:my-2 [&_h2]:text-base [&_h2]:font-semibold',
          '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:ps-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:ps-5',
          "[&_ul[data-type='taskList']]:list-none [&_ul[data-type='taskList']]:ps-1",
          "[&_ul[data-type='taskList']_li]:flex [&_ul[data-type='taskList']_li]:items-start [&_ul[data-type='taskList']_li]:gap-2",
          '[&_a]:underline [&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5',
          '[&_blockquote]:border-s-2 [&_blockquote]:ps-3 [&_blockquote]:text-muted-foreground',
        ),
        'data-placeholder': placeholder,
      },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
    onBlur,
  });

  // A different task (or a server refresh) replaces the body; typing must not be interrupted.
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    if (value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return null;

  const tool = (active: boolean) =>
    cn('size-8', active && 'bg-accent text-accent-foreground');

  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const href = window.prompt(t('linkPrompt'), previous ?? 'https://');
    if (href === null) return;
    if (href === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  if (!editable) {
    return (
      <div
        className="prose-sm text-sm leading-relaxed [&_a]:underline [&_ul]:list-disc [&_ul]:ps-5 [&_ol]:list-decimal [&_ol]:ps-5"
        // Stored HTML is sanitized by the API before it ever reaches this renderer.
        dangerouslySetInnerHTML={{ __html: value || `<p class="text-muted-foreground">${placeholder}</p>` }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label={t('formattingLabel')}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={tool(editor.isActive('bold'))}
          aria-pressed={editor.isActive('bold')}
          aria-label={t('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={tool(editor.isActive('italic'))}
          aria-pressed={editor.isActive('italic')}
          aria-label={t('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={tool(editor.isActive('strike'))}
          aria-pressed={editor.isActive('strike')}
          aria-label={t('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={tool(editor.isActive('bulletList'))}
          aria-pressed={editor.isActive('bulletList')}
          aria-label={t('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={tool(editor.isActive('orderedList'))}
          aria-pressed={editor.isActive('orderedList')}
          aria-label={t('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={tool(editor.isActive('taskList'))}
          aria-pressed={editor.isActive('taskList')}
          aria-label={t('taskList')}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          <ListChecks className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={tool(editor.isActive('code'))}
          aria-pressed={editor.isActive('code')}
          aria-label={t('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={tool(editor.isActive('link'))}
          aria-pressed={editor.isActive('link')}
          aria-label={t('link')}
          onClick={setLink}
        >
          <Link2 className="size-4" aria-hidden />
        </Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
