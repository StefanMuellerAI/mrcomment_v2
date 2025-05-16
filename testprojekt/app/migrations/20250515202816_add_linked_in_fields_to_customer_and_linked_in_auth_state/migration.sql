-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "linkedinAccessToken" TEXT,
ADD COLUMN     "linkedinAccessTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "linkedinGrantedScopes" TEXT[],
ADD COLUMN     "linkedinProfileData" JSONB,
ADD COLUMN     "linkedinRefreshToken" TEXT,
ADD COLUMN     "linkedinUserId" TEXT;

-- CreateTable
CREATE TABLE "LinkedInAuthState" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "initiatingWaspUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedInAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LinkedInAuthState_state_key" ON "LinkedInAuthState"("state");

-- CreateIndex
CREATE INDEX "LinkedInAuthState_expiresAt_idx" ON "LinkedInAuthState"("expiresAt");
