import Link from 'next/link'
import { buttonVariants } from '@/components/ui'
import { EmptyState } from '@/components/feedback'
import { cn } from '@/lib/utils'

export default function RideNotFound() {
  return (
    <EmptyState
      title="We couldn’t find that ride"
      description="It may have been removed, or it may not be yours to view."
      action={
        <Link href="/search" className={cn(buttonVariants({ variant: 'primary' }))}>
          Find a ride
        </Link>
      }
    />
  )
}
