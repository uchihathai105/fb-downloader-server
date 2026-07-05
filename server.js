const express = require('express')
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')
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

  const tmpFile = path.join(os.tmpdir(), `video_${Date.now()}.mp4`)

  // Download + transcode to H.264/AAC mp4 via yt-dlp | ffmpeg
  const ytdlp = spawn('yt-dlp', [
    '-o', '-',
    '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best',
    '--no-playlist',
    '--quiet',
    url
  ])

  const ffmpeg = spawn('ffmpeg', [
    '-i', 'pipe:0',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    '-f', 'mp4',
    'pipe:1'
  ])

  ytdlp.stdout.pipe(ffmpeg.stdin)

  res.setHeader('Content-Type', 'video/mp4')
  res.setHeader('Transfer-Encoding', 'chunked')
  ffmpeg.stdout.pipe(res)

  let errMsg = ''
  ytdlp.stderr.on('data', d => errMsg += d)
  ffmpeg.stderr.on('data', () => {}) // suppress ffmpeg logs

  ffmpeg.on('close', code => {
    if (code !== 0 && !res.headersSent) {
      res.status(500).json({ error: 'Transcode failed', detail: errMsg })
    }
  })

  ytdlp.on('error', err => {
    if (!res.headersSent) res.status(500).json({ error: err.message })
  })

  req?.on?.('close', () => {
    ytdlp.kill()
    ffmpeg.kill()
  })
}

app.get('/download', (req, res) => handleDownload(req.query.url, req.query.secret, req, res))
app.post('/download', (req, res) => handleDownload(req.body?.url, req.body?.secret, req, res))

app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
