// TODO(K11): Wire up bambooit design tokens (bg-paper, text-navy-deep,
// text-green-deep, font-display) from RULES.md §9.5 in Tailwind config.
// Until then this placeholder uses generic Tailwind utility classes.

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="max-w-2xl text-center space-y-6 p-8">
        <h1 className="font-serif text-5xl md:text-7xl font-black tracking-tight text-slate-900">
          ba<span className="text-emerald-600 italic">m</span>boo<span className="text-emerald-600 italic">it</span>
        </h1>
        <p className="text-xl text-slate-600">
          Stała opieka IT, strony, aplikacje i automatyzacje dla małych firm.
        </p>
        <p className="font-mono text-sm uppercase tracking-widest text-slate-600">
          Strona w przebudowie
        </p>
      </div>
    </div>
  );
}
