import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: {
        planId: 'free',
        planName: 'Free',
        videosUsed: 1,
        videosLimit: 2,
        periodEnd: null,
      },
    }),
  },
}));

import UsageBar from '../UsageBar';

describe('UsageBar', () => {
  it('renders without crashing when no userId', () => {
    const { container } = render(<UsageBar userId={null} onUpgrade={() => {}} />);
    expect(container).toBeDefined();
  });

  it('renders with userId and fetches usage', async () => {
    render(<UsageBar userId="test-user" onUpgrade={() => {}} />);
    const axios = (await import('axios')).default;
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/stripe/usage?userId=test-user')
    );
  });
});
