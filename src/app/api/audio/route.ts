import { NextResponse } from 'next/server'
import { uploadAudio } from '@/lib/upload'

export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'file required' }, { status: 400 })
  }

  const audioFile = await uploadAudio(file)
  return NextResponse.json(audioFile, { status: 201 })
}
