import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { imageProxyHandler } from './image-proxy';

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

function mockReq(url?: unknown): Request {
  return { query: { url } } as unknown as Request;
}

function fakeUpstream(opts: {
  ok?: boolean;
  status?: number;
  contentType?: string;
  location?: string;
  body?: Buffer;
}): globalThis.Response {
  const { ok = true, status = 200, contentType, location, body = Buffer.alloc(0) } = opts;
  const headers = new Headers();
  if (contentType) headers.set('content-type', contentType);
  if (location) headers.set('location', location);
  return {
    ok,
    status,
    headers,
    arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  } as globalThis.Response;
}

describe('imageProxyHandler', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('rejects when url query param is missing', async () => {
    const res = mockRes();
    await imageProxyHandler(mockReq(undefined), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a malformed url', async () => {
    const res = mockRes();
    await imageProxyHandler(mockReq('not a url'), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a host outside the whitelist (SSRF guard)', async () => {
    const res = mockRes();
    await imageProxyHandler(mockReq('https://evil.example.com/x.jpg'), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('allows api.deezer.com and streams the image through', async () => {
    const body = Buffer.from('fake-image-bytes');
    vi.mocked(fetch).mockResolvedValue(fakeUpstream({ contentType: 'image/jpeg', body }));

    const res = mockRes();
    await imageProxyHandler(mockReq('https://api.deezer.com/artist/10/image'), res);

    expect(fetch).toHaveBeenCalledWith(
      new URL('https://api.deezer.com/artist/10/image'),
      expect.objectContaining({ redirect: 'manual' }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.header).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
    expect(res.header).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('max-age'));
    expect(res.header).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(res.send).toHaveBeenCalledWith(body);
  });

  it('allows cdn-images.dzcdn.net', async () => {
    vi.mocked(fetch).mockResolvedValue(fakeUpstream({ contentType: 'image/png' }));

    const res = mockRes();
    await imageProxyHandler(mockReq('https://cdn-images.dzcdn.net/images/cover/x/250x250.jpg'), res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 502 when the upstream response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValue(fakeUpstream({ ok: false, status: 404 }));

    const res = mockRes();
    await imageProxyHandler(mockReq('https://api.deezer.com/artist/10/image'), res);

    expect(res.status).toHaveBeenCalledWith(502);
  });

  it('returns 502 when fetch throws (network error, timeout)', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('timeout'));

    const res = mockRes();
    await imageProxyHandler(mockReq('https://api.deezer.com/artist/10/image'), res);

    expect(res.status).toHaveBeenCalledWith(502);
  });

  it('rejects a non-image content type from upstream (XSS guard)', async () => {
    vi.mocked(fetch).mockResolvedValue(fakeUpstream({ contentType: 'text/html' }));

    const res = mockRes();
    await imageProxyHandler(mockReq('https://api.deezer.com/artist/10/image'), res);

    expect(res.status).toHaveBeenCalledWith(502);
  });

  it('rejects when upstream omits Content-Type entirely', async () => {
    vi.mocked(fetch).mockResolvedValue(fakeUpstream({}));

    const res = mockRes();
    await imageProxyHandler(mockReq('https://api.deezer.com/artist/10/image'), res);

    expect(res.status).toHaveBeenCalledWith(502);
  });

  it('follows a redirect to a whitelisted host', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        fakeUpstream({ status: 302, location: 'https://cdn-images.dzcdn.net/images/cover/x/250x250.jpg' }),
      )
      .mockResolvedValueOnce(fakeUpstream({ contentType: 'image/jpeg' }));

    const res = mockRes();
    await imageProxyHandler(mockReq('https://api.deezer.com/artist/10/image'), res);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects a redirect to a non-whitelisted host (SSRF via redirect)', async () => {
    vi.mocked(fetch).mockResolvedValue(
      fakeUpstream({ status: 302, location: 'https://internal.metadata.local/secret' }),
    );

    const res = mockRes();
    await imageProxyHandler(mockReq('https://api.deezer.com/artist/10/image'), res);

    expect(res.status).toHaveBeenCalledWith(502);
  });

  it('gives up after too many redirects', async () => {
    vi.mocked(fetch).mockResolvedValue(
      fakeUpstream({ status: 302, location: 'https://api.deezer.com/artist/10/image' }),
    );

    const res = mockRes();
    await imageProxyHandler(mockReq('https://api.deezer.com/artist/10/image'), res);

    expect(res.status).toHaveBeenCalledWith(502);
  });
});
