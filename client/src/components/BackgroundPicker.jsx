import React from 'react';

const BACKGROUNDS = [
  { id: 'minecraft-parkour', name: 'Minecraft Parkour', category: 'Gaming', emoji: '🎮' },
  { id: 'subway-surfers', name: 'Subway Surfers', category: 'Gaming', emoji: '🏃' },
  { id: 'satisfying-soap', name: 'Soap Cutting', category: 'Satisfying', emoji: '🧼' },
  { id: 'gta-driving', name: 'GTA Driving', category: 'Gaming', emoji: '🚗' },
  { id: 'cooking-asmr', name: 'Cooking ASMR', category: 'Lifestyle', emoji: '🍳' },
  { id: 'nature-timelapse', name: 'Nature', category: 'Nature', emoji: '🌿' },
];

function BackgroundPicker({ selectedBackground, onSelect }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-2">Background Video</label>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {BACKGROUNDS.map((bg) => (
          <button
            key={bg.id}
            onClick={() => onSelect(bg.id)}
            className={`p-3 rounded-xl text-center transition-all border ${
              selectedBackground === bg.id
                ? 'bg-emerald-600/20 border-emerald-500 ring-1 ring-emerald-500'
                : 'bg-gray-950 border-gray-700 hover:border-gray-500'
            }`}
          >
            <span className="text-2xl block mb-1">{bg.emoji}</span>
            <p className="text-[10px] sm:text-xs font-bold text-white leading-tight">{bg.name}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default BackgroundPicker;
