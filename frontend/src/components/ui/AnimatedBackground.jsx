function AnimatedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-slate-50 dark:bg-[#030712]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.92),rgba(224,242,254,0.62),rgba(248,250,252,0.95))] dark:bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_32%),linear-gradient(135deg,#020617,#07111f_42%,#081826)]" />
      <div className="absolute inset-0 opacity-[0.28] dark:opacity-[0.18] bg-[linear-gradient(rgba(14,165,233,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.25)_1px,transparent_1px)] bg-[size:58px_58px]" />
      <div className="particle-field">
        {Array.from({ length: 18 }).map((_, index) => (
          <span
            // The index only seeds a decorative particle position; the list never reorders.
            key={index}
            style={{
              '--delay': `${index * 0.42}s`,
              '--left': `${(index * 17) % 100}%`,
              '--size': `${3 + (index % 4)}px`,
              '--top': `${(index * 23) % 100}%`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default AnimatedBackground
