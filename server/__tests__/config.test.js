const VOICES = require('../config/voices');
const BACKGROUNDS = require('../config/backgrounds');
const CAPTION_STYLES = require('../config/captionStyles');

describe('voices config', () => {
  it('has at least 5 voice options', () => {
    expect(VOICES.length).toBeGreaterThanOrEqual(5);
  });

  it('each voice has required fields', () => {
    VOICES.forEach(voice => {
      expect(voice).toHaveProperty('id');
      expect(voice).toHaveProperty('name');
      expect(voice).toHaveProperty('gender');
    });
  });

  it('all voice IDs are unique', () => {
    const ids = VOICES.map(v => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('backgrounds config', () => {
  it('has at least 3 background options', () => {
    expect(BACKGROUNDS.length).toBeGreaterThanOrEqual(3);
  });

  it('each background has a filename', () => {
    BACKGROUNDS.forEach(bg => {
      expect(bg.filename).toBeTruthy();
      expect(bg.filename).toMatch(/\.mp4$/);
    });
  });
});

describe('caption styles config', () => {
  it('has at least 3 style options', () => {
    expect(CAPTION_STYLES.length).toBeGreaterThanOrEqual(3);
  });

  it('each style has ASS-format colour fields', () => {
    CAPTION_STYLES.forEach(style => {
      expect(style.primaryColour).toMatch(/^&H/);
      expect(style.outlineColour).toMatch(/^&H/);
      expect(style.fontName).toBeTruthy();
    });
  });
});
