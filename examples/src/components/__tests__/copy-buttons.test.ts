/**
 * Characterization of the gallery's copy-to-clipboard buttons: label flips to
 * the copied state after a successful write and back after the 1400ms reset.
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Theming } from '../../gallery/features-theming.stories';
import { Demo } from '../Demo';
import { Section } from '../Section';

let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('Section anchor button', () => {
  it('copies the section link, shows the copied label, resets after 1400ms', async () => {
    render(createElement(Section, { id: 'intro', title: 'Intro' }));
    await click(screen.getByRole('button', { name: 'Copy link to "Intro"' }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0]?.[0]).toMatch(/#intro$/);
    const btn = screen.getByRole('button', { name: 'Link copied' });
    expect(btn.getAttribute('title')).toBe('Link copied');

    await advance(1399);
    expect(screen.queryByRole('button', { name: 'Link copied' })).not.toBeNull();
    await advance(1);
    expect(screen.queryByRole('button', { name: 'Link copied' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy link to "Intro"' }).getAttribute('title')).toBe(
      'Copy link to this section',
    );
  });

  it('stays idle when the clipboard write rejects', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    render(createElement(Section, { id: 'intro', title: 'Intro' }));
    await click(screen.getByRole('button', { name: 'Copy link to "Intro"' }));
    expect(screen.queryByRole('button', { name: 'Link copied' })).toBeNull();
  });
});

describe('Demo link and spec buttons', () => {
  const spec = {
    type: 'chart',
    mark: 'bar',
    data: [{ a: 'x', b: 1 }],
    encoding: { x: { field: 'a', type: 'nominal' }, y: { field: 'b', type: 'quantitative' } },
  } as never;
  const props = { id: 'demo', title: 'Demo', specForPanel: spec, children: null };

  it('link copy shows the link state only and resets after 1400ms', async () => {
    render(createElement(Demo, props));
    await click(screen.getByRole('button', { name: 'Copy link to "Demo"' }));
    expect(writeText.mock.calls[0]?.[0]).toMatch(/#demo$/);
    expect(screen.queryByRole('button', { name: 'Link copied' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull();
    await advance(1400);
    expect(screen.queryByRole('button', { name: 'Link copied' })).toBeNull();
  });

  it('spec copy shows the spec state only and resets after 1400ms', async () => {
    render(createElement(Demo, props));
    await click(screen.getByRole('button', { name: 'Copy spec' }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Copied' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Link copied' })).toBeNull();
    await advance(1399);
    expect(screen.queryByRole('button', { name: 'Copied' })).not.toBeNull();
    await advance(1);
    expect(screen.queryByRole('button', { name: 'Copy spec' })).not.toBeNull();
  });

  it('copying the spec after the link replaces the link state', async () => {
    render(createElement(Demo, props));
    await click(screen.getByRole('button', { name: 'Copy link to "Demo"' }));
    await click(screen.getByRole('button', { name: 'Copy spec' }));
    expect(screen.queryByRole('button', { name: 'Copied' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Link copied' })).toBeNull();
    await advance(1400);
    expect(screen.queryByRole('button', { name: 'Copy spec' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy link to "Demo"' })).not.toBeNull();
  });
});

describe('Theming JsonPanel copy button', () => {
  it('copies the JSON, shows Copied, resets after 1400ms', async () => {
    // Demo mounts its children lazily; without an observer it mounts at once.
    vi.stubGlobal('IntersectionObserver', undefined);
    render(createElement(Theming));
    const [first] = screen.getAllByRole('button', { name: 'Copy ThemeConfig' });
    await click(first as HTMLElement);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button', { name: 'Copied' })).toHaveLength(1);
    await advance(1399);
    expect(screen.getAllByRole('button', { name: 'Copied' })).toHaveLength(1);
    await advance(1);
    expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull();
  });
});
