import { X } from 'lucide-react';
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { amountToInput, formatMoney, parseAmountInput, ZAPPED_CURRENCY } from '../../domain/money';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-strong active:bg-accent shadow-lg shadow-accent/20',
  secondary: 'bg-surface text-fg hover:bg-surface-2 border border-line shadow-sm',
  ghost: 'bg-transparent text-fg hover:bg-surface-2',
  danger: 'bg-loss/15 text-loss border border-loss/40 hover:bg-loss/25',
  success: 'bg-gain text-white hover:brightness-110 shadow-lg shadow-gain/20',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-9 px-3 text-sm rounded-xl', md: 'h-11 px-4 text-[15px] rounded-2xl', lg: 'h-14 px-5 text-base rounded-2xl' };
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 font-semibold transition select-none disabled:opacity-40 disabled:pointer-events-none',
        VARIANTS[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cx('rounded-3xl bg-surface border border-line/70 text-left', onClick && 'transition hover:border-line active:scale-[0.99]', className)}
    >
      {children}
    </Tag>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3 mt-1">
      <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{children}</h2>
      {action}
    </div>
  );
}

export function Money({ amount, currency, className }: { amount: number; currency: string; className?: string }) {
  return <span className={cx('tabular', className)}>{formatMoney(amount, currency)}</span>;
}

export function PlayerDot({ color, size = 12 }: { color: string; size?: number }) {
  return <span className="inline-block rounded-full shrink-0 ring-2 ring-black/30" style={{ background: color, width: size, height: size }} />;
}

/** Fenêtre modale : feuille du bas sur mobile, boîte centrée sur grand écran. */
export function Sheet({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center fade-in" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Fermer" className="absolute inset-0 bg-[#0b1a24]/45 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        className={cx(
          'relative w-full max-h-[92dvh] flex flex-col bg-surface border border-line rounded-t-[28px] sm:rounded-[28px] pop-in outline-none safe-bottom',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md',
        )}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-lg font-bold">{title}</h3>
          <button type="button" onClick={onClose} className="h-9 w-9 grid place-items-center rounded-full bg-surface-2 text-muted hover:text-fg" aria-label="Fermer">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pb-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 pb-5 pt-2 border-t border-line/60 flex gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-muted mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1.5">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full h-12 rounded-2xl bg-surface-2 border border-line px-4 text-base text-fg placeholder:text-muted/60 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30';

/**
 * Saisie d'un montant. En monnaie Zapped (« KM »), on tape un nombre et on choisit
 * l'unité M (millions) ou K (milliers) : la valeur transmise est du type « 1,5M ».
 */
export function AmountInput({ value, onChange, currency, autoFocus, presets }: { value: string; onChange: (v: string) => void; currency: string; autoFocus?: boolean; presets?: number[] }) {
  const zapped = currency === ZAPPED_CURRENCY;
  const unit = /K$/i.test(value) ? 'K' : 'M';
  const num = zapped ? value.replace(/[MK]$/i, '') : value;
  const setNum = (raw: string) => {
    if (!zapped) return onChange(raw.replace(/[^0-9]/g, '').slice(0, 8));
    const cleaned = raw.replace('.', ',').replace(/[^0-9,]/g, '').replace(/,(?=.*,)/g, '').slice(0, 7);
    onChange(cleaned ? cleaned + unit : '');
  };
  return (
    <div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            className={cx(inputClass, 'text-2xl font-bold tabular h-14', !zapped && 'pr-14')}
            inputMode={zapped ? 'decimal' : 'numeric'}
            autoFocus={autoFocus}
            placeholder="0"
            value={num}
            onChange={(e) => setNum(e.target.value)}
            aria-label="Montant"
          />
          {!zapped && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted font-semibold">{currency}</span>}
        </div>
        {zapped && (
          <div className="flex rounded-2xl border border-line overflow-hidden shrink-0" role="radiogroup" aria-label="Unité">
            {(['M', 'K'] as const).map((u) => (
              <button
                key={u}
                type="button"
                role="radio"
                aria-checked={unit === u}
                onClick={() => num && onChange(num + u)}
                className={cx('w-14 h-14 text-xl font-black', unit === u ? 'bg-accent text-white' : 'bg-surface-2 text-muted')}
              >
                {u}
              </button>
            ))}
          </div>
        )}
      </div>
      {presets && (
        <div className="flex flex-wrap gap-2 mt-2">
          {presets.map((p) => (
            <button key={p} type="button" onClick={() => onChange(amountToInput(p, currency))} className="h-8 px-3 rounded-full bg-surface-3 text-sm font-semibold tabular hover:bg-line">
              {zapped ? formatMoney(p, currency) : p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function parseAmount(v: string): number | null {
  return parseAmountInput(v);
}

export function Select<T extends string | number>({ value, onChange, options, ariaLabel }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; ariaLabel: string }) {
  return (
    <select
      aria-label={ariaLabel}
      className={cx(inputClass, 'appearance-none')}
      value={String(value)}
      onChange={(e) => {
        const opt = options.find((o) => String(o.value) === e.target.value);
        if (opt) onChange(opt.value);
      }}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-center justify-between w-full gap-4 py-2 text-left">
      <span className="text-[15px]">{label}</span>
      <span className={cx('relative h-7 w-12 rounded-full transition shrink-0', checked ? 'bg-gain' : 'bg-surface-3 border border-line')}>
        <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all shadow', checked ? 'left-[22px]' : 'left-0.5')} />
      </span>
    </button>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error' | 'success'; children: ReactNode }) {
  const tones = {
    info: 'bg-[#1f6feb]/10 border-[#1f6feb]/30 text-[#163e7a]',
    warn: 'bg-gold/10 border-gold/40 text-[#6b4a00]',
    error: 'bg-loss/10 border-loss/40 text-[#8a1717]',
    success: 'bg-gain/10 border-gain/40 text-[#0d5a2a]',
  };
  return <div className={cx('rounded-2xl border px-4 py-3 text-sm leading-relaxed', tones[tone])}>{children}</div>;
}

/** Choix d'un joueur par grosses pastilles. */
export function PlayerPicker({
  players,
  value,
  onChange,
  exclude,
  allowBank,
}: {
  players: { id: string; name: string; color: string; bankrupt: boolean }[];
  value: string | null;
  onChange: (id: string | null) => void;
  exclude?: string[];
  allowBank?: boolean;
}) {
  const list = players.filter((p) => !p.bankrupt && !exclude?.includes(p.id));
  return (
    <div className="grid grid-cols-2 gap-2">
      {allowBank && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cx('h-12 rounded-2xl border px-3 flex items-center gap-2 font-semibold text-sm', value === null ? 'border-fg bg-surface-3' : 'border-line bg-surface-2')}
        >
          🏦 Banque
        </button>
      )}
      {list.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id)}
          aria-pressed={value === p.id}
          className={cx('h-12 rounded-2xl border px-3 flex items-center gap-2 font-semibold text-sm truncate', value === p.id ? 'bg-surface-3' : 'border-line bg-surface-2')}
          style={value === p.id ? { borderColor: p.color, boxShadow: `0 0 0 1px ${p.color}` } : undefined}
        >
          <PlayerDot color={p.color} />
          <span className="truncate">{p.name}</span>
        </button>
      ))}
    </div>
  );
}
