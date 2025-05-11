/*
  Warnings:

  - You are about to drop the `CustomerDailyUsage` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CustomerDailyUsage" DROP CONSTRAINT "CustomerDailyUsage_customerId_fkey";

-- DropTable
DROP TABLE "CustomerDailyUsage";
