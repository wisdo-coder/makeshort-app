import React from 'react';

function LandingPage({ onGetStarted }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 sm:px-12 py-4 border-b border-gray-900">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
            MakeShort
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => onGetStarted('pricing')}
            className="text-gray-400 hover:text-white text-sm font-medium transition"
          >
            Pricing
          </button>
          <button
            onClick={() => onGetStarted('login')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-bold transition"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 sm:px-12 py-16 sm:py-24 text-center max-w-4xl mx-auto">
        <div className="inline-block px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-semibold text-sm mb-6">
          AI-Powered Video Engine
        </div>
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black leading-tight mb-6">
          Turn any story into a{' '}
          <span className="bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
            viral short
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10">
          Paste a Reddit link or type a script. AI generates voiceover, captions, and background video in minutes. No editing skills needed.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => onGetStarted('login')}
            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-lg transition-all transform hover:scale-[1.02] shadow-lg shadow-emerald-600/20"
          >
            Start Creating Free
          </button>
          <button
            onClick={() => onGetStarted('pricing')}
            className="px-8 py-4 bg-gray-900 border border-gray-700 hover:border-gray-500 rounded-xl font-bold text-lg text-gray-300 transition-all"
          >
            View Pricing
          </button>
        </div>
        <p className="text-gray-500 text-sm mt-4">No credit card required. 2 free videos/month.</p>
      </section>

      {/* How It Works */}
      <section className="px-6 sm:px-12 py-16 bg-gray-900/50 border-y border-gray-800">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-center mb-12">
            How it works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Paste or Type',
                desc: 'Drop a Reddit link or write your own script. Our AI handles the rest.',
                icon: '📝',
              },
              {
                step: '2',
                title: 'Customize',
                desc: 'Pick your AI voice, background video, and caption style. 8 voices, 6 backgrounds, 5 styles.',
                icon: '🎨',
              },
              {
                step: '3',
                title: 'Download & Post',
                desc: 'Get a ready-to-post vertical video with AI voiceover and animated captions.',
                icon: '🚀',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center hover:border-emerald-500/50 transition"
              >
                <div className="text-4xl mb-4">{item.icon}</div>
                <div className="inline-block px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-bold mb-3">
                  Step {item.step}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 sm:px-12 py-16 max-w-5xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-center mb-12">
          Everything you need to go viral
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: '🎙️', title: '8 AI Voices', desc: 'American, British, Irish accents. Male & female.' },
            { icon: '🎮', title: '6 Backgrounds', desc: 'Minecraft, Subway Surfers, GTA, cooking, nature & more.' },
            { icon: '✨', title: '5 Caption Styles', desc: 'Yellow, white, neon green, fire red, ocean blue.' },
            { icon: '🔥', title: 'Reddit to Video', desc: 'Paste any Reddit post URL and get a video in minutes.' },
            { icon: '📱', title: '9:16 & 16:9', desc: 'TikTok/Shorts vertical or YouTube horizontal format.' },
            { icon: '📊', title: 'Video History', desc: 'Access all your past creations anytime.' },
          ].map((feature) => (
            <div
              key={feature.title}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition"
            >
              <span className="text-2xl">{feature.icon}</span>
              <h3 className="text-base font-bold text-white mt-3 mb-1">{feature.title}</h3>
              <p className="text-gray-400 text-sm">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="px-6 sm:px-12 py-16 bg-gray-900/50 border-y border-gray-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-gray-400 mb-8">Start free. Upgrade when you need more videos.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { name: 'Free', price: '$0', videos: '2/mo' },
              { name: 'Starter', price: '$7.99', videos: '15/mo' },
              { name: 'Pro', price: '$14.99', videos: '40/mo', highlight: true },
              { name: 'Creator', price: '$24.99', videos: 'Unlimited' },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`p-4 rounded-xl border ${
                  plan.highlight
                    ? 'border-emerald-500 bg-emerald-500/5'
                    : 'border-gray-800 bg-gray-900'
                }`}
              >
                <p className="text-gray-400 text-xs font-bold uppercase">{plan.name}</p>
                <p className="text-2xl font-black text-white mt-1">{plan.price}</p>
                <p className="text-emerald-400 text-xs mt-1">{plan.videos}</p>
              </div>
            ))}
          </div>
          <button
            onClick={() => onGetStarted('pricing')}
            className="mt-8 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-sm transition"
          >
            View Full Pricing
          </button>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 sm:px-12 py-20 text-center">
        <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">
          Ready to create your first viral short?
        </h2>
        <p className="text-gray-400 mb-8 max-w-lg mx-auto">
          Join creators using MakeShort to automate faceless content. Start with 2 free videos.
        </p>
        <button
          onClick={() => onGetStarted('login')}
          className="px-10 py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-lg transition-all transform hover:scale-[1.02] shadow-lg shadow-emerald-600/20"
        >
          Get Started Free
        </button>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 sm:px-12 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <span className="text-lg font-black bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
            MakeShort
          </span>
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} MakeShort. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
