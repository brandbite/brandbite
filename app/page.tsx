export default function HomePage() {
  return (
    <main className="main-shell">
      <div className="rounded-2xl bg-[color:var(--bb-surface)] px-8 py-6 shadow-xl border border-white/5 max-w-xl w-full">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400 mb-2">
          Brandbite v2025
        </p>
        <h1 className="text-3xl font-semibold mb-3">
          Design subscription portal is under construction
        </h1>
        <p className="text-sm text-slate-300">
          Şu anda çekirdek yapıyı kuruyoruz: Next.js + Tailwind 4 + Prisma +
          BetterAuth. Bir sonraki adımda admin, designer ve customer
          dashboard&rsquo;larını ekleyeceğiz.
        </p>
      </div>
    </main>
  )
}
