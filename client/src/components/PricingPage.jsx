import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://makeshort-backend.onrender.com';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    features: [
      '2 videos per month',
      '2 AI voices',
      '2 backgrounds',
      '1 caption style',
      'Watermark on videos',
      '500 character script limit',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 7.99,
    features: [
      '15 videos per month',
      'All 8 AI voices',
      'All 6 backgrounds',
      'All 5 caption styles',
      'No watermark',
      '1,000 character scripts',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 14.99,
    popular: true,
    features: [
      '40 videos per month',
      'All 8 AI voices',
      'All 6 backgrounds',
      'All 5 caption styles',
      'No watermark',
      '2,000 character scripts',
      'Priority rendering',
    ],
  },
  {
    id: 'creator',
    name: 'Creator',
    price: 24.99,
    features: [
      'Unlimited videos',
      'All 8 AI voices',
      'All 6 backgrounds',
      'All 5 caption styles',
      'No watermark',
      '5,000 character scripts',
      'Priority rendering',
      'Video clip extraction',
      'API access (coming soon)',
    ],
  },
];

function PricingPage({ onClose, currentPlan }) {
  const { userId } = useAuth();
  const [loading, setLoading] = useState(null);

  async function handleSelectPlan(planId) {
    if (planId === 'free' || planId === currentPlan) return;

    setLoading(planId);
    try {
      const { data } = await axios.post(`${API_URL}/api/stripe/create-checkout`, {
        planId,
        userId,
      });

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to start checkout';
      alert(msg);
    } finally {
      setLoading(null);
    }
  }

  async function handleManageSubscription() {
    try {
      const { data } = await axios.post(`${API_URL}/api/stripe/customer-portal`, {
        userId,
      });
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      alert('Unable to open subscription management. Please try again.');
    }
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Choose Your Plan</h2>
          <p className="text-gray-400 text-sm mt-1">Start free. Upgrade when you need more.</p>
        </div>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-bold transition"
        >
          Back to Dashboard
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isPopular = plan.popular;

          return (
            <div
              key={plan.id}
              className={`relative bg-gray-900 rounded-2xl border p-6 flex flex-col transition-all ${
                isPopular
                  ? 'border-emerald-500 shadow-lg shadow-emerald-500/10'
                  : 'border-gray-800 hover:border-gray-600'
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-full uppercase tracking-wide">
                  Most Popular
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-black text-white">${plan.price}</span>
                  {plan.price > 0 && <span className="text-gray-400 text-sm">/mo</span>}
                </div>
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="text-emerald-400 mt-0.5 flex-shrink-0">
                      {plan.id === 'free' && idx >= 4 ? '~' : '+'}
                    </span>
                    <span className={plan.id === 'free' && idx >= 4 ? 'text-gray-500' : 'text-gray-300'}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <button
                  className="w-full py-3 bg-gray-800 text-gray-400 rounded-xl font-bold text-sm cursor-default"
                  disabled
                >
                  Current Plan
                </button>
              ) : plan.id === 'free' ? (
                <button
                  className="w-full py-3 bg-gray-800 text-gray-400 rounded-xl font-bold text-sm cursor-default"
                  disabled
                >
                  Free Forever
                </button>
              ) : (
                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={loading === plan.id}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                    isPopular
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  } ${loading === plan.id ? 'opacity-50 cursor-wait' : ''}`}
                >
                  {loading === plan.id ? 'Redirecting...' : `Get ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {currentPlan && currentPlan !== 'free' && (
        <div className="mt-6 text-center">
          <button
            onClick={handleManageSubscription}
            className="text-gray-400 hover:text-white text-sm underline transition"
          >
            Manage subscription
          </button>
        </div>
      )}
    </div>
  );
}

export default PricingPage;
