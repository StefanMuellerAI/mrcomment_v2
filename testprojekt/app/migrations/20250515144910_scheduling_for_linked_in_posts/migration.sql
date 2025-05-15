-- CreateTable
CREATE TABLE "Schedule" (
    "linkedInPostId" TEXT NOT NULL,
    "postingDate" TIMESTAMP(3) NOT NULL,
    "reminderInMinutes" INTEGER,
    "isReminderSent" BOOLEAN NOT NULL DEFAULT false,
    "isPosted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("linkedInPostId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Schedule_linkedInPostId_key" ON "Schedule"("linkedInPostId");

-- CreateIndex
CREATE INDEX "Schedule_postingDate_idx" ON "Schedule"("postingDate");

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_linkedInPostId_fkey" FOREIGN KEY ("linkedInPostId") REFERENCES "LinkedInPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
