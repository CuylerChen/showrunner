import http from 'http'
import * as browserSession from './services/browser-session'

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}) }
      catch { resolve({}) }
    })
    req.on('error', reject)
  })
}

function json(res: http.ServerResponse, status: number, data: any) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

export function startHttpServer(port = 3001) {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')

    const urlObj  = new URL(req.url ?? '/', `http://localhost:${port}`)
    const parts   = urlObj.pathname.split('/').filter(Boolean)
    // 路由: /browser-sessions/:demoId[/:action]

    try {
      if (urlObj.pathname === '/health') {
        json(res, 200, { ok: true }); return
      }

      if (parts[0] !== 'browser-sessions' || !parts[1]) {
        json(res, 404, { error: 'Not found' }); return
      }

      const demoId = parts[1]
      const action = parts[2]

      // GET /browser-sessions/:id  → 会话状态
      if (!action && req.method === 'GET') {
        json(res, 200, {
          active: browserSession.hasSession(demoId),
          url: await browserSession.getCurrentUrl(demoId),
        }); return
      }

      // POST /browser-sessions/:id  → 启动会话
      if (!action && req.method === 'POST') {
        const body = await readBody(req)
        await browserSession.startSession(demoId, body.url)
        json(res, 200, { ok: true }); return
      }

      // DELETE /browser-sessions/:id  → 关闭会话
      if (!action && req.method === 'DELETE') {
        await browserSession.closeSession(demoId)
        json(res, 200, { ok: true }); return
      }

      // GET /browser-sessions/:id/screenshot  → 当前截图
      if (action === 'screenshot' && req.method === 'GET') {
        const buf = await browserSession.getScreenshot(demoId)
        if (!buf) { json(res, 404, { error: 'Session not found' }); return }
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' })
        res.end(buf); return
      }

      // POST /browser-sessions/:id/input  → 发送交互事件
      if (action === 'input' && req.method === 'POST') {
        const body = await readBody(req)
        await browserSession.handleInput(demoId, body)
        json(res, 200, { ok: true }); return
      }

      // POST /browser-sessions/:id/save  → 保存 storageState，关闭会话
      if (action === 'save' && req.method === 'POST') {
        const { state, loginVideoPath } = await browserSession.saveState(demoId)
        json(res, 200, { ok: true, state, loginVideoPath }); return
      }

      json(res, 404, { error: 'Not found' })
    } catch (err: any) {
      console.error('[http-server]', err.message)
      json(res, 500, { error: err.message })
    }
  })

  server.listen(port, '0.0.0.0', () => {
    console.log(`[http-server] Worker API 监听 http://0.0.0.0:${port}`)
  })

  return server
}
