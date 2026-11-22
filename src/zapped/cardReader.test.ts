import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CardReaderCore, type ReaderEvent } from './cardReader';

const card = [{ x: 100, y: 100 }, { x: 160, y: 100 }, { x: 100, y: 130 }];

describe('lecteur de carte global', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const events: ReaderEvent[] = [];
    const core = new CardReaderCore((e) => events.push(e));
    const cards = () => events.filter((e) => e.type === 'card');
    return { core, cards };
  };

  it('lit une carte posée et immobile', () => {
    const { core, cards } = setup();
    core.update(card);
    vi.advanceTimersByTime(399);
    expect(cards()).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(cards()).toHaveLength(1);
    expect(core.cardGesture).toBe(true);
  });

  it('ignore un ou deux doigts', () => {
    const { core, cards } = setup();
    core.update([{ x: 1, y: 1 }]);
    core.update([{ x: 1, y: 1 }, { x: 50, y: 50 }]);
    vi.advanceTimersByTime(2000);
    expect(cards()).toHaveLength(0);
    expect(core.cardGesture).toBe(false);
  });

  it('une seule lecture tant que la carte n’est pas retirée', () => {
    const { core, cards } = setup();
    core.update(card);
    vi.advanceTimersByTime(500);
    core.update(card.map((p) => ({ x: p.x + 1, y: p.y })));
    vi.advanceTimersByTime(1000);
    expect(cards()).toHaveLength(1);
    core.update([]);
    core.update(card);
    vi.advanceTimersByTime(500);
    expect(cards()).toHaveLength(2);
  });

  it('se réarme sur un nouveau geste même si la fin du précédent a été perdue', () => {
    const { core, cards } = setup();
    core.update(card);
    vi.advanceTimersByTime(500);
    // pas de update([]) : le touchend n'est jamais arrivé
    core.reset();
    core.update(card);
    vi.advanceTimersByTime(500);
    expect(cards()).toHaveLength(2);
  });

  it('attend que la carte soit immobile', () => {
    const { core, cards } = setup();
    core.update(card);
    vi.advanceTimersByTime(300);
    core.update(card.map((p) => ({ x: p.x + 40, y: p.y })));
    vi.advanceTimersByTime(300);
    expect(cards()).toHaveLength(0);
    vi.advanceTimersByTime(100);
    expect(cards()).toHaveLength(1);
  });
});
