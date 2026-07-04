const express = require('express')
const { execFile } = require('child_process')
const app = express()

const PORT = process.env.PORT || 3000
const API_SECRET = process.env.API_SECRET || 'changeme'

app.get('/health', (_, res) => res.json({ ok: true }))

app.get('/download', (req, res) => {
  const { url, secret } = req.query

  if (secret !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  if (!url || !url.includes('facebook.com')) {
    return res.status(400).json({ error: 'Invalid URL' })
  }

  // yt-dlp: lấy direct URL, không download file về server
  execFile('yt-dlp', [
    '--get-url',
    '--format', 'best[ext=mp4][vcodec^=avc]/best[ext=mp4]/best',
    '--no-playlist',
    url
  ], { timeout: 30000 }, (err, stdout, stderr) => {
    if (err) {
      console.error('yt-dlp error:', stderr)
      return res.status(500).json({ error: 'Could not extract video', detail: stderr })
    }

    const lines = stdout.trim().split('\n').filter(Boolean)
    const videoURL = lines[0]

    if (!videoURL || !videoURL.startsWith('http')) {
      return res.status(500).json({ error: 'No video URL found' })
    }

    res.json({ url: videoURL })
  })
})

app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
