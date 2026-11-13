const GRADIENTS = [
  'from-violet-500 to-indigo-500',
  'from-fuchsia-500 to-pink-500',
  'from-sky-500 to-cyan-400',
  'from-emerald-500 to-teal-400',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-red-500',
  'from-indigo-500 to-blue-500',
  'from-lime-500 to-emerald-500',
];

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

interface Props {
  slug: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  /** True when a locally stored logo exists for this tool. */
  logo?: boolean;
}

/** The tool's logo from our own /logos folder, or a monogram when there is none. No third-party requests. */
export default function ToolAvatar({ slug, name, size = 'md', logo = false }: Props) {
  const sizes = { sm: 'h-8 w-8 text-sm rounded-lg', md: 'h-11 w-11 text-base rounded-xl', lg: 'h-16 w-16 text-2xl rounded-2xl' };
  if (logo) {
    return (
      <span aria-hidden="true" className={`inline-flex shrink-0 overflow-hidden bg-white shadow-sm ring-1 ring-ink-200/80 dark:ring-white/15 ${sizes[size]}`}>
        <img src={`/logos/${slug}.webp`} alt="" width={96} height={96} loading="lazy" decoding="async" draggable={false} className="h-full w-full object-contain" />
      </span>
    );
  }
  const initial = (name.match(/[A-Za-z0-9]/)?.[0] ?? '?').toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center bg-linear-to-br font-semibold text-white shadow-sm ${GRADIENTS[hash(slug) % GRADIENTS.length]} ${sizes[size]}`}
    >
      {initial}
    </span>
  );
}
