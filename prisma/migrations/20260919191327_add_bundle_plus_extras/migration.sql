-- CreateEnum
CREATE TYPE "BundlePlusExtraType" AS ENUM ('TEXT', 'FILE');

-- CreateTable
CREATE TABLE "BundlePlusExtra" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "BundlePlusExtraType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "fileKey" TEXT,
    "fileName" TEXT,
    "fileContentType" TEXT,
    "fileSizeBytes" BIGINT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BundlePlusExtra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BundlePlusExtra_productId_sortOrder_idx" ON "BundlePlusExtra"("productId", "sortOrder");

-- AddForeignKey
ALTER TABLE "BundlePlusExtra" ADD CONSTRAINT "BundlePlusExtra_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
