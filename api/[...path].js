// lang: Node.js, file: api/[...path].js, target: Vercel Serverless
// reverse proxy ke clientbp.ppmainecoonghj.com — intercept CheckHackBehavior

export const config = {
  api: {
    bodyParser: false,
  },
}

const REAL_SERVER = 'https://clientbp.ppmainecoonghj.com'

// endpoint yang kena intercept — return kosong terus, tak forward ke Garena
const INTERCEPT_EMPTY = [
  '/CheckHackBehavior',
  '/ReportEventPushInfo',
]

// baca raw body dari request stream
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  // bina path dari dynamic route
  const pathParts = req.query.path
  const path = '/' + (Array.isArray(pathParts) ? pathParts.join('/') : pathParts)

  // intercept — return 200 kosong, Garena tak dapat data
  for (const ep of INTERCEPT_EMPTY) {
    if (path === ep) {
      res.setHeader('vary', 'Accept-Encoding')
      res.setHeader('date', new Date().toUTCString())
      res.status(200).end()
      return
    }
  }

  // forward headers — buang yang akan cause masalah
  const forwardHeaders = {}
  for (const [k, v] of Object.entries(req.headers)) {
    if (
      k === 'host' ||
      k === 'x-forwarded-for' ||
      k === 'x-forwarded-host' ||
      k === 'x-forwarded-proto' ||
      k === 'x-vercel-id' ||
      k === 'x-real-ip'
    ) continue
    forwardHeaders[k] = v
  }

  // set host ke real server
  forwardHeaders['host'] = 'clientbp.ppmainecoonghj.com'

  // baca body kalau ada
  let body = undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await getRawBody(req)
  }

  // forward ke Garena server sebenar
  let upstream
  try {
    upstream = await fetch(`${REAL_SERVER}${path}`, {
      method: req.method,
      headers: forwardHeaders,
      body: body,
      // jangan follow redirect automatik
      redirect: 'manual',
    })
  } catch (err) {
    res.status(502).json({ error: 'upstream failed', detail: err.message })
    return
  }

  // copy response headers dari Garena
  for (const [k, v] of upstream.headers.entries()) {
    // buang content-encoding — Vercel akan handle compression sendiri
    if (k === 'content-encoding') continue
    if (k === 'transfer-encoding') continue
    try {
      res.setHeader(k, v)
    } catch (_) {}
  }

  res.status(upstream.status)

  // stream response balik ke client
  const buf = await upstream.arrayBuffer()
  res.end(Buffer.from(buf))
}
