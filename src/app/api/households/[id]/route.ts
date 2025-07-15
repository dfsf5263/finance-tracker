import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { logApiError } from '@/lib/error-logger'
import { requireHouseholdAccess } from '@/lib/auth-middleware'
import { canManageHouseholdSettings, canDeleteHousehold } from '@/lib/role-utils'
import { validateRequestBody, householdUpdateSchema } from '@/lib/validation'
import { z } from 'zod'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Verify user has access to this household
    const result = await requireHouseholdAccess(request, id)
    if (result instanceof NextResponse) {
      return result
    }

    // Get additional count data
    const householdWithCounts = await db.household.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            accounts: true,
            users: true,
            categories: true,
            types: true,
          },
        },
      },
    })

    return NextResponse.json(householdWithCounts)
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'fetch household',
      context: { id: (await params).id },
    })
    return NextResponse.json({ error: 'Failed to fetch household' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let data
  try {
    const { id } = await params

    // Verify user has access to this household
    const result = await requireHouseholdAccess(request, id)
    if (result instanceof NextResponse) {
      return result
    }

    // Check if user has permission to update household settings
    if (!canManageHouseholdSettings(result.userRole)) {
      return NextResponse.json(
        { error: 'Only the household owner can update household settings' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    data = await request.json()

    // Create extended schema for household update that includes annualBudget
    const extendedSchema = householdUpdateSchema.extend({
      annualBudget: z.union([z.string(), z.number(), z.null()]).optional(),
    })

    const validation = validateRequestBody(extendedSchema, data)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { name, annualBudget } = validation.data
    const updateData: { name?: string; annualBudget?: string | number | null } = {}

    if (name) {
      updateData.name = name
    }

    // Handle annualBudget: allow null to clear, otherwise set value
    if (annualBudget === null || annualBudget === '') {
      updateData.annualBudget = null
    } else if (annualBudget !== undefined) {
      updateData.annualBudget = annualBudget
    }

    const household = await db.household.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            accounts: true,
            users: true,
            categories: true,
            types: true,
          },
        },
      },
    })

    return NextResponse.json(household)
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'update household',
      context: {
        id: (await params).id,
        updateData: data,
      },
    })
    return NextResponse.json({ error: 'Failed to update household' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let deletionCounts: Record<string, number> = {}
  try {
    const { id } = await params

    // Verify user has access to this household
    const result = await requireHouseholdAccess(request, id)
    if (result instanceof NextResponse) {
      return result
    }

    // Check if user has permission to delete household
    if (!canDeleteHousehold(result.userRole)) {
      return NextResponse.json(
        { error: 'Only the household owner can delete a household' },
        { status: 403 }
      )
    }

    // Get counts of related records for logging and response
    const [
      transactionCount,
      userHouseholdCount,
      invitationCount,
      accountCount,
      householdUserCount,
      categoryCount,
      typeCount,
    ] = await Promise.all([
      db.transaction.count({ where: { householdId: id } }),
      db.userHousehold.count({ where: { householdId: id } }),
      db.householdInvitation.count({ where: { householdId: id } }),
      db.householdAccount.count({ where: { householdId: id } }),
      db.householdUser.count({ where: { householdId: id } }),
      db.householdCategory.count({ where: { householdId: id } }),
      db.householdType.count({ where: { householdId: id } }),
    ])

    deletionCounts = {
      transactions: transactionCount,
      userHouseholds: userHouseholdCount,
      invitations: invitationCount,
      accounts: accountCount,
      householdUsers: householdUserCount,
      categories: categoryCount,
      types: typeCount,
    }

    // Perform cascading deletion in a transaction
    await db.$transaction(async (tx) => {
      // Delete in dependency order (most dependent first)

      // 1. Delete transactions (references accounts, categories, types, users)
      await tx.transaction.deleteMany({
        where: { householdId: id },
      })

      // 2. Delete user-household relationships
      await tx.userHousehold.deleteMany({
        where: { householdId: id },
      })

      // 3. Delete household invitations
      await tx.householdInvitation.deleteMany({
        where: { householdId: id },
      })

      // 4. Delete household accounts
      await tx.householdAccount.deleteMany({
        where: { householdId: id },
      })

      // 5. Delete household users
      await tx.householdUser.deleteMany({
        where: { householdId: id },
      })

      // 6. Delete household categories
      await tx.householdCategory.deleteMany({
        where: { householdId: id },
      })

      // 7. Delete household types
      await tx.householdType.deleteMany({
        where: { householdId: id },
      })

      // 8. Finally, delete the household itself
      await tx.household.delete({
        where: { id },
      })
    })

    return NextResponse.json({
      message: 'Household and all related data deleted successfully',
      deletedCounts: deletionCounts,
    })
  } catch (error) {
    await logApiError({
      request,
      error,
      operation: 'cascade delete household',
      context: {
        householdId: (await params).id,
        deletionCounts,
      },
    })
    return NextResponse.json({ error: 'Failed to delete household' }, { status: 500 })
  }
}
