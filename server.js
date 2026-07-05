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
  const allowedDomains = ['facebook.com', 'instagram.com', 'fb.watch', 'fb.com', 'tiktok.com', 'vm.tiktok.com']
  if (!url || !allowedDomains.some(d => url.includes(d))) {
    return res.status(400).json({ error: 'Invalid URL' })
  }

  // yt-dlp: lấy direct URL + metadata
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

    // yt-dlp --get-url --get-thumbnail trả về: line 0 = media URL, line 1 = thumbnail URL
    // Nếu chỉ có 1 line thì là ảnh tĩnh (thumbnail = media)
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
})

app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
