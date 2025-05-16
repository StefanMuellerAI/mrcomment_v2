/*
  Warnings:

  - A unique constraint covering the columns `[linkedInPostUgcId]` on the table `LinkedInPost` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "LinkedInPost" ADD COLUMN     "linkedInPostUgcId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LinkedInPost_linkedInPostUgcId_key" ON "LinkedInPost"("linkedInPostUgcId");
