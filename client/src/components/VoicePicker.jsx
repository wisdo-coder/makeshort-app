import React from 'react';

const VOICES = [
  { id: 'aura-orion-en', name: 'Orion', gender: 'Male', age: 'Young', accent: 'American', style: 'Clear & Confident' },
  { id: 'aura-luna-en', name: 'Luna', gender: 'Female', age: 'Young', accent: 'American', style: 'Warm & Friendly' },
  { id: 'aura-stella-en', name: 'Stella', gender: 'Female', age: 'Mid', accent: 'American', style: 'Calm & Professional' },
  { id: 'aura-arcas-en', name: 'Arcas', gender: 'Male', age: 'Mid', accent: 'American', style: 'Deep & Authoritative' },
  { id: 'aura-perseus-en', name: 'Perseus', gender: 'Male', age: 'Young', accent: 'American', style: 'Energetic' },
  { id: 'aura-angus-en', name: 'Angus', gender: 'Male', age: 'Mid', accent: 'Irish', style: 'Storytelling' },
  { id: 'aura-athena-en', name: 'Athena', gender: 'Female', age: 'Young', accent: 'British', style: 'Crisp & Articulate' },
  { id: 'aura-helios-en', name: 'Helios', gender: 'Male', age: 'Young', accent: 'British', style: 'Smooth & Narrative' },
];

function VoicePicker({ selectedVoice, onSelect }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-2">Choose AI Voice</label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {VOICES.map((voice) => (
          <button
            key={voice.id}
            onClick={() => onSelect(voice.id)}
            className={`p-3 rounded-xl text-left transition-all border ${
              selectedVoice === voice.id
                ? 'bg-blue-600/20 border-blue-500 ring-1 ring-blue-500'
                : 'bg-gray-950 border-gray-700 hover:border-gray-500'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{voice.gender === 'Male' ? '🎙️' : '🎤'}</span>
              <span className="text-sm font-bold text-white">{voice.name}</span>
            </div>
            <p className="text-[10px] text-gray-400">{voice.accent} · {voice.age}</p>
            <p className="text-[10px] text-gray-500">{voice.style}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default VoicePicker;
