-- Social Tribes: purely additive schema (Group discriminator + Social-only
-- fields, JobCategory.kind, GroupApplication.taskId widened to nullable,
-- and six new Social scheduling/attendance tables). Every existing row is
-- unaffected: Group.tribeType and JobCategory.kind both default to 'WORK'.

-- JobCategory: WORK vs SOCIAL category kind
ALTER TABLE "JobCategory" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'WORK';

-- Group: tribeType discriminator + Social-only fields
ALTER TABLE "Group" ADD COLUMN "tribeType" TEXT NOT NULL DEFAULT 'WORK';
ALTER TABLE "Group" ADD COLUMN "socialCategoryId" TEXT;
ALTER TABLE "Group" ADD COLUMN "dateType" TEXT;
ALTER TABLE "Group" ADD COLUMN "fixedDate" TIMESTAMP(3);
ALTER TABLE "Group" ADD COLUMN "fixedAllDay" BOOLEAN;
ALTER TABLE "Group" ADD COLUMN "fixedStartTime" TEXT;
ALTER TABLE "Group" ADD COLUMN "fixedEndTime" TEXT;
ALTER TABLE "Group" ADD COLUMN "socialScheduleWindowStart" TIMESTAMP(3);

ALTER TABLE "Group" ADD CONSTRAINT "Group_socialCategoryId_fkey" FOREIGN KEY ("socialCategoryId") REFERENCES "JobCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- GroupApplication.taskId: widen from required to optional (Social Tribe
-- applications have no task). This only relaxes the constraint - it cannot
-- violate any existing row, since every existing row already has a taskId.
ALTER TABLE "GroupApplication" DROP CONSTRAINT "GroupApplication_taskId_fkey";
ALTER TABLE "GroupApplication" ALTER COLUMN "taskId" DROP NOT NULL;
ALTER TABLE "GroupApplication" ADD CONSTRAINT "GroupApplication_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Social Tribes scheduling ("Schedule Together") - a parallel, group-id-
-- keyed mirror of AvailabilityProposal/DateOption/AvailabilityResponse/
-- WorkDay, used only for Social Tribes (no per-member task/queue).
CREATE TABLE "SocialEventProposal" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revisionUsed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SocialEventProposal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialEventProposal_groupId_key" ON "SocialEventProposal"("groupId");

CREATE TABLE "SocialProposalSubmission" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialProposalSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialProposalSubmission_proposalId_userId_key" ON "SocialProposalSubmission"("proposalId", "userId");

CREATE TABLE "SocialDateOption" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "startTime" TEXT,
    "endTime" TEXT,

    CONSTRAINT "SocialDateOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialAvailabilityResponse" (
    "id" TEXT NOT NULL,
    "dateOptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL,

    CONSTRAINT "SocialAvailabilityResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialAvailabilityResponse_dateOptionId_userId_key" ON "SocialAvailabilityResponse"("dateOptionId", "userId");

-- The confirmed date for a Social Tribe's shared activity - the Social
-- equivalent of WorkDay, but 1:1 with the Group instead of a Task.
CREATE TABLE "SocialEvent" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "confirmedDate" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "startTime" TEXT,
    "endTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialEvent_groupId_key" ON "SocialEvent"("groupId");

-- Recorded once per committed member after a Social Tribe's event date has
-- passed. Deliberately not RatingEvent - no star score, just a plain
-- outcome feeding Social Reliability.
CREATE TABLE "SocialAttendance" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialAttendance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialAttendance_groupId_userId_key" ON "SocialAttendance"("groupId", "userId");

-- Foreign keys
ALTER TABLE "SocialEventProposal" ADD CONSTRAINT "SocialEventProposal_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialProposalSubmission" ADD CONSTRAINT "SocialProposalSubmission_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "SocialEventProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialProposalSubmission" ADD CONSTRAINT "SocialProposalSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialDateOption" ADD CONSTRAINT "SocialDateOption_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "SocialEventProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialAvailabilityResponse" ADD CONSTRAINT "SocialAvailabilityResponse_dateOptionId_fkey" FOREIGN KEY ("dateOptionId") REFERENCES "SocialDateOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialAvailabilityResponse" ADD CONSTRAINT "SocialAvailabilityResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialEvent" ADD CONSTRAINT "SocialEvent_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialAttendance" ADD CONSTRAINT "SocialAttendance_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialAttendance" ADD CONSTRAINT "SocialAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
