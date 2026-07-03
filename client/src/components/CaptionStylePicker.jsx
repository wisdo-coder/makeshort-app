import React from 'react';

const CAPTION_STYLES = [
  { id: 'classic-yellow', name: 'Classic Yellow', preview: 'text-yellow-400', bgPreview: 'bg-transparent' },
  { id: 'clean-white', name: 'Clean White', preview: 'text-white', bgPreview: 'bg-black/50' },
  { id: 'neon-green', name: 'Neon Green', preview: 'text-green-400', bgPreview: 'bg-transparent' },
  { id: 'fire-red', name: 'Fire Red', preview: 'text-red-500', bgPreview: 'bg-transparent' },
  { id: 'ocean-blue', name: 'Ocean Blue', preview: 'text-blue-400', bgPreview: 'bg-transparent' },
];

function CaptionStylePicker({ selectedStyle, onSelect }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-2">Caption Style</label>
      <div className="flex gap-2 flex-wrap">
        {CAPTION_STYLES.map((style) => (
          <button
            key={style.id}
            onClick={() => onSelect(style.id)}
            className={`px-4 py-2 rounded-xl transition-all border flex items-center gap-2 ${
              selectedStyle === style.id
                ? 'bg-purple-600/20 border-purple-500 ring-1 ring-purple-500'
                : 'bg-gray-950 border-gray-700 hover:border-gray-500'
            }`}
          >
            <span className={`font-black text-sm ${style.preview} ${style.bgPreview} px-1 rounded`}>
              Aa
            </span>
            <span className="text-xs text-white font-medium">{style.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default CaptionStylePicker;
