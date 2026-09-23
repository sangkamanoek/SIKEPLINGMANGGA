/**
 * Custom Fetch Wrapper
 * Ensures all Firestore and API requests have strict anti-caching headers.
 */

export const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);

  // Target API and Firestore
  if (url.includes('/api/') || url.includes('firestore.googleapis.com')) {
    const newInit = {
      ...init,
      headers: {
        ...init?.headers,
        'Cache-Control': 'no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    };
    return window.fetch(input, newInit);
  }

  return window.fetch(input, init);
};
