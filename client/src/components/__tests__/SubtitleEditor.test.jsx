import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import SubtitleEditor from '../SubtitleEditor';

const makeClip = (segments) => ({
  id: 'clip-1',
  videoId: 'v1',
  title: 'Test Clip',
  duration: 30,
  segments,
});

describe('SubtitleEditor', () => {
  it('renders nothing when clip is null', () => {
    const { container } = render(<SubtitleEditor clip={null} onRender={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows loading message when clip has no segments', () => {
    const clip = makeClip([]);
    render(<SubtitleEditor clip={clip} onRender={vi.fn()} />);
    expect(screen.getByText('Loading subtitle segments...')).toBeInTheDocument();
  });

  it('renders segment inputs when clip has segments', () => {
    const clip = makeClip([
      { word: 'Hello', start: 0, end: 0.5 },
      { word: 'world', start: 0.5, end: 1.0 },
    ]);
    render(<SubtitleEditor clip={clip} onRender={vi.fn()} />);

    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveValue('Hello');
    expect(inputs[1]).toHaveValue('world');
  });

  it('displays the clip duration', () => {
    const clip = makeClip([
      { word: 'Test', start: 0, end: 1 },
    ]);
    render(<SubtitleEditor clip={clip} onRender={vi.fn()} />);
    expect(screen.getByText('Duration: 30s')).toBeInTheDocument();
  });

  it('displays timestamps for each segment', () => {
    const clip = makeClip([
      { word: 'Foo', start: 1.23, end: 4.56 },
    ]);
    render(<SubtitleEditor clip={clip} onRender={vi.fn()} />);
    expect(screen.getByText('1.23s - 4.56s')).toBeInTheDocument();
  });

  it('allows editing a word via input', async () => {
    const clip = makeClip([
      { word: 'Helo', start: 0, end: 0.5 },
    ]);
    render(<SubtitleEditor clip={clip} onRender={vi.fn()} />);

    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'Hello');
    expect(input).toHaveValue('Hello');
  });

  it('calls onRender with updated segments when finalize button is clicked', async () => {
    const onRender = vi.fn();
    const clip = makeClip([
      { word: 'Helo', start: 0, end: 0.5 },
      { word: 'wrld', start: 0.5, end: 1.0 },
    ]);
    render(<SubtitleEditor clip={clip} onRender={onRender} />);

    // Edit first word
    const inputs = screen.getAllByRole('textbox');
    await userEvent.clear(inputs[0]);
    await userEvent.type(inputs[0], 'Hello');

    // Click render button
    const button = screen.getByRole('button', { name: /render final video/i });
    await userEvent.click(button);

    expect(onRender).toHaveBeenCalledTimes(1);
    const calledClip = onRender.mock.calls[0][0];
    expect(calledClip.segments[0].word).toBe('Hello');
    expect(calledClip.segments[1].word).toBe('wrld');
    expect(calledClip.id).toBe('clip-1');
  });

  it('updates segments when a new clip prop is provided', () => {
    const clip1 = makeClip([{ word: 'First', start: 0, end: 1 }]);
    const clip2 = makeClip([{ word: 'Second', start: 0, end: 1 }, { word: 'Word', start: 1, end: 2 }]);

    const { rerender } = render(<SubtitleEditor clip={clip1} onRender={vi.fn()} />);
    expect(screen.getAllByRole('textbox')).toHaveLength(1);

    rerender(<SubtitleEditor clip={clip2} onRender={vi.fn()} />);
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    expect(screen.getAllByRole('textbox')[0]).toHaveValue('Second');
  });
});
