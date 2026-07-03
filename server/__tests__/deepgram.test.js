const { buildSubtitleChunks, buildSimpleASS } = require('../services/deepgram');

describe('buildSubtitleChunks', () => {
  it('groups words into chunks of 3', () => {
    const words = [
      { word: 'Hello', start: 0, end: 0.5 },
      { word: 'beautiful', start: 0.5, end: 1.0 },
      { word: 'world', start: 1.0, end: 1.5 },
      { word: 'how', start: 1.5, end: 2.0 },
      { word: 'are', start: 2.0, end: 2.5 },
    ];
    const chunks = buildSubtitleChunks(words);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].text).toBe('Hello beautiful world');
    expect(chunks[0].start).toBe(0);
    expect(chunks[0].end).toBe(1.5);
    expect(chunks[1].text).toBe('how are');
    expect(chunks[1].start).toBe(1.5);
    expect(chunks[1].end).toBe(2.5);
  });

  it('handles a single word', () => {
    const words = [{ word: 'Solo', start: 0, end: 1 }];
    const chunks = buildSubtitleChunks(words);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('Solo');
  });

  it('returns empty array for empty input', () => {
    expect(buildSubtitleChunks([])).toEqual([]);
  });
});

describe('buildSimpleASS', () => {
  const chunks = [
    { start: 0, end: 1.5, text: 'Hello world' },
    { start: 1.5, end: 3.0, text: 'Second line' },
  ];

  it('contains ASS header sections', () => {
    const result = buildSimpleASS(chunks);
    expect(result).toContain('[Script Info]');
    expect(result).toContain('[V4+ Styles]');
    expect(result).toContain('[Events]');
  });

  it('generates Dialogue lines for each chunk', () => {
    const result = buildSimpleASS(chunks);
    const lines = result.split('\n').filter(l => l.startsWith('Dialogue:'));
    expect(lines).toHaveLength(2);
  });

  it('uses 9:16 resolution by default', () => {
    const result = buildSimpleASS(chunks);
    expect(result).toContain('PlayResX: 1080');
    expect(result).toContain('PlayResY: 1920');
  });

  it('uses 16:9 resolution when specified', () => {
    const result = buildSimpleASS(chunks, '16:9');
    expect(result).toContain('PlayResX: 1920');
    expect(result).toContain('PlayResY: 1080');
  });
});
