import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://makeshort-backend.onrender.com';

function VideoHistory({ userId, onClose }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    axios
      .get(`${API_URL}/api/my-videos?userId=${userId}`)
      .then((res) => setVideos(res.data.videos))
      .catch((err) => console.error('Failed to fetch videos:', err))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white">My Creations</h2>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-bold transition"
        >
          Back to Dashboard
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading your videos...</p>
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 rounded-xl border border-gray-800">
          <p className="text-4xl mb-4">🎬</p>
          <p className="text-gray-400 text-lg font-medium">No videos yet</p>
          <p className="text-gray-500 text-sm mt-1">Create your first viral short to see it here!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((video) => (
            <div
              key={video.id}
              className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-emerald-500 transition"
            >
              <div className="relative aspect-[9/16] bg-black">
                <video
                  src={video.video_url}
                  className="w-full h-full object-cover"
                  preload="metadata"
                  muted
                  playsInline
                  onMouseEnter={(e) => e.target.play()}
                  onMouseLeave={(e) => { e.target.pause(); e.target.currentTime = 0; }}
                />
              </div>
              <div className="p-4">
                <h3 className="text-sm font-bold text-white truncate">
                  {video.title || 'Untitled Video'}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    video.type === 'reddit'
                      ? 'bg-orange-500/20 text-orange-400'
                      : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {video.type === 'reddit' ? 'Reddit' : 'Custom'}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {new Date(video.created_at).toLocaleDateString()}
                  </span>
                </div>
                <a
                  href={video.video_url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs transition flex items-center justify-center gap-1"
                >
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default VideoHistory;
