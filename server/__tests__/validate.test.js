const { requireBody, requireFile } = require('../middleware/validate');

describe('requireBody', () => {
  it('calls next when all required fields are present', () => {
    const req = { body: { script: 'hello', userId: 'u1' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    requireBody('script', 'userId')(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 400 when a required field is missing', () => {
    const req = { body: { script: 'hello' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    requireBody('script', 'userId')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('userId') })
    );
  });

  it('lists all missing fields in the error', () => {
    const req = { body: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    requireBody('a', 'b')(req, res, next);
    const errorMsg = res.json.mock.calls[0][0].error;
    expect(errorMsg).toContain('a');
    expect(errorMsg).toContain('b');
  });
});

describe('requireFile', () => {
  it('calls next when file is present', () => {
    const req = { file: { path: '/tmp/video.mp4' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    requireFile(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 400 when no file is uploaded', () => {
    const req = {};
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    requireFile(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
