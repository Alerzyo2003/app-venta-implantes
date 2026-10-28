import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import type { FormState } from '@/lib/forms';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const BADGE_TONES: Record<Tone, string> = {
  neutral: 'bg-subtle text-fg-muted',
  success: 'bg-success-surface text-success',
  warning: 'bg-warning-surface text-warning',
  danger: 'bg-danger-surface text-danger',
  info: 'bg-info-surface text-info',
  accent: 'bg-subtle text-accent-text',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

const ALERT_TONES: Record<Exclude<Tone, 'neutral' | 'accent'>, { box: string; icon: typeof Info }> = {
  success: { box: 'border-success/30 bg-success-surface text-success', icon: CircleCheck },
  warning: { box: 'border-warning/30 bg-warning-surface text-warning', icon: TriangleAlert },
  danger: { box: 'border-danger/30 bg-danger-surface text-danger', icon: CircleAlert },
  info: { box: 'border-info/30 bg-info-surface text-info', icon: Info },
};

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: keyof typeof ALERT_TONES;
  title?: ReactNode;
  children?: ReactNode;
}) {
  const { box, icon: Icon } = ALERT_TONES[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`flex gap-3 rounded-lg border px-4 py-3 text-sm ${box}`}>
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="flex flex-col gap-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-fg">{children}</div> : null}
      </div>
    </div>
  );
}

/** Resultado de una acción del servidor, anunciado a lectores de pantalla. */
export function FormMessage({ state }: { state: FormState }) {
  return (
    <div aria-live="polite">
      {state.status === 'error' && state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      {state.status === 'success' && state.message ? <Alert tone="success">{state.message}</Alert> : null}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-card px-6 py-12 text-center">
      <p className="text-base font-semibold text-fg">{title}</p>
      {children ? <div className="max-w-md text-sm text-fg-muted">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
