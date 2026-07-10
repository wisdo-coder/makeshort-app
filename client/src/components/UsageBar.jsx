import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://makeshort-backend.onrender.com';

function UsageBar({ userId, onUpgrade }) {
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    if (!userId) return;
    axios
      .get(`${API_URL}/api/stripe/usage?userId=${userId}`)
      .then((res) => setUsage(res.data))
      .catch(() => {});
  }, [userId]);

  if (!usage) return null;

  const { planName, videosUsed, videosLimit, planId } = usage;
  const isUnlimited = videosLimit === -1;
  const percentage = isUnlimited ? 0 : Math.min((videosUsed / videosLimit) * 100, 100);
  const isNearLimit = !isUnlimited && percentage >= 80;
  const isAtLimit = !isUnlimited && videosUsed >= videosLimit;

  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-3 rounded-xl border text-sm ${
      isAtLimit
        ? 'bg-red-500/10 border-red-500/30'
        : isNearLimit
        ? 'bg-amber-500/10 border-amber-500/30'
        : 'bg-gray-900 border-gray-800'
    }`}>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
          planId === 'free' ? 'bg-gray-700 text-gray-300' :
          planId === 'starter' ? 'bg-blue-500/20 text-blue-400' :
          planId === 'pro' ? 'bg-emerald-500/20 text-emerald-400' :
          'bg-purple-500/20 text-purple-400'
        }`}>
          {planName}
        </span>
        <span className="text-gray-400">
          {isUnlimited
            ? `${videosUsed} videos this month`
            : `${videosUsed}/${videosLimit} videos`}
        </span>
      </div>

      {!isUnlimited && (
        <div className="flex-1 w-full sm:w-auto">
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )}

      {isAtLimit && (
        <button
          onClick={onUpgrade}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex-shrink-0"
        >
          Upgrade Plan
        </button>
      )}
    </div>
  );
}

export default UsageBar;
