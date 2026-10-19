import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'success' | 'info' | 'warning';
interface Toast { id: number; title: string; body?: string; tone: Tone }
const Ctx = createContext<(t: Omit<Toast, 'id' | 'tone'> & { tone?: Tone }) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, 'id' | 'tone'> & { tone?: Tone }) => {
    const id = Date.now() + Math.random();
    setToasts((x) => [...x.slice(-2), { id, tone: 'success', ...t }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 4500);
  }, []);
  const Icon = { success: CheckCircle2, info: Info, warning: AlertTriangle };
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => {
          const I = Icon[t.tone];
          return (
            <div key={t.id} className="flex items-start gap-3 rounded-xl border border-border bg-white p-3.5 shadow-lg">
              <I className={cn('mt-0.5 size-5 shrink-0', t.tone === 'success' ? 'text-success' : t.tone === 'warning' ? 'text-warning' : 'text-teal')} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-navy">{t.title}</p>
                {t.body ? <p className="mt-0.5 text-sm text-muted">{t.body}</p> : null}
              </div>
              <button className="text-muted hover:text-navy" aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}><X className="size-4" /></button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
