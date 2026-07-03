const errorHandler = require('../middleware/errorHandler');

describe('errorHandler', () => {
  const mockRes = () => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    return res;
  };
  const mockReq = { method: 'POST', path: '/api/test' };

  it('returns 500 by default for generic errors', () => {
    const res = mockRes();
    errorHandler(new Error('boom'), mockReq, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Internal server error. Please try again.' })
    );
  });

  it('uses a custom statusCode if set on the error', () => {
    const res = mockRes();
    const err = new Error('not found');
    err.statusCode = 404;
    errorHandler(err, mockReq, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('exposes the message if err.expose is true', () => {
    const res = mockRes();
    const err = new Error('custom message');
    err.expose = true;
    errorHandler(err, mockReq, res, jest.fn());
    expect(res.json).toHaveBeenCalledWith({ error: 'custom message' });
  });

  it('returns 413 for entity too large errors', () => {
    const res = mockRes();
    const err = new Error('too large');
    err.type = 'entity.too.large';
    errorHandler(err, mockReq, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(413);
  });
});
