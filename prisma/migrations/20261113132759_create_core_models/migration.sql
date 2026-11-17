-- CreateEnum
CREATE TYPE "ExtractionMethod" AS ENUM ('PDF_TEXT', 'PDF_LLM', 'MANUAL');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'REVIEWED', 'DOWNLOADED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cv" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "data" JSONB NOT NULL,
    "extractionMethod" "ExtractionMethod" NOT NULL,
    "pageCount" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPost" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "rawText" TEXT NOT NULL,
    "title" TEXT,
    "company" TEXT,
    "analysis" JSONB,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" UUID NOT NULL,
    "cvId" UUID NOT NULL,
    "jobPostId" UUID NOT NULL,
    "tailoredCv" JSONB,
    "coverLetter" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Cv_userId_idx" ON "Cv"("userId");

-- CreateIndex
CREATE INDEX "Cv_expiresAt_idx" ON "Cv"("expiresAt");

-- CreateIndex
CREATE INDEX "JobPost_userId_idx" ON "JobPost"("userId");

-- CreateIndex
CREATE INDEX "JobPost_expiresAt_idx" ON "JobPost"("expiresAt");

-- CreateIndex
CREATE INDEX "Application_cvId_idx" ON "Application"("cvId");

-- CreateIndex
CREATE INDEX "Application_jobPostId_idx" ON "Application"("jobPostId");

-- AddForeignKey
ALTER TABLE "Cv" ADD CONSTRAINT "Cv_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPost" ADD CONSTRAINT "JobPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "Cv"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobPostId_fkey" FOREIGN KEY ("jobPostId") REFERENCES "JobPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
