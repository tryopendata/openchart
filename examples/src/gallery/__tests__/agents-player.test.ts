/**
 * Characterization tests for the agent replay player (AgentReplay, Conversation,
 * SpecPane). They pin rendered structure, text, the still/reduced-motion
 * output, keyboard-reachable controls, and the props the story uses, so the
 * player can move onto a shared implementation without changing behavior.
 * The chart itself is stubbed: what matters here is which spec object the
 * stage receives, and that it stays the same object while it is current.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const seenSpecs: unknown[] = [];

vi.mock('@opendata-ai/openchart-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@opendata-ai/openchart-react')>();
  const { createElement: h } = await import('react');
  return {
    ...actual,
    Visualization: ({ spec }: { spec: { chrome?: { title?: string } } }) => {
      seenSpecs.push(spec);
      return h('div', { 'data-testid': 'viz' }, spec.chrome?.title ?? 'untitled');
    },
  };
});

import { AgentReplay } from '../agents/AgentReplay';
import { buildTimeline } from '../agents/replay';
import { chatAnalyst, dashboardBuilder } from '../agents/scenarios';

function setReducedMotion(reduced: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/** Whether the player counts as scrolled into view; the playback gate only runs while it is. */
let inView = false;

class FakeObserver {
  constructor(private cb: IntersectionObserverCallback) {}
  observe(el: Element) {
    this.cb(
      [{ isIntersecting: inView, target: el, intersectionRatio: inView ? 1 : 0 }] as never,
      this as never,
    );
  }
  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
}

