// lang: Node.js, file: server.js, target: Railway
// reverse proxy ke clientbp.ppmainecoonghj.com — intercept CheckHackBehavior

const http = require('http')
const https = require('https')

const REAL_SERVER = 'clientbp.ppmainecoonghj.com'
const PORT = process.env.PORT || 3000

const INTERCEPT_EMPTY = [
  '/CheckHackBehavior',
  '/ReportEventPushInfo',
]

const UNITY_UA = 'UnityPlayer/2021.3.36f1 (UnityWebRequest/1.0, libcurl/8.4.0-DEV)'

const server = http.createServer((req, res) => {
  const path = req.url

  // intercept — return 200 kosong
  for (const ep of INTERCEPT_EMPTY) {
    if (path === ep) {
      res.writeHead(200, {
        'date': new Date().toUTCString(),
        'content-length': '0',
        'vary': 'Accept-Encoding',
      })
      res.end()
      return
    }
  }

  // bina forward headers
  const forwardHeaders = { ...req.headers }
  forwardHeaders['host'] = REAL_SERVER
  forwardHeaders['user-agent'] = UNITY_UA
  forwardHeaders['x-unity-version'] = '2021.3.36f1'
  delete forwardHeaders['x-forwarded-for']
  delete forwardHeaders['x-forwarded-host']
  delete forwardHeaders['x-forwarded-proto']

  const options = {
    hostname: REAL_SERVER,
    port: 443,
    path: path,
    method: req.method,
    headers: forwardHeaders,
  }

  const proxy = https.request(options, (upstream) => {
    const resHeaders = { ...upstream.headers }
    delete resHeaders['transfer-encoding']
    delete resHeaders['content-encoding']

    res.writeHead(upstream.statusCode, resHeaders)
    upstream.pipe(res)
  })

  proxy.on('error', (err) => {
    res.writeHead(502, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: err.message, path: path }))
  })

  req.pipe(proxy)
})

server.listen(PORT, () => {
  console.log(`proxy running on port ${PORT}`)
})
