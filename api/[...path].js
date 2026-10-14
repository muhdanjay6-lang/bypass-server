// lang: Node.js CommonJS, file: api/[...path].js, target: Vercel Serverless

module.exports = async function handler(req, res) {
  const REAL_SERVER = 'https://clientbp.ppmainecoonghj.com'

  const INTERCEPT_EMPTY = [
    '/CheckHackBehavior',
    '/ReportEventPushInfo',
  ]

  // bina path
  const pathParts = req.query.path
  const path = '/' + (Array.isArray(pathParts) ? pathParts.join('/') : pathParts || '')

  // intercept — return kosong
  for (const ep of INTERCEPT_EMPTY) {
    if (path === ep) {
      res.setHeader('vary', 'Accept-Encoding')
      res.setHeader('date', new Date().toUTCString())
      res.status(200).end()
      return
    }
  }

  // bina forward headers
  const forwardHeaders = {}
  for (const [k, v] of Object.entries(req.headers)) {
    if (['host','x-forwarded-for','x-forwarded-host','x-forwarded-proto','x-vercel-id','x-real-ip'].includes(k)) continue
    forwardHeaders[k] = v
  }
  forwardHeaders['host'] = 'clientbp.ppmainecoonghj.com'

  // baca raw body
  let body = undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await new Promise((resolve, reject) => {
      const chunks = []
      req.on('data', c => chunks.push(c))
      req.on('end', () => resolve(Buffer.concat(chunks)))
      req.on('error', reject)
    })
  }

  // forward ke Garena
  let upstream
  try {
    upstream = await fetch(`${REAL_SERVER}${path}`, {
      method: req.method,
      headers: forwardHeaders,
      body: body,
      redirect: 'manual',
    })
  } catch (err) {
    res.status(502).end()
    return
  }

  // copy response headers
  for (const [k, v] of upstream.headers.entries()) {
    if (k === 'content-encoding' || k === 'transfer-encoding') continue
    try { res.setHeader(k, v) } catch (_) {}
  }

  res.status(upstream.status)
  const buf = await upstream.arrayBuffer()
  res.end(Buffer.from(buf))
}

module.exports.config = {
  api: { bodyParser: false }
}
