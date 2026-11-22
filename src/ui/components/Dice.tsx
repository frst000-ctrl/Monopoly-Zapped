import { cx } from './ui';

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
};

export function Die({ value, rolling, size = 72 }: { value: number | null; rolling?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={cx('drop-shadow-[0_8px_16px_rgba(0,0,0,0.45)]', rolling && 'dice-rolling')}
      role="img"
      aria-label={value ? `Dé : ${value}` : 'Dé'}
    >
      <rect x="4" y="4" width="92" height="92" rx="22" fill="#fbfbfd" stroke="#d9dbe3" strokeWidth="2" />
      {value
        ? PIPS[value]?.map(([cx_, cy], i) => <circle key={i} cx={cx_} cy={cy} r="9" fill={value === 1 ? '#e0262f' : '#141821'} />)
        : <text x="50" y="62" textAnchor="middle" fontSize="34" fill="#b6bac6" fontWeight="700">?</text>}
    </svg>
  );
}
