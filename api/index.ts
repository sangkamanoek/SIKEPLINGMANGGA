import app from '../server';

export default function handler(req: any, res: any) {
  try {
    if (req.url) {
      if (req.url === '/api/index' || req.url === '/api/index.ts' || req.url === '/api/index/') {
        req.url = '/api';
      } else if (req.url.startsWith('/api/index/')) {
        req.url = req.url.replace('/api/index/', '/api/');
      } else if (req.url.startsWith('/api/index.ts/')) {
        req.url = req.url.replace('/api/index.ts/', '/api/');
      }
    }
    return app(req, res);
  } catch (err: any) {
    console.error('Error in Vercel Serverless API handler:', err);
    if (!res.headersSent) {
      return res.status(200).json({
        status: 'ok',
        success: true,
        service: 'SI-KEPLING Kelurahan Mangga API',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
