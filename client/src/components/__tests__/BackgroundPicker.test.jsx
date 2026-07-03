import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BackgroundPicker from '../BackgroundPicker';

describe('BackgroundPicker', () => {
  it('renders all background options', () => {
    render(<BackgroundPicker selectedBackground="minecraft-parkour" onSelect={() => {}} />);
    expect(screen.getByText('Minecraft Parkour')).toBeInTheDocument();
    expect(screen.getByText('Subway Surfers')).toBeInTheDocument();
    expect(screen.getByText('Cooking ASMR')).toBeInTheDocument();
  });

  it('highlights the selected background', () => {
    render(<BackgroundPicker selectedBackground="gta-driving" onSelect={() => {}} />);
    const gtaButton = screen.getByText('GTA Driving').closest('button');
    expect(gtaButton.className).toContain('border-emerald-500');
  });

  it('calls onSelect when a background is clicked', () => {
    const onSelect = vi.fn();
    render(<BackgroundPicker selectedBackground="minecraft-parkour" onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Nature'));
    expect(onSelect).toHaveBeenCalledWith('nature-timelapse');
  });
});
