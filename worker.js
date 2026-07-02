const ORIGIN = 'https://nat1ef.github.io/weddingsite';

export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    const path = incoming.pathname === '/' ? '/index.html' : incoming.pathname;
    const target = new URL(`${ORIGIN}${path === '/index.html' ? '/' : path}`);
    target.search = incoming.search;

    const response = await fetch(target.toString(), {
      method: request.method,
      headers: {
        Accept: request.headers.get('Accept') || '*/*',
        'User-Agent': request.headers.get('User-Agent') || 'weddingsite-worker',
      },
      redirect: 'follow',
    });

    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
