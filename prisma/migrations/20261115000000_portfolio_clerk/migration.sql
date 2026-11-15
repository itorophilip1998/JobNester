ALTER TABLE "Owner" ADD COLUMN "clerkUserId" TEXT;
ALTER TABLE "Owner" ADD COLUMN "contactRecipient" TEXT;
CREATE UNIQUE INDEX "Owner_clerkUserId_key" ON "Owner"("clerkUserId");
ALTER TABLE "Inquiry" ADD COLUMN "deliveryStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Inquiry" ADD COLUMN "deliveredAt" TIMESTAMP(3);
