/*
  Warnings:

  - You are about to drop the column `fileKey` on the `BundlePlusExtra` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[storageObjectId]` on the table `BundlePlusExtra` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "BundlePlusExtra" DROP COLUMN "fileKey",
ADD COLUMN     "storageObjectId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BundlePlusExtra_storageObjectId_key" ON "BundlePlusExtra"("storageObjectId");

-- AddForeignKey
ALTER TABLE "BundlePlusExtra" ADD CONSTRAINT "BundlePlusExtra_storageObjectId_fkey" FOREIGN KEY ("storageObjectId") REFERENCES "StorageObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
