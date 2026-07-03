import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock socket.io-client before importing the component
vi.mock('socket.io-client', () => {
  const listeners = {};
  const mockSocket = {
    on: vi.fn((event, cb) => { listeners[event] = cb; }),
    disconnect: vi.fn(),
    _listeners: listeners,
  };
  return {
    io: vi.fn(() => mockSocket),
    __mockSocket: mockSocket,
  };
});

import ProgressBar from '../ProgressBar';
import { __mockSocket } from 'socket.io-client';

describe('ProgressBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders initial status and 0% progress', () => {
    render(<ProgressBar />);
    expect(screen.getByText('Initializing rendering engine...')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('renders the pro tip text', () => {
    render(<ProgressBar />);
    expect(screen.getByText(/shorter clips render exponentially faster/i)).toBeInTheDocument();
  });

  it('registers socket event listeners on mount', () => {
    render(<ProgressBar />);
    expect(__mockSocket.on).toHaveBeenCalledWith('render-progress', expect.any(Function));
    expect(__mockSocket.on).toHaveBeenCalledWith('render-status', expect.any(Function));
    expect(__mockSocket.on).toHaveBeenCalledWith('render-error', expect.any(Function));
  });

  it('disconnects socket on unmount', () => {
    const { unmount } = render(<ProgressBar />);
    unmount();
    expect(__mockSocket.disconnect).toHaveBeenCalled();
  });
});
