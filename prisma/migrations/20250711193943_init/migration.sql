-- CreateEnum
CREATE TYPE "household_role" AS ENUM ('OWNER', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "invitation_status" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "clerk_user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_household" (
    "user_id" UUID NOT NULL,
    "household_id" UUID NOT NULL,
    "role" "household_role" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invited_by" UUID,

    CONSTRAINT "user_household_pkey" PRIMARY KEY ("user_id","household_id")
);

-- CreateTable
CREATE TABLE "household_invitation" (
    "id" UUID NOT NULL,
    "household_id" UUID NOT NULL,
    "inviter_user_id" UUID NOT NULL,
    "invitee_email" TEXT NOT NULL,
    "invitee_user_id" UUID,
    "role" "household_role" NOT NULL DEFAULT 'MEMBER',
    "status" "invitation_status" NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "annual_budget" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_account" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "household_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_user" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "household_id" UUID NOT NULL,
    "annual_budget" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_category" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "household_id" UUID NOT NULL,
    "annual_budget" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_type" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "household_id" UUID NOT NULL,
    "is_outflow" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction" (
    "id" UUID NOT NULL,
    "household_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "user_id" UUID,
    "transaction_date" DATE NOT NULL,
    "post_date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "type_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_clerk_user_id_key" ON "user"("clerk_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "household_invitation_token_key" ON "household_invitation"("token");

-- CreateIndex
CREATE INDEX "household_invitation_invitee_email_idx" ON "household_invitation"("invitee_email");

-- CreateIndex
CREATE INDEX "household_invitation_token_idx" ON "household_invitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "household_account_name_household_id_key" ON "household_account"("name", "household_id");

-- CreateIndex
CREATE UNIQUE INDEX "household_user_name_household_id_key" ON "household_user"("name", "household_id");

-- CreateIndex
CREATE UNIQUE INDEX "household_category_name_household_id_key" ON "household_category"("name", "household_id");

-- CreateIndex
CREATE UNIQUE INDEX "household_type_name_household_id_key" ON "household_type"("name", "household_id");

-- CreateIndex
CREATE INDEX "transaction_household_id_idx" ON "transaction"("household_id");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_household_id_transaction_date_description_amoun_key" ON "transaction"("household_id", "transaction_date", "description", "amount");

-- AddForeignKey
ALTER TABLE "user_household" ADD CONSTRAINT "user_household_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_household" ADD CONSTRAINT "user_household_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_invitation" ADD CONSTRAINT "household_invitation_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_invitation" ADD CONSTRAINT "household_invitation_inviter_user_id_fkey" FOREIGN KEY ("inviter_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_invitation" ADD CONSTRAINT "household_invitation_invitee_user_id_fkey" FOREIGN KEY ("invitee_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_account" ADD CONSTRAINT "household_account_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_user" ADD CONSTRAINT "household_user_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_category" ADD CONSTRAINT "household_category_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_type" ADD CONSTRAINT "household_type_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "household_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "household_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "household_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "household_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
