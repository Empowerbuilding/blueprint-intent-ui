import { redirect } from 'next/navigation'

// Standards moved to /rulebook/standards (Rulebook → Standards). Old links land there.
export default async function StandardsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string }>
}) {
  const { doc } = await searchParams
  redirect('/rulebook/standards' + (doc ? '?doc=' + encodeURIComponent(doc) : ''))
}
