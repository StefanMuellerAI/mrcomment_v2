-- CreateTable
CREATE TABLE "CustomerDailyUsage" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "customerId" TEXT NOT NULL,
    "commentGenerations" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CustomerDailyUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerDailyUsage_date_idx" ON "CustomerDailyUsage"("date");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerDailyUsage_customerId_date_key" ON "CustomerDailyUsage"("customerId", "date");

-- AddForeignKey
ALTER TABLE "CustomerDailyUsage" ADD CONSTRAINT "CustomerDailyUsage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