beforeEach(() => {
  seenSpecs.length = 0;
  inView = false;
  setReducedMotion(false);
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeObserver;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const chatTimeline = buildTimeline(chatAnalyst);

describe('final render (visual-baseline mode)', () => {
  it('shows the finished chat session with no playback controls', () => {
    render(createElement(AgentReplay, { scenario: chatAnalyst, layout: 'single', final: true }));

    expect(
      screen.getByText(/Scripted replay · validation, diffs, and rendering run live/),
    ).toBeTruthy();
    // Still mode: no Play/Pause/Replay and no speed toggle; turn jumps and Next stay.
    expect(screen.queryByRole('button', { name: /^(Play|Pause|Replay)$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Playback speed/ })).toBeNull();
    const turns = within(screen.getByRole('group', { name: 'Jump to turn' })).getAllByRole(
      'button',
    );
    expect(turns.map((b) => b.textContent)).toEqual(['1', '2', '3']);
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);

    // All three user turns, the rejected spec and the repaired one are visible.
    const convo = screen.getByRole('region', { name: 'Agent transcript' });
    for (const turn of chatAnalyst.turns) expect(within(convo).getByText(turn.user)).toBeTruthy();
    expect(within(convo).getByText(/validateSpec rejected it · nothing rendered/)).toBeTruthy();
    expect(
      within(convo).getByText(
        'The previous chart stays on screen. The error goes back to the model.',
      ),
    ).toBeTruthy();
    expect(within(convo).getByText(/repairing from validator feedback/)).toBeTruthy();
    expect(within(convo).getAllByText(/validateSpec passed · rendered with 15 rows/).length).toBe(
      3,
    );

    // The stage renders the last valid chart (the callout turn), and the spec pane shows a diff.
    expect(screen.getByTestId('viz').textContent).toContain('Solar Added More Capacity');
    expect(screen.getByText('What changed')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Full spec' })).toBeTruthy();
  });

  it('shows all four dashboard panels in the dashboard layout', () => {
    const { container } = render(
      createElement(AgentReplay, { scenario: dashboardBuilder, layout: 'dashboard', final: true }),
    );
    expect(container.querySelector('.oca-player.oca-layout-dashboard')).toBeTruthy();
    expect(container.querySelector('.oca-dash-wrap')).toBeTruthy();
    const convo = screen.getByRole('region', { name: 'Agent transcript' });
    expect(within(convo).getByText('MRR has nearly tripled', { exact: false })).toBeTruthy();
  });

  it('marks the last turn as current', () => {
    render(createElement(AgentReplay, { scenario: chatAnalyst, layout: 'single', final: true }));
    const turns = within(screen.getByRole('group', { name: 'Jump to turn' })).getAllByRole(
      'button',
    );
    expect(turns.map((b) => b.getAttribute('aria-current'))).toEqual([null, null, 'step']);
  });
});

describe('reduced motion', () => {
  it('starts on the finished first turn, with no motion controls', () => {
    setReducedMotion(true);
    render(createElement(AgentReplay, { scenario: chatAnalyst, layout: 'single' }));
    const convo = screen.getByRole('region', { name: 'Agent transcript' });
    expect(within(convo).getByText(chatAnalyst.turns[0].user)).toBeTruthy();
    expect(within(convo).queryByText(chatAnalyst.turns[1].user)).toBeNull();
    expect(screen.queryByRole('button', { name: /^(Play|Pause|Replay)$/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Playback speed/ })).toBeNull();
    expect(screen.getByTestId('viz')).toBeTruthy();
  });

  it('jumps to the finished state of the chosen turn', () => {
    setReducedMotion(true);
    render(createElement(AgentReplay, { scenario: chatAnalyst, layout: 'single' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    const convo = screen.getByRole('region', { name: 'Agent transcript' });
    expect(within(convo).getByText(chatAnalyst.turns[1].user)).toBeTruthy();
    expect(within(convo).queryByText(chatAnalyst.turns[2].user)).toBeNull();
    expect(within(convo).getByText(/validateSpec rejected it/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '2' }).getAttribute('aria-current')).toBe('step');
  });
});

describe('playback controls', () => {
  // Intentional library behavior: the session autoplays when it scrolls into
  // view and only runs while it is in view (the old player kept going once
  // started, even offscreen).
  it('sits at the start, not playing, until it scrolls into view', () => {
    vi.useFakeTimers();
    render(createElement(AgentReplay, { scenario: chatAnalyst, layout: 'single' }));
    const convo = screen.getByRole('region', { name: 'Agent transcript' });
    expect(within(convo).getByText(chatAnalyst.turns[0].user)).toBeTruthy();
    expect(within(convo).queryByText(chatAnalyst.turns[1].user)).toBeNull();
    expect(screen.getByText("The agent's spec streams here.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
    // Controls still read as the start: nothing is current and Next is available.
    expect(screen.getByRole('button', { name: '3' }).getAttribute('aria-current')).toBeNull();
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('autoplays from the start once in view, pauses, and toggles speed', () => {
    vi.useFakeTimers();
    inView = true;
    render(createElement(AgentReplay, { scenario: chatAnalyst, layout: 'single' }));
    const convo = screen.getByRole('region', { name: 'Agent transcript' });
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    expect(within(convo).getByText(chatAnalyst.turns[0].user)).toBeTruthy();
    expect(within(convo).queryByText(chatAnalyst.turns[1].user)).toBeNull();
    expect(screen.getByText("The agent's spec streams here.")).toBeTruthy();

    const speed = screen.getByRole('button', { name: 'Playback speed 1x' });
    expect(speed.textContent).toBe('1x');
    fireEvent.click(speed);
    expect(screen.getByRole('button', { name: 'Playback speed 2x' }).textContent).toBe('2x');

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(within(convo).getByText(chatAnalyst.turns[0].user)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
  });

  it('plays to the end, then offers Replay and disables Next', () => {
    vi.useFakeTimers();
    inView = true;
    render(createElement(AgentReplay, { scenario: chatAnalyst, layout: 'single' }));
    // Ticks cap each step at 250ms of session time, so walk the clock in small hops.
    const hops = Math.ceil(chatTimeline.total / 250) + 20;
    for (let i = 0; i < hops; i++) {
      act(() => {
        vi.advanceTimersByTime(250);
      });
    }
    expect(screen.getByRole('button', { name: 'Replay' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: '3' }).getAttribute('aria-current')).toBe('step');
  });

  it('turn buttons jump to the start of that turn and start playing', () => {
    vi.useFakeTimers();
    inView = true;
    render(createElement(AgentReplay, { scenario: chatAnalyst, layout: 'single' }));
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    const convo = screen.getByRole('region', { name: 'Agent transcript' });
    expect(within(convo).getByText(chatAnalyst.turns[2].user)).toBeTruthy();
    expect(screen.getByRole('button', { name: '3' }).getAttribute('aria-current')).toBe('step');
  });

  it('Next from the start moves to turn 2', () => {
    vi.useFakeTimers();
    render(createElement(AgentReplay, { scenario: chatAnalyst, layout: 'single' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: '2' }).getAttribute('aria-current')).toBe('step');
  });
});

describe('transcript and keyboard', () => {
  it('makes the transcript and spec pane focusable scroll regions', () => {
    const { container } = render(
      createElement(AgentReplay, { scenario: chatAnalyst, layout: 'single', final: true }),
    );
    expect(screen.getByRole('region', { name: 'Agent transcript' }).getAttribute('tabindex')).toBe(
      '0',
    );
    expect(container.querySelector('pre.oca-pane-body')?.getAttribute('tabindex')).toBe('0');
  });

  it('announces finished beats through a polite live region and keeps streaming silent', () => {
    const { container } = render(
      createElement(AgentReplay, { scenario: chatAnalyst, layout: 'single', final: true }),
    );
    const live = container.querySelector('.oca-sr-only[aria-live="polite"]');
    expect(live?.textContent).toBe(
      chatAnalyst.turns[2].steps.at(-1) &&
        (chatAnalyst.turns[2].steps.at(-1) as { text: string }).text,
    );
  });

  it('uses real buttons for every control, so Enter and Space work natively', () => {
    const { container } = render(
      createElement(AgentReplay, { scenario: chatAnalyst, layout: 'single', final: true }),
    );
    const controls = container.querySelectorAll('.oca-toolbar .oca-turn, .oca-toolbar .oca-btn');
    expect(controls.length).toBe(4);
    for (const el of controls) {
      expect(el.tagName).toBe('BUTTON');
      expect(el.getAttribute('type')).toBe('button');
    }
  });

  it('toggles the spec pane between diff and full spec', () => {
    render(createElement(AgentReplay, { scenario: chatAnalyst, layout: 'single', final: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Full spec' }));
    expect(screen.getByText('Spec')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show diff' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show diff' }));
    expect(screen.getByText('What changed')).toBeTruthy();
  });
});

describe('stage updates in place', () => {
  it('hands the stage the same spec object across re-renders while it is current', () => {
    render(createElement(AgentReplay, { scenario: chatAnalyst, layout: 'single', final: true }));
    const first = seenSpecs.at(-1);
    fireEvent.click(screen.getByRole('button', { name: 'Full spec' }));
    expect(seenSpecs.at(-1)).toBe(first);
  });

  it('swaps the stage spec when a different turn is selected', () => {
    setReducedMotion(true);
    render(createElement(AgentReplay, { scenario: chatAnalyst, layout: 'single' }));
    const turn1 = seenSpecs.at(-1);
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(seenSpecs.at(-1)).not.toBe(turn1);
  });
});
