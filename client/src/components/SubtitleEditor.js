import React, { useState, useEffect } from 'react';

const SubtitleEditor = ({ clip, onRender }) => {
  // We keep a local copy of the segments so the user can edit them freely
  const [editedSegments, setEditedSegments] = useState([]);

  // Whenever the user selects a new clip, load its segments into our editor state
  useEffect(() => {
    if (clip && clip.segments) {
      setEditedSegments([...clip.segments]);
    }
  }, [clip]);

  // Handle changing the text of a specific word
  const handleTextChange = (index, newText) => {
    const updated = [...editedSegments];
    updated[index].word = newText;
    setEditedSegments(updated);
  };

  // Package the edited segments back into the clip object and send it to App.js
  const handleFinalize = () => {
    const finalizedClip = {
      ...clip,
      segments: editedSegments
    };
    onRender(finalizedClip);
  };

  if (!clip || editedSegments.length === undefined) return null;

  return (
    <div className="bg-gray-900 p-8 rounded-2xl border border-gray-800 shadow-xl max-w-3xl mx-auto">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h3 className="text-2xl font-bold text-blue-400">Review Subtitles</h3>
          <p className="text-gray-400 text-sm mt-1">Fix any AI typos before burning the final video.</p>
        </div>
        <div className="text-right">
          <span className="text-sm font-mono bg-gray-800 px-3 py-1 rounded-lg text-emerald-400">
            Duration: {clip.duration}s
          </span>
        </div>
      </div>

      {/* The Timeline Editor */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-4 custom-scrollbar mb-8">
        {editedSegments.map((segment, index) => (
          <div key={index} className="flex gap-4 items-center bg-gray-950 p-4 rounded-xl border border-gray-800 hover:border-blue-500/50 transition">
            <span className="text-xs text-gray-500 font-mono w-24 text-right">
              {segment.start.toFixed(2)}s - {segment.end.toFixed(2)}s
            </span>
            <input
              type="text"
              value={segment.word}
              onChange={(e) => handleTextChange(index, e.target.value)}
              className="flex-1 bg-transparent border-b border-gray-700 focus:border-blue-500 outline-none text-gray-100 px-2 py-1 text-lg"
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleFinalize}
        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-lg transition-all transform hover:scale-[1.02] shadow-lg shadow-emerald-600/20"
      >
        Looks Good — Render Final Video 🎬
      </button>
    </div>
  );
};

export default SubtitleEditor;