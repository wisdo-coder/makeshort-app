import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LandingPage from '../LandingPage';

describe('LandingPage', () => {
  it('renders hero headline', () => {
    render(<LandingPage onGetStarted={() => {}} />);
    expect(screen.getByText(/Turn any story into a/)).toBeDefined();
  });

  it('renders MakeShort brand in nav', () => {
    render(<LandingPage onGetStarted={() => {}} />);
    const brandElements = screen.getAllByText('MakeShort');
    expect(brandElements.length).toBeGreaterThan(0);
  });

  it('renders how it works section', () => {
    render(<LandingPage onGetStarted={() => {}} />);
    expect(screen.getByText('How it works')).toBeDefined();
    expect(screen.getByText('Paste or Type')).toBeDefined();
    expect(screen.getByText('Customize')).toBeDefined();
    expect(screen.getByText('Download & Post')).toBeDefined();
  });

  it('renders features section', () => {
    render(<LandingPage onGetStarted={() => {}} />);
    expect(screen.getByText('8 AI Voices')).toBeDefined();
    expect(screen.getByText('6 Backgrounds')).toBeDefined();
    expect(screen.getByText('5 Caption Styles')).toBeDefined();
  });

  it('renders pricing preview with all 4 plans', () => {
    render(<LandingPage onGetStarted={() => {}} />);
    expect(screen.getByText('$0')).toBeDefined();
    expect(screen.getByText('$7.99')).toBeDefined();
    expect(screen.getByText('$14.99')).toBeDefined();
    expect(screen.getByText('$24.99')).toBeDefined();
  });

  it('calls onGetStarted with login when CTA clicked', () => {
    const handler = vi.fn();
    render(<LandingPage onGetStarted={handler} />);
    const buttons = screen.getAllByText('Get Started');
    fireEvent.click(buttons[0]);
    expect(handler).toHaveBeenCalledWith('login');
  });

  it('calls onGetStarted with pricing when Pricing clicked', () => {
    const handler = vi.fn();
    render(<LandingPage onGetStarted={handler} />);
    const pricingBtn = screen.getByRole('button', { name: 'Pricing' });
    fireEvent.click(pricingBtn);
    expect(handler).toHaveBeenCalledWith('pricing');
  });

  it('renders footer with copyright', () => {
    render(<LandingPage onGetStarted={() => {}} />);
    expect(screen.getByText(/All rights reserved/)).toBeDefined();
  });
});
