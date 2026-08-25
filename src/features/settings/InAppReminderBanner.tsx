import { useAppData } from '../app-data/appDataContextValue'
import { isReminderDue, reminderDetails } from './reminderCalendar'

export function InAppReminderBanner() {
  const data = useAppData()
  const due = data.list('reminders').filter((record) => isReminderDue(record))
  if (!due.length) return null
  return (
    <aside className="in-app-reminder" aria-live="polite">
      <strong>Muistutus</strong>
      <span>{due.map((record) => reminderDetails(record).title).join(' · ')}</span>
    </aside>
  )
}
