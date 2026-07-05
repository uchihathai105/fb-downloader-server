const express = require('express')
const { execFile } = require('child_process')
const app = express()

app.use(express.json())

const PORT = process.env.PORT || 3000
const API_SECRET = process.env.API_SECRET || 'changeme'

app.get('/health', (_, res) => res.json({ ok: true }))

function isAllowed(url) {
  const allowed = ['facebook.com', 'instagram.com', 'fb.watch', 'fb.com', 'tiktok.com', 'vm.tiktok.com']
  return url && allowed.some(d => url.includes(d))
}

function handleDownload(url, secret, res) {
  if (secret !== API_SECRET) return res.status(401).json({ error: 'Unauthorized' })
  if (!isAllowed(url)) return res.status(400).json({ error: 'Invalid URL' })

  execFile('yt-dlp', [
    '--get-url',
    '--format', 'bestvideo[vcodec^=avc][ext=mp4]+bestaudio[ext=m4a]/best[vcodec^=avc][ext=mp4]/best[ext=mp4]/best',
    '--no-playlist',
    '--no-warnings',
    url
  ], { timeout: 30000 }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: 'Failed', detail: stderr.slice(0, 300) })

    const lines = stdout.trim().split('\n').filter(l => l.startsWith('http'))
    if (!lines.length) return res.status(500).json({ error: 'No URL found' })

    // Nếu có 2 URLs (video + audio riêng) → trả cả 2 để app ghép
    res.json({
      videoURL: lines[0],
      audioURL: lines.length > 1 ? lines[1] : null,
      type: 'video'
    })
  })
}

app.get('/download', (req, res) => handleDownload(req.query.url, req.query.secret, res))
app.post('/download', (req, res) => handleDownload(req.body?.url, req.body?.secret, res))

app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
