const { parseAITime, formatAssTime, generateASS } = require('../utils');

// ==========================================
// parseAITime
// ==========================================
describe('parseAITime', () => {
  it('returns 0 for undefined', () => {
    expect(parseAITime(undefined)).toBe(0);
  });

  it('returns 0 for null', () => {
    expect(parseAITime(null)).toBe(0);
  });

  it('returns the number as-is when given a number', () => {
    expect(parseAITime(42)).toBe(42);
    expect(parseAITime(0)).toBe(0);
    expect(parseAITime(3.14)).toBe(3.14);
  });

  it('parses a plain numeric string', () => {
    expect(parseAITime('120')).toBe(120);
    expect(parseAITime('  45.5  ')).toBe(45.5);
  });

  it('strips non-numeric characters from a string', () => {
    expect(parseAITime('120s')).toBe(120);
    expect(parseAITime('approx 30 seconds')).toBe(30);
  });

  it('parses MM:SS colon format', () => {
    expect(parseAITime('1:30')).toBe(90);
    expect(parseAITime('0:45')).toBe(45);
  });

  it('parses HH:MM:SS colon format', () => {
    expect(parseAITime('1:00:00')).toBe(3600);
    expect(parseAITime('1:02:03')).toBe(3723);
  });

  it('returns 0 for an empty string', () => {
    expect(parseAITime('')).toBe(0);
  });

  it('returns 0 for a non-numeric string', () => {
    expect(parseAITime('hello')).toBe(0);
  });
});

// ==========================================
// formatAssTime
// ==========================================
describe('formatAssTime', () => {
  it('formats 0 seconds', () => {
    expect(formatAssTime(0)).toBe('0:00:00.00');
  });

  it('formats seconds with centiseconds', () => {
    expect(formatAssTime(1.5)).toBe('0:00:01.50');
  });

  it('formats minutes and seconds', () => {
    expect(formatAssTime(90)).toBe('0:01:30.00');
  });

  it('formats hours, minutes, and seconds', () => {
    expect(formatAssTime(3661.25)).toBe('1:01:01.25');
  });

  it('pads minutes and seconds with leading zeros', () => {
    expect(formatAssTime(5)).toBe('0:00:05.00');
  });

  it('handles fractional centiseconds via truncation', () => {
    // 1.999 -> cs = Math.floor(0.999 * 100) = 99
    expect(formatAssTime(1.999)).toBe('0:00:01.99');
  });
});

// ==========================================
// generateASS
// ==========================================
describe('generateASS', () => {
  const sampleWords = [
    { word: 'Hello', start: 10, end: 10.5 },
    { word: 'world', start: 10.5, end: 11 },
    { word: 'foo', start: 11, end: 11.5 },
  ];

  it('returns a string containing ASS header sections', () => {
    const result = generateASS(sampleWords, 10);
    expect(result).toContain('[Script Info]');
    expect(result).toContain('[V4+ Styles]');
    expect(result).toContain('[Events]');
  });

  it('uses 1080x1920 resolution for 9:16 (default)', () => {
    const result = generateASS(sampleWords, 0, '9:16');
    expect(result).toContain('PlayResX: 1080');
    expect(result).toContain('PlayResY: 1920');
  });

  it('uses 1920x1080 resolution for 16:9', () => {
    const result = generateASS(sampleWords, 0, '16:9');
    expect(result).toContain('PlayResX: 1920');
    expect(result).toContain('PlayResY: 1080');
  });

  it('sets MarginV to 960 for 9:16 and 100 for 16:9', () => {
    const portrait = generateASS(sampleWords, 0, '9:16');
    expect(portrait).toContain(',960');

    const landscape = generateASS(sampleWords, 0, '16:9');
    expect(landscape).toContain(',100');
  });

  it('generates Dialogue lines for each word', () => {
    const result = generateASS(sampleWords, 10);
    const dialogueLines = result.split('\n').filter(l => l.startsWith('Dialogue:'));
    // 3 words in 1 chunk of 3 -> 3 dialogue lines (one per word with highlight)
    expect(dialogueLines.length).toBe(3);
  });

  it('highlights the active word with color tags', () => {
    const result = generateASS(sampleWords, 10);
    // First dialogue line should highlight "Hello"
    expect(result).toContain('{\\c&H00FFFF&}Hello{\\c&HFFFFFF&}');
    // Second dialogue line should highlight "world"
    expect(result).toContain('{\\c&H00FFFF&}world{\\c&HFFFFFF&}');
  });

  it('subtracts clipStart from word timestamps', () => {
    const result = generateASS(sampleWords, 10);
    // First word starts at 10 - clipStart 10 = 0
    expect(result).toContain('0:00:00.00');
  });

  it('returns only the header when given an empty words array', () => {
    const result = generateASS([], 0);
    const dialogueLines = result.split('\n').filter(l => l.startsWith('Dialogue:'));
    expect(dialogueLines.length).toBe(0);
  });

  it('clamps negative timestamps to 0', () => {
    const wordsBeforeClip = [
      { word: 'early', start: 2, end: 3 },
    ];
    const result = generateASS(wordsBeforeClip, 5);
    // start would be 2 - 5 = -3, clamped to 0
    expect(result).toContain('0:00:00.00');
  });
});
