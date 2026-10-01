// Vercel Serverless Function catch-all for /api/* subroutes
const app = require('../server/index');

module.exports = (req, res) => {
  try {
    const urlObj = new URL(req.url, 'http://localhost');
    const match = urlObj.searchParams.get('match');
    if (match) {
      urlObj.searchParams.delete('match');
      const search = urlObj.search;
      req.url = match + (search && search !== '?' ? (match.includes('?') ? '&' + search.slice(1) : search) : '');
    } else if (req.headers['x-matched-path']) {
      req.url = req.headers['x-matched-path'];
    }
  } catch (e) {
    // Keep original req.url
  }

  return app(req, res);
};
