export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" fill={light ? '#FFFFFF' : '#12304A'} fillOpacity={light ? 0.1 : 1} />
        <path d="M9 21c3 2 11 2 14-1M10 12h12M10 16h8" stroke="#00A3AC" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </svg>
      <div className="leading-tight">
        <p className={light ? 'text-[15px] font-semibold text-white' : 'text-[15px] font-semibold text-navy'}>Halmstad SI</p>
        <p className={light ? 'text-[11px] text-white/60' : 'text-[11px] text-muted'}>Supplemental Instruction</p>
      </div>
    </div>
  );
}
