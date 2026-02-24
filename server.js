require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
const ALLOWED_HOST = process.env.RAPIDAPI_HOST || 'rapidapi.com';

app.post('/api/proxy', async (req, res) => {
  try {
    const { url, method = 'POST', headers = {}, body } = req.body || {};
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Missing url' });

    // Basic whitelist: allow only rapidapi domains
    if (!url.includes(ALLOWED_HOST)) return res.status(400).json({ error: 'Host not allowed' });

    const forwardHeaders = Object.assign({}, headers);
    // attach RapidAPI key header if not provided by client
    if (!forwardHeaders['x-rapidapi-key'] && RAPIDAPI_KEY) forwardHeaders['x-rapidapi-key'] = RAPIDAPI_KEY;
    // ensure host header is present for some RapidAPI endpoints
    if (!forwardHeaders['x-rapidapi-host']) {
      try {
        const u = new URL(url);
        forwardHeaders['x-rapidapi-host'] = u.host;
      } catch (e) {}
    }

    const axiosOptions = {
      url,
      method: method.toLowerCase(),
      headers: forwardHeaders,
      data: body,
      responseType: 'arraybuffer',
      validateStatus: () => true
    };

    const resp = await axios(axiosOptions);

    // forward status and headers (but avoid forwarding hop-by-hop headers)
    const excluded = ['transfer-encoding', 'connection', 'keep-alive', 'content-encoding'];
    Object.entries(resp.headers || {}).forEach(([k, v]) => {
      if (!excluded.includes(k.toLowerCase())) res.setHeader(k, v);
    });

    res.status(resp.status).send(resp.data);
  } catch (err) {
    console.error('Proxy error', err && err.toString());
    res.status(500).json({ error: 'Proxy failed', details: err && err.message });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Proxy server listening on port ${port}`));
