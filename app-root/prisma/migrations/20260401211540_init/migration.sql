-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "skills" TEXT[],
    "experience" INTEGER NOT NULL,
    "location" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "company" TEXT,
    "education" TEXT,
    "skillScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roleScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "experienceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "domainScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trajectoryScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "referralScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reasoning" TEXT[],
    "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "resumeText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "filterSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "filterExperienceMin" INTEGER,
    "filterExperienceMax" INTEGER,
    "filterLocation" TEXT,
    "filterDomain" TEXT,
    "filterRole" TEXT,
    "semanticIntent" TEXT,
    "excludedCandidates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rankingPreferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "jdRole" TEXT,
    "jdSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "jdExperience" TEXT,
    "jdDomain" TEXT,
    "jdResponsibilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "candidateIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "suggestions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Candidate_domain_idx" ON "Candidate"("domain");

-- CreateIndex
CREATE INDEX "Candidate_experience_idx" ON "Candidate"("experience");

-- CreateIndex
CREATE INDEX "Candidate_location_idx" ON "Candidate"("location");

-- CreateIndex
CREATE INDEX "Message_sessionId_idx" ON "Message"("sessionId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
