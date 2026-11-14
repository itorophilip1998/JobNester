CREATE TABLE "Asset" (
 "id" TEXT NOT NULL,
 "key" TEXT NOT NULL,
 "mime" TEXT NOT NULL,
 "originalName" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Asset_key_key" ON "Asset"("key");
