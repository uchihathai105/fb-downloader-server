const express = require('express')
const { execFile } = require('child_process')
const app = express()

app.use(express.json())

const PORT = process.env.PORT || 3000
const API_SECRET = process.env.API_SECRET || 'changeme'

app.get('/health', (_, res) => res.json({ ok: true }))

function handleDownload(url, secret, res) {
  if (secret !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const allowedDomains = ['facebook.com', 'instagram.com', 'fb.watch', 'fb.com', 'tiktok.com', 'vm.tiktok.com']
  if (!url || !allowedDomains.some(d => url.includes(d))) {
    return res.status(400).json({ error: 'Invalid URL' })
  }

  execFile('yt-dlp', [
    '--get-url',
    '--get-thumbnail',
    '--format', 'best[ext=mp4][vcodec^=avc]/best[ext=mp4]/best',
    '--no-playlist',
    url
  ], { timeout: 30000 }, (err, stdout, stderr) => {
    if (err) {
      console.error('yt-dlp error:', stderr)
      return res.status(500).json({ error: 'Could not extract video', detail: stderr })
    }

    const lines = stdout.trim().split('\n').filter(Boolean)
    const mediaURL = lines[0]
    const thumbnailURL = lines[1]

    if (!mediaURL || !mediaURL.startsWith('http')) {
      return res.status(500).json({ error: 'No URL found' })
    }

    const isImage = !mediaURL.includes('.mp4') && !mediaURL.includes('video')
    res.json({
      url: mediaURL,
      thumbnail: thumbnailURL || null,
      type: isImage ? 'image' : 'video'
    })
  })
}

app.get('/download', (req, res) => {
  handleDownload(req.query.url, req.query.secret, res)
})

app.post('/download', (req, res) => {
  const url = req.body?.url || req.query.url
  const secret = req.body?.secret || req.query.secret
  handleDownload(url, secret, res)
})

app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
