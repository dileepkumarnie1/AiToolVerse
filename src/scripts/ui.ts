// Enhancements shared by every page: the light/dark switch, scroll reveal, tilting cards,
// the 3D tool carousel, row carousels and the goal picker.
// Pages work without this script; it only adds motion and convenience.
import { THEME_COLORS, THEME_KEY } from '../lib/theme.mjs';

const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

/* ---------- Light / dark switch ---------- */
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

/* ---------- 3D tool carousel ---------- */
document.querySelectorAll<HTMLElement>('[data-orbit]').forEach((wrap) => {
  const stage = wrap.querySelector<HTMLElement>('.orbit-stage');
  const ring = wrap.querySelector<HTMLElement>('.orbit');
  const cards = [...wrap.querySelectorAll<HTMLElement>('.orbit-card')];
  if (!stage || !ring || cards.length === 0) return;

  const step = 360 / cards.length;
  const AUTO_SPEED = -5; // degrees per second
  const DEG_PER_PX = 0.13; // roughly keeps a card under the finger while dragging
  const MAX_FLING = 240;

  let angle = 0;
  let target: number | null = null;
  let velocity = 0;
  let front = -1;
  let pressed = false;
  let moved = false;
  let hovering = false;
  let visible = true;
  // Once the visitor drags, uses the arrows or tabs to a card, the carousel stops turning by itself.
  let autoplay = !reduceMotion.matches;
  let pointerId = -1;
  let startX = 0;
  let startAngle = 0;
  let lastX = 0;
  let lastTime = 0;
  let frame = 0;
  let previous = 0;

  const render = () => {
    ring.style.setProperty('--angle', `${angle.toFixed(3)}deg`);
    const index = ((Math.round(-angle / step) % cards.length) + cards.length) % cards.length;
    if (index === front) return;
    cards[front]?.classList.remove('is-front');
    cards[index].classList.add('is-front');
    front = index;
  };

  const turning = () => autoplay && !hovering && !wrap.matches(':focus-within');
  const moving = () => pressed || target !== null || Math.abs(velocity) > 1 || turning();

  const tick = (now: number) => {
    const dt = Math.min(48, now - previous) / 1000;
    previous = now;
    if (!pressed) {
      if (target !== null) {
        const delta = target - angle;
        angle += delta * Math.min(1, dt * 7);
        if (Math.abs(delta) < 0.05) {
          angle = target;
          target = null;
        }
      } else if (Math.abs(velocity) > 1) {
        angle += velocity * dt;
        velocity *= 0.04 ** dt;
      } else if (turning()) {
        angle += AUTO_SPEED * dt;
      }
    }
    render();
    // The loop runs only while something is moving and the carousel is on screen.
    frame = moving() && visible && !document.hidden ? requestAnimationFrame(tick) : 0;
  };
  const start = () => {
    if (frame || !visible || document.hidden) return;
    previous = performance.now();
    frame = requestAnimationFrame(tick);
  };

  /** Turns the carousel the short way round until the given card faces the visitor. */
  const bringToFront = (index: number) => {
    const delta = ((((-index * step - angle) % 360) + 540) % 360) - 180;
    autoplay = false;
    velocity = 0;
    if (reduceMotion.matches) {
      angle += delta;
      target = null;
      render();
    } else {
      target = angle + delta;
      start();
    }
  };

  stage.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pressed = true;
    moved = false;
    pointerId = event.pointerId;
    startX = lastX = event.clientX;
    startAngle = angle;
    lastTime = event.timeStamp;
    velocity = 0;
    target = null;
    start();
  });
  stage.addEventListener('pointermove', (event) => {
    if (!pressed || event.pointerId !== pointerId) return;
    const dx = event.clientX - startX;
    if (!moved && Math.abs(dx) > 6) {
      moved = true;
      autoplay = false;
      stage.classList.add('is-dragging');
      stage.setPointerCapture(pointerId);
    }
    if (!moved) return;
    angle = startAngle + dx * DEG_PER_PX;
    const elapsed = Math.max(1, event.timeStamp - lastTime);
    velocity = (((event.clientX - lastX) * DEG_PER_PX) / elapsed) * 1000;
    lastX = event.clientX;
    lastTime = event.timeStamp;
  });
  const endPress = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    pressed = false;
    pointerId = -1;
    stage.classList.remove('is-dragging');
    velocity = moved ? Math.max(-MAX_FLING, Math.min(MAX_FLING, velocity)) : 0;
    // The click that follows a drag must not open the card; clear the flag once that click has passed.
    setTimeout(() => {
      moved = false;
    }, 0);
  };
  stage.addEventListener('pointerup', endPress);
  stage.addEventListener('pointercancel', endPress);
  stage.addEventListener(
    'click',
    (event) => {
      if (!moved) return;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );
  stage.addEventListener('dragstart', (event) => event.preventDefault());
  wrap.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') hovering = true;
  });
  wrap.addEventListener('pointerleave', () => {
    hovering = false;
    start();
  });
  wrap.addEventListener('focusout', start);

  // Keyboard: tabbing to a card turns it to the front, including cards on the far side.
  cards.forEach((card, index) => {
    card.addEventListener('focus', () => {
      if (!pressed && card.matches(':focus-visible')) bringToFront(index);
    });
  });
  wrap.querySelector('[data-orbit-prev]')?.addEventListener('click', () => bringToFront((front - 1 + cards.length) % cards.length));
  wrap.querySelector('[data-orbit-next]')?.addEventListener('click', () => bringToFront((front + 1) % cards.length));

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    start();
  }).observe(stage);
  document.addEventListener('visibilitychange', start);
  render();
  start();
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

/* ---------- Tabs (goal picker) ---------- */
document.querySelectorAll<HTMLElement>('[data-tabs]').forEach((group) => {
  const tabs = [...group.querySelectorAll<HTMLElement>('[role="tab"]')];
  const select = (tab: HTMLElement, focus = false) => {
    for (const t of tabs) {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls') ?? '')?.toggleAttribute('hidden', !selected);
    }
    if (focus) tab.focus();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (event) => {
      const move = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!move) return;
      event.preventDefault();
      select(tabs[(index + move + tabs.length) % tabs.length], true);
    });
  });
});
