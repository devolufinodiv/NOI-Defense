import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'

export function NotFound() {
  return (
    <>
      <PageHeader title="404" subtitle="No route matches this path." />
      <div className="px-4 pb-12 md:px-8">
        <Link to="/dashboard">
          <Button variant="primary">Back to dashboard</Button>
        </Link>
      </div>
    </>
  )
}
