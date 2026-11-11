import { redirect } from 'next/navigation'

// The rulebook's checks moved to /rulebook/checks (Rulebook → Checks). Old links land there.
export default function RulesRedirect() {
  redirect('/rulebook/checks')
}
