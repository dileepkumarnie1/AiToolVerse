// The search box that opens from any page: Ctrl/⌘ K, "/" or any element marked data-search-open.
// Loaded on first use, so pages that never search do not download it.
import MiniSearch from 'minisearch';

// Row layouts match src/pages/data/search.json.ts.
type ToolRow = [slug: string, name: string, tagline: string, capability: string, pricing: string, logo: 0 | 1, popularity: number];
type PipelineRow = [slug: string, title: string, outcome: string];
type CompareRow = [slug: string, a: string, b: string];
interface SearchIndex {
  tools: ToolRow[];
  pipelines: PipelineRow[];
  comparisons: CompareRow[];
}

interface Entry {
  href: string;
  title: string;
  detail: string;
  group: string;
  logo?: string;
}

const PRICING: Record<string, string> = { free: 'Free', freemium: 'Free plan', paid: 'Paid' };
const SHORTCUTS: Entry[] = [
  { group: 'Go to', href: '/start/', title: 'Get my personal plan', detail: 'Answer five questions' },
  { group: 'Go to', href: '/tools/', title: 'All tools', detail: 'Browse and filter' },
  { group: 'Go to', href: '/compare/', title: 'Compare tools', detail: 'Side by side' },
  { group: 'Go to', href: '/trending/', title: 'Trending', detail: 'Most discussed now' },
  { group: 'Go to', href: '/weekly/', title: 'This week in AI', detail: 'News and tools' },
  { group: 'Go to', href: '/pipelines/', title: 'Pipelines', detail: 'Step-by-step paths' },
];
const LIMITS: Record<string, number> = { Tools: 7, Compare: 3, Pipelines: 3 };

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

let dialog: HTMLDialogElement | null = null;
let input: HTMLInputElement;
let list: HTMLElement;
let status: HTMLElement;
let entries: Entry[] = [];
let active = 0;
let popular: Entry[] = [];
let search: ((query: string) => Entry[]) | null = null;
let loading: Promise<void> | null = null;

const toolEntry = (row: ToolRow): Entry => ({
  group: 'Tools',
  href: `/tools/${row[0]}/`,
  title: row[1],
  detail: [row[3], PRICING[row[4]]].filter(Boolean).join(' · '),
  logo: row[5] ? `/logos/${row[0]}.webp` : '',
});

const load = () =>
  (loading ??= fetch('/data/search.json')
    .then((res) => (res.ok ? (res.json() as Promise<SearchIndex>) : Promise.reject(new Error(String(res.status)))))
    .then((index) => {
      const byId = new Map<string, { entry: Entry; weight: number }>();
      const docs: { id: string; name: string; text: string; caps: string }[] = [];
      for (const row of index.tools) {
        byId.set(`t:${row[0]}`, { entry: toolEntry(row), weight: 0.5 + row[6] / 100 });
        docs.push({ id: `t:${row[0]}`, name: row[1], text: row[2], caps: row[3] });
      }
      for (const row of index.pipelines) {
        byId.set(`p:${row[0]}`, { entry: { group: 'Pipelines', href: `/pipelines/${row[0]}/`, title: row[1], detail: row[2] }, weight: 1 });
        docs.push({ id: `p:${row[0]}`, name: row[1], text: row[2], caps: '' });
      }
      for (const row of index.comparisons) {
        const title = `${row[1]} vs ${row[2]}`;
        byId.set(`c:${row[0]}`, { entry: { group: 'Compare', href: `/compare/${row[0]}/`, title, detail: 'Side-by-side comparison' }, weight: 1 });
        docs.push({ id: `c:${row[0]}`, name: title, text: '', caps: '' });
      }
      const mini = new MiniSearch({ fields: ['name', 'text', 'caps'], searchOptions: { boost: { name: 3, caps: 2 }, prefix: true, fuzzy: 0.15 } });
      mini.addAll(docs);
      popular = [...index.tools].sort((a, b) => b[6] - a[6]).slice(0, 5).map((row) => ({ ...toolEntry(row), group: 'Popular tools' }));
      search = (query) => {
        const taken: Record<string, number> = {};
        return mini
          .search(query)
          .map((hit) => ({ ...byId.get(hit.id as string)!, score: hit.score }))
          .sort((a, b) => b.score * b.weight - a.score * a.weight)
          .map((hit) => hit.entry)
          .filter((entry) => (taken[entry.group] = (taken[entry.group] ?? 0) + 1) <= LIMITS[entry.group])
          .sort((a, b) => Object.keys(LIMITS).indexOf(a.group) - Object.keys(LIMITS).indexOf(b.group));
      };
    }));

