import app from '../server';

export default function handler(req: any, res: any) {
  if (req.url) {
    if (req.url === '/api/index' || req.url === '/api/index.ts') {
      req.url = '/api';
    } else if (req.url.startsWith('/api/index/')) {
      req.url = req.url.replace('/api/index/', '/api/');
    } else if (req.url.startsWith('/api/index.ts/')) {
      req.url = req.url.replace('/api/index.ts/', '/api/');
    }
  }
  return app(req, res);
}
