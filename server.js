const express = require('express')
const { execFile } = require('child_process')
const { randomUUID } = require('crypto')
const fs = require('fs')
const path = require('path')
const app = express()

app.use(express.json())

const PORT = process.env.PORT || 3000
const API_SECRET = process.env.API_SECRET || 'changeme'

app.get('/health', (_, res) => res.json({ ok: true }))

function isAllowed(url) {
  const allowed = ['facebook.com', 'instagram.com', 'fb.watch', 'fb.com', 'tiktok.com', 'vm.tiktok.com']
  return url && allowed.some(d => url.includes(d))
}

function handleDownload(url, secret, req, res) {
  if (secret !== API_SECRET) return res.status(401).json({ error: 'Unauthorized' })
  if (!isAllowed(url)) return res.status(400).json({ error: 'Invalid URL' })

  const outPath = path.join('/tmp', `${randomUUID()}.mp4`)

  // yt-dlp tải về file hoàn chỉnh (tự xử lý cookies/headers, merge video+audio)
  execFile('yt-dlp', [
    '--format', 'bestvideo[vcodec^=avc1]+bestaudio/best[vcodec^=avc1]/best[ext=mp4]/best',
    '--merge-output-format', 'mp4',
    '--no-playlist',
    '--no-warnings',
    '-o', outPath,
    url
  ], { timeout: 60000 }, (err, _, stderr) => {
    if (err) {
      fs.unlink(outPath, () => {})
      return res.status(500).json({ error: 'Download failed', detail: stderr.slice(0, 300) })
    }

    const stat = fs.statSync(outPath)
    res.setHeader('Content-Type', 'video/mp4')
    res.setHeader('Content-Length', stat.size)
    res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"')

    const stream = fs.createReadStream(outPath)
    stream.pipe(res)
    stream.on('close', () => fs.unlink(outPath, () => {}))
    req.on('close', () => { stream.destroy(); fs.unlink(outPath, () => {}) })
  })
}

app.get('/download', (req, res) => handleDownload(req.query.url, req.query.secret, req, res))
app.post('/download', (req, res) => handleDownload(req.body?.url, req.body?.secret, req, res))

app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
