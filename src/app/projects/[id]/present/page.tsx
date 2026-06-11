import { Suspense } from 'react'
import Presentation from '@/components/presentation/Presentation'

export default async function PresentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense>
      <Presentation projectId={id} />
    </Suspense>
  )
}
