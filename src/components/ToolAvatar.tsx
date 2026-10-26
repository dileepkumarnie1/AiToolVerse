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

/** Monogram avatar: no third-party logo requests, consistent look, never broken. */
export default function ToolAvatar({ slug, name, size = 'md' }: { slug: string; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-8 w-8 text-sm rounded-lg', md: 'h-11 w-11 text-base rounded-xl', lg: 'h-16 w-16 text-2xl rounded-2xl' };
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
