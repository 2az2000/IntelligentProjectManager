import { THEME_STORAGE_KEY } from '@/lib/theme';

/**
 * Blocking theme bootstrap. This is deliberately a *server* component: React only
 * executes a `<script>` element when it is rendered on the server, whereas one
 * rendered by a client component is never executed and logs a console error.
 *
 * It mirrors `ThemeProvider` in `@/lib/theme` — keep the two in sync.
 */
export function ThemeScript() {
  const script = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)},s=localStorage.getItem(k),t=s==='light'||s==='dark'?s:'system',d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches),r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light'}catch(e){}})()`;

  return <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: script }} />;
}
