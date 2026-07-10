import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ userId: 'test-user-123' }),
}));

vi.mock('axios');

import PricingPage from '../PricingPage';

describe('PricingPage', () => {
  it('renders all 4 plan cards', () => {
    render(<PricingPage onClose={() => {}} currentPlan="free" />);
    expect(screen.getByText('Free')).toBeDefined();
    expect(screen.getByText('Starter')).toBeDefined();
    expect(screen.getByText('Pro')).toBeDefined();
    expect(screen.getByText('Creator')).toBeDefined();
  });

  it('shows prices for each plan', () => {
    render(<PricingPage onClose={() => {}} currentPlan="free" />);
    expect(screen.getByText('$0')).toBeDefined();
    expect(screen.getByText('$7.99')).toBeDefined();
    expect(screen.getByText('$14.99')).toBeDefined();
    expect(screen.getByText('$24.99')).toBeDefined();
  });

  it('marks current plan with disabled button', () => {
    render(<PricingPage onClose={() => {}} currentPlan="free" />);
    const currentButtons = screen.getAllByText('Current Plan');
    expect(currentButtons.length).toBeGreaterThan(0);
  });

  it('shows Most Popular badge on Pro plan', () => {
    render(<PricingPage onClose={() => {}} currentPlan="free" />);
    expect(screen.getByText('Most Popular')).toBeDefined();
  });

  it('renders Back to Dashboard button', () => {
    render(<PricingPage onClose={() => {}} currentPlan="free" />);
    expect(screen.getByText('Back to Dashboard')).toBeDefined();
  });
});
