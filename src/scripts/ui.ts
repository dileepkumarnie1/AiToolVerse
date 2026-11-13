// Enhancements shared by every page: the dark/light switch, search, scroll reveal, tilting cards,
// counting numbers, the orbiting tools in the hero and row carousels.
// Pages work without this script; it only adds motion and convenience.
import { THEME_COLORS, THEME_KEY } from '../lib/theme.mjs';

const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

/* ---------- Dark / light switch ---------- */
document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((button) => {
  const sync = () => button.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'));
  sync();
  button.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage can be blocked; the choice then lasts for this page only.
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[next]);
    sync();
  });
});

/* ---------- Search: Ctrl/⌘ K, "/" or any element marked data-search-open ---------- */
let palette: Promise<typeof import('./palette')> | null = null;
const openSearch = () => {
  palette ??= import('./palette');
  palette.then((module) => module.openPalette()).catch(() => location.assign('/tools/'));
};
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
if (isMac) document.querySelectorAll('[data-shortcut]').forEach((el) => (el.textContent = '⌘K'));

document.addEventListener('click', (event) => {
  const trigger = event.target instanceof Element ? event.target.closest('[data-search-open]') : null;
  // A modified click (new tab, new window) keeps its normal meaning.
  if (!trigger || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  openSearch();
});
document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  const typing = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
  const shortcut = (event.key === 'k' || event.key === 'K') && (isMac ? event.metaKey : event.ctrlKey) && !event.altKey && !event.shiftKey;
  const slash = event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey;
  if (!shortcut && !slash) return;
  event.preventDefault();
  openSearch();
});

/* ---------- Scroll reveal ---------- */
const revealTargets = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
if (revealTargets.length > 0 && 'IntersectionObserver' in window && !reduceMotion.matches) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  // Anything already on screen stays as it is; only content further down animates in.
  for (const el of revealTargets) {
    if (el.getBoundingClientRect().top < innerHeight) el.classList.add('is-in');
    else observer.observe(el);
  }
  root.classList.add('reveal-on');
}

/* ---------- Numbers that count up when they scroll into view ---------- */
const counters = [...document.querySelectorAll<HTMLElement>('[data-count]')].filter((el) => Number(el.dataset.count) > 0);
if (counters.length > 0 && 'IntersectionObserver' in window && !reduceMotion.matches) {
  const DURATION = 1400;
  const run = (el: HTMLElement) => {
    const end = Number(el.dataset.count);
    const suffix = el.dataset.suffix ?? '';
    const started = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / DURATION);
      el.textContent = `${Math.round(end * (1 - (1 - progress) ** 3))}${suffix}`;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      run(entry.target as HTMLElement);
    }
  });
  counters.forEach((el) => observer.observe(el));
}

/* ---------- Cards that tilt toward the pointer ---------- */
if (finePointer.matches && !reduceMotion.matches) {
  const MAX_TILT = 7;
  let current: HTMLElement | null = null;
  let frame = 0;
  let x = 0;
  let y = 0;

  const apply = () => {
    frame = 0;
    if (!current) return;
    const rect = current.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (x - rect.left) / rect.width));
    const py = Math.min(1, Math.max(0, (y - rect.top) / rect.height));
    current.style.setProperty('--mx', `${px * 100}%`);
    current.style.setProperty('--my', `${py * 100}%`);
    current.style.setProperty('--ry', `${(px - 0.5) * 2 * MAX_TILT}deg`);
    current.style.setProperty('--rx', `${(0.5 - py) * 2 * MAX_TILT}deg`);
  };
  const release = () => {
    current?.classList.remove('is-tilting');
    current = null;
  };

  document.addEventListener(
    'pointermove',
    (event) => {
      const el = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-tilt]') : null;
      if (el !== current) {
        release();
        current = el;
        el?.classList.add('is-tilting');
      }
      if (!current) return;
      x = event.clientX;
      y = event.clientY;
      frame ||= requestAnimationFrame(apply);
    },
    { passive: true },
  );
  root.addEventListener('pointerleave', release);
}

/* ---------- Hero: tools in orbit ---------- */
document.querySelectorAll<HTMLElement>('[data-uni]').forEach((uni) => {
  // The orbit itself is CSS. The script pauses it off screen and leans the scene toward the pointer.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => uni.classList.toggle('is-offscreen', !entry.isIntersecting)).observe(uni);
  }
  const tilt = uni.querySelector<HTMLElement>('.uni-tilt');
  const area = uni.closest<HTMLElement>('section') ?? uni;
  if (!tilt || !finePointer.matches || reduceMotion.matches) return;
  const MAX_LEAN = 7;
  let frame = 0;
  let px = 0;
  let py = 0;
  area.addEventListener(
    'pointermove',
    (event) => {
      const rect = area.getBoundingClientRect();
      px = (event.clientX - rect.left) / rect.width - 0.5;
      py = (event.clientY - rect.top) / rect.height - 0.5;
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        tilt.style.setProperty('--py', `${(px * 2 * MAX_LEAN).toFixed(2)}deg`);
        tilt.style.setProperty('--px', `${(-py * 2 * MAX_LEAN).toFixed(2)}deg`);
      });
    },
    { passive: true },
  );
  area.addEventListener('pointerleave', () => {
    tilt.style.setProperty('--px', '0deg');
    tilt.style.setProperty('--py', '0deg');
  });
});

/* ---------- Row carousels: previous / next buttons ---------- */
document.querySelectorAll<HTMLElement>('[data-row]').forEach((wrap) => {
  const row = wrap.querySelector<HTMLElement>('.snap-row');
  const prev = wrap.querySelector<HTMLButtonElement>('[data-row-prev]');
  const next = wrap.querySelector<HTMLButtonElement>('[data-row-next]');
  if (!row || !prev || !next) return;

  const page = (direction: number) =>
    row.scrollBy({ left: direction * Math.max(280, row.clientWidth * 0.8), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  const sync = () => {
    prev.disabled = row.scrollLeft < 8;
    next.disabled = row.scrollLeft + row.clientWidth > row.scrollWidth - 8;
  };
  prev.addEventListener('click', () => page(-1));
  next.addEventListener('click', () => page(1));
  row.addEventListener('scroll', sync, { passive: true });
  addEventListener('resize', sync);
  sync();
});
