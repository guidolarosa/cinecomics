import { NextResponse } from 'next/server'
import { uploadAsset } from '@/lib/upload'

export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('file') as File | null
  const width = parseInt(form.get('width') as string) || 0
  const height = parseInt(form.get('height') as string) || 0

  if (!file) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }

  const asset = await uploadAsset(file)
  asset.width = width
  asset.height = height

  return NextResponse.json(asset, { status: 201 })
}
