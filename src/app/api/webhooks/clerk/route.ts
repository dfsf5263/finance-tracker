import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { Webhook } from 'svix'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  // Get the headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400,
    })
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // Create a new Svix instance with your webhook secret
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || '')

  let evt: WebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new Response('Error occured', {
      status: 400,
    })
  }

  // Handle the webhook
  const eventType = evt.type

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name } = evt.data

    // Get primary email
    const primaryEmail = email_addresses.find(
      (email) => email.id === evt.data.primary_email_address_id
    )?.email_address

    if (!primaryEmail) {
      console.error('No primary email found for user:', id)
      return new Response('No primary email found', { status: 400 })
    }

    const upsertData = {
      clerkUserId: id,
      email: primaryEmail,
      firstName: first_name || null,
      lastName: last_name || null,
    }

    try {
      // Create or update user in database
      await prisma.user.upsert({
        where: { clerkUserId: id },
        create: upsertData,
        update: {
          email: primaryEmail,
          firstName: first_name || null,
          lastName: last_name || null,
        },
      })
    } catch (error) {
      console.error('=== Webhook Error ===')
      console.error('Timestamp:', new Date().toISOString())
      console.error('Event Type:', eventType)
      console.error('Event Data:', JSON.stringify(evt.data, null, 2))
      console.error('User ID:', id)
      console.error('Primary Email:', primaryEmail)
      console.error('Upsert Data:', JSON.stringify(upsertData, null, 2))
      console.error('Error:', error)
      if (error && typeof error === 'object' && 'code' in error) {
        console.error('Error Code:', error.code)
      }
      if (error && typeof error === 'object' && 'meta' in error) {
        console.error('Error Meta:', error.meta)
      }

      // Re-throw the error to maintain the 500 response
      throw error
    }
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data

    try {
      // Delete user from database
      await prisma.user.delete({
        where: { clerkUserId: id },
      })
    } catch (error) {
      // Check if error is "Record not found" (P2025)
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
        // User doesn't exist - this is fine, deletion is idempotent
        // No logging needed as the desired outcome is already achieved
        return new Response('Webhook processed', { status: 200 })
      }

      // For any other error, log and re-throw
      console.error('=== Webhook Delete Error ===')
      console.error('Timestamp:', new Date().toISOString())
      console.error('Event Type:', eventType)
      console.error('Event Data:', JSON.stringify(evt.data, null, 2))
      console.error('User ID to delete:', id)
      console.error('Error:', error)

      // Re-throw the error to maintain the 500 response
      throw error
    }
  }

  return new Response('Webhook processed', { status: 200 })
}
