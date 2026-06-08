// Run with: node migrate.mjs
// Reads local projects.json + public/uploads/, uploads files to Vercel Blob,
// saves all projects to Upstash Redis, and prints a report.

import { createRequire } from 'module'
import { readFile, readdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const dotenv  = require('dotenv')
dotenv.config({ path: '.env.local' })

const { put }   = await import('@vercel/blob')
const { Redis } = await import('@upstash/redis')

const redis = new Redis({
  url:   process.env.CINECOMIC_KV_REST_API_URL,
  token: process.env.CINECOMIC_KV_REST_API_TOKEN,
})

const __dirname  = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE  = path.join(__dirname, 'data', 'projects.json')
const UPLOADS    = path.join(__dirname, 'public', 'uploads')

// ─── helpers ──────────────────────────────────────────────────────────────────

function mimeFromExt(filename) {
  const ext = filename.split('.').pop().toLowerCase()
  return (
    { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      gif: 'image/gif', webp: 'image/webp',
      mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4' }[ext] ?? 'application/octet-stream'
  )
}

async function uploadFile(localUrl, blobFolder) {
  const filename = path.basename(localUrl)
  const filePath = path.join(UPLOADS, filename)
  const bytes    = await readFile(filePath)
  const mime     = mimeFromExt(filename)
  const blob     = await put(`${blobFolder}/${filename}`, bytes, { access: 'public', contentType: mime, token: process.env.BLOB_READ_WRITE_TOKEN })
  return blob.url
}

// ─── main ─────────────────────────────────────────────────────────────────────

console.log('Reading local projects…')
const projects = JSON.parse(await readFile(DATA_FILE, 'utf-8'))
console.log(`Found ${projects.length} project(s).\n`)

for (const project of projects) {
  console.log(`▸ "${project.name}" (${project.id})`)

  // Ensure new fields exist
  project.groups ??= []
  for (const f of project.frames ?? []) f.groupId ??= null

  // Upload images
  for (const asset of project.assets ?? []) {
    if (asset.url.startsWith('/uploads/')) {
      process.stdout.write(`  uploading image: ${asset.filename}… `)
      asset.url = await uploadFile(asset.url, 'assets')
      console.log('✓')
    } else {
      console.log(`  image already remote: ${asset.filename}`)
    }
  }

  // Upload audio
  for (const audio of project.audioFiles ?? []) {
    if (audio.url.startsWith('/uploads/')) {
      process.stdout.write(`  uploading audio:  ${audio.filename}… `)
      audio.url = await uploadFile(audio.url, 'audio')
      console.log('✓')
    } else {
      console.log(`  audio already remote: ${audio.filename}`)
    }
  }

  // Save to Redis
  process.stdout.write(`  saving to Redis… `)
  await redis.set(`project:${project.id}`, project)
  await redis.sadd('project_ids', project.id)
  console.log('✓')
  console.log()
}

// Verify
console.log('Verifying Redis…')
const ids = await redis.smembers('project_ids')
console.log(`Redis contains ${ids.length} project id(s): ${ids.join(', ')}`)

for (const id of ids) {
  const p = await redis.get(`project:${id}`)
  const assetUrls  = (p.assets ?? []).map(a => a.url)
  const audioUrls  = (p.audioFiles ?? []).map(a => a.url)
  const allRemote  = [...assetUrls, ...audioUrls].every(u => u.startsWith('https://'))
  console.log(`  "${p.name}" — ${assetUrls.length} image(s), ${audioUrls.length} audio — all remote: ${allRemote ? '✓' : '✗ PROBLEM'}`)
  if (!allRemote) {
    ;[...assetUrls, ...audioUrls].filter(u => !u.startsWith('https://')).forEach(u => console.log(`    ✗ ${u}`))
  }
}

console.log('\nDone.')
