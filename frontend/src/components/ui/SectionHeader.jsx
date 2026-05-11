function SectionHeader({ eyebrow, title, description, align = 'left' }) {
  return (
    <div className={`mb-8 max-w-3xl ${align === 'center' ? 'mx-auto text-center' : ''}`}>
      {eyebrow ? (
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-cyan-600 dark:text-cyan-300">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white md:text-4xl">{title}</h2>
      {description ? <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">{description}</p> : null}
    </div>
  )
}

export default SectionHeader
