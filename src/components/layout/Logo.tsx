import markUrl from '@/assets/brand/si-mark.webp';

/** Compact app logo: the SI mark on a white tile + name. Used in the sidebar and headers. */
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={light ? 'grid size-9 shrink-0 place-items-center rounded-lg bg-white p-1 shadow-sm' : 'grid size-9 shrink-0 place-items-center rounded-lg bg-white p-1 ring-1 ring-border'}>
        <img src={markUrl} alt="" className="size-full object-contain" aria-hidden />
      </span>
      <div className="leading-tight">
        <p className={light ? 'text-[15px] font-semibold text-white' : 'text-[15px] font-semibold text-navy'}>Halmstad SI</p>
        <p className={light ? 'text-[11px] text-white/60' : 'text-[11px] text-muted'}>Supplemental Instruction</p>
      </div>
    </div>
  );
}
