import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import VoicePicker from '../VoicePicker';

describe('VoicePicker', () => {
  it('renders all 8 voice options', () => {
    render(<VoicePicker selectedVoice="aura-orion-en" onSelect={() => {}} />);
    expect(screen.getByText('Orion')).toBeInTheDocument();
    expect(screen.getByText('Luna')).toBeInTheDocument();
    expect(screen.getByText('Stella')).toBeInTheDocument();
    expect(screen.getByText('Arcas')).toBeInTheDocument();
    expect(screen.getByText('Athena')).toBeInTheDocument();
    expect(screen.getByText('Helios')).toBeInTheDocument();
  });

  it('highlights the selected voice', () => {
    const { container } = render(<VoicePicker selectedVoice="aura-luna-en" onSelect={() => {}} />);
    const lunaButton = screen.getByText('Luna').closest('button');
    expect(lunaButton.className).toContain('border-blue-500');
  });

  it('calls onSelect when a voice is clicked', () => {
    const onSelect = vi.fn();
    render(<VoicePicker selectedVoice="aura-orion-en" onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Athena'));
    expect(onSelect).toHaveBeenCalledWith('aura-athena-en');
  });
});
