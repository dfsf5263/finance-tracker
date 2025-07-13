import { redirect } from 'next/navigation'

// Redirect to dedupe page as the main utility feature
export default function UtilityPage() {
  redirect('/dashboard/utility/dedupe')
}