const setActive = (index: number) => {
  const options = list.querySelectorAll<HTMLElement>('[role="option"]');
  if (options.length === 0) return input.removeAttribute('aria-activedescendant');
  active = (index + options.length) % options.length;
  options.forEach((option, i) => option.setAttribute('aria-selected', String(i === active)));
  input.setAttribute('aria-activedescendant', options[active].id);
  options[active].scrollIntoView({ block: 'nearest' });
};

const render = () => {
  const query = input.value.trim();
  if (!query) entries = [...SHORTCUTS, ...popular];
  else if (search) entries = [...search(query), { group: 'More', href: `/tools/?q=${encodeURIComponent(query)}`, title: `See all tools for “${query}”`, detail: '' }];
  else entries = [];

  list.replaceChildren();
  let group = '';
  entries.forEach((entry, i) => {
    if (entry.group !== group) {
      group = entry.group;
      const heading = el('li', 'palette-group', group);
      heading.setAttribute('role', 'presentation');
      list.append(heading);
    }
    const item = el('li');
    item.setAttribute('role', 'presentation');
    const link = el('a', 'palette-item');
    link.href = entry.href;
    link.id = `palette-option-${i}`;
    link.setAttribute('role', 'option');
    link.tabIndex = -1;
    if (entry.logo) {
      const img = el('img', 'palette-logo');
      img.src = entry.logo;
      img.alt = '';
      img.width = 28;
      img.height = 28;
      link.append(img);
    } else {
      const mark = el('span', 'palette-logo palette-mark', entry.title.match(/[A-Za-z0-9]/)?.[0]?.toUpperCase() ?? '?');
      mark.setAttribute('aria-hidden', 'true');
      link.append(mark);
    }
    const text = el('span', 'palette-text');
    text.append(el('span', 'palette-title', entry.title));
    if (entry.detail) text.append(el('span', 'palette-detail', entry.detail));
    link.append(text);
    link.addEventListener('pointermove', () => i !== active && setActive(i));
    item.append(link);
    list.append(item);
  });
  const count = query && search ? entries.length - 1 : entries.length;
  status.textContent = !search ? 'Loading…' : query && count === 0 ? 'No matches. Try fewer words.' : '';
  setActive(0);
};

const build = () => {
  dialog = el('dialog', 'palette');
  dialog.setAttribute('aria-label', 'Search AIToolVerse');
  const box = el('div', 'palette-box');
  const row = el('div', 'palette-input-row');
  input = el('input', 'palette-input');
  input.type = 'search';
  input.placeholder = 'Search tools, comparisons, pipelines…';
  input.maxLength = 100;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'true');
  input.setAttribute('aria-controls', 'palette-list');
  input.setAttribute('aria-label', 'Search');
  const close = el('button', 'palette-close', 'Esc');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close search');
  close.addEventListener('click', () => dialog?.close());
  row.append(input, close);
  list = el('ul', 'palette-list');
  list.id = 'palette-list';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Results');
  status = el('p', 'palette-status');
  status.setAttribute('role', 'status');
  const foot = el('p', 'palette-foot', '↑ ↓ to move · Enter to open · Esc to close');
  foot.setAttribute('aria-hidden', 'true');
  box.append(row, status, list, foot);
  dialog.append(box);

  input.addEventListener('input', render);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(active + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Escape') {
      // Without this, the first Esc only clears a search field and a second one is needed to close.
      event.preventDefault();
      dialog?.close();
    } else if (event.key === 'Enter') {
      const target = entries[active];
      if (!target) return;
      event.preventDefault();
      location.assign(target.href);
    }
  });
  // A click on the dimmed area around the box closes the search.
  dialog.addEventListener('click', (event) => event.target === dialog && dialog?.close());
  document.body.append(dialog);
};

export const openPalette = (query = '') => {
  if (!dialog) build();
  if (!dialog || dialog.open) return;
  input.value = query;
  dialog.showModal();
  render();
  input.focus();
  load().then(render, () => {
    status.textContent = 'Search could not load. Open the tools page instead.';
  });
};
