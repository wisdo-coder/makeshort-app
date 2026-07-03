import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CaptionStylePicker from '../CaptionStylePicker';

describe('CaptionStylePicker', () => {
  it('renders all caption style options', () => {
    render(<CaptionStylePicker selectedStyle="classic-yellow" onSelect={() => {}} />);
    expect(screen.getByText('Classic Yellow')).toBeInTheDocument();
    expect(screen.getByText('Clean White')).toBeInTheDocument();
    expect(screen.getByText('Neon Green')).toBeInTheDocument();
    expect(screen.getByText('Fire Red')).toBeInTheDocument();
    expect(screen.getByText('Ocean Blue')).toBeInTheDocument();
  });

  it('highlights the selected style', () => {
    render(<CaptionStylePicker selectedStyle="neon-green" onSelect={() => {}} />);
    const greenButton = screen.getByText('Neon Green').closest('button');
    expect(greenButton.className).toContain('border-purple-500');
  });

  it('calls onSelect when a style is clicked', () => {
    const onSelect = vi.fn();
    render(<CaptionStylePicker selectedStyle="classic-yellow" onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Fire Red'));
    expect(onSelect).toHaveBeenCalledWith('fire-red');
  });
});
