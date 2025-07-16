const cron = require('node-cron')

// Schedule configurable via CRON_SCHEDULE environment variable
// Cron format: second minute hour day-of-month month day-of-week
// Default: '0 0 12 * * 0' means: at 12:00 PM on Sunday
// Current setting: '*/5 * * * *' means: every 5 minutes (for testing)
const schedule = process.env.CRON_SCHEDULE || '0 0 12 * * 0'

console.log('Starting weekly summary cron job...')
console.log(`Scheduled to run: ${schedule}`)

cron.schedule(schedule, async () => {
  console.log('Running weekly summary cron job...')
  
  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      console.error('CRON_SECRET environment variable is not set')
      return
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const cronUrl = `${baseUrl}/api/cron/weekly-summary`

    console.log(`Making request to: ${cronUrl}`)

    const response = await fetch(cronUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Weekly summary cron job failed: ${response.status} ${response.statusText}`)
      console.error('Error details:', errorText)
      return
    }

    const result = await response.json()
    console.log('Weekly summary cron job completed successfully:')
    console.log(`- Total users: ${result.results.total}`)
    console.log(`- Successful: ${result.results.successful}`)
    console.log(`- Failed: ${result.results.failed}`)
    
    if (result.results.failed > 0) {
      console.log('Failed email details:')
      result.details.filter(d => !d.success).forEach(detail => {
        console.log(`  - ${detail.email}: ${detail.error}`)
      })
    }
  } catch (error) {
    console.error('Error in weekly summary cron job:', error)
  }
}, {
  scheduled: true,
  timezone: process.env.TZ || 'UTC'
})

console.log(`Cron job initialized. Timezone: ${process.env.TZ || 'UTC'}`)

// Keep the process running
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down cron job...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down cron job...')
  process.exit(0)
})