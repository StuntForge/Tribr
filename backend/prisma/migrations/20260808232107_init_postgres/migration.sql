-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneVerifiedAt" TIMESTAMP(3),
    "acceptedTermsAt" TIMESTAMP(3),
    "firstName" TEXT,
    "age" INTEGER,
    "gender" TEXT,
    "locationLabel" TEXT,
    "locationLat" DOUBLE PRECISION,
    "locationLng" DOUBLE PRECISION,
    "homeAddress" TEXT,
    "bio" TEXT,
    "profilePhotoUrl" TEXT,
    "profileComplete" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionTier" TEXT NOT NULL DEFAULT 'FREE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lookingForGroup" BOOLEAN NOT NULL DEFAULT true,
    "workerSeedApplied" BOOLEAN NOT NULL DEFAULT true,
    "hostSeedApplied" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPhoto" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDietary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "detail" TEXT,

    CONSTRAINT "UserDietary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneVerification" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "JobCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "estimatedManHours" DOUBLE PRECISION NOT NULL,
    "locationType" TEXT NOT NULL,
    "locationLabel" TEXT,
    "locationLat" DOUBLE PRECISION,
    "locationLng" DOUBLE PRECISION,
    "exactAddress" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "activatedAt" TIMESTAMP(3),
    "groupId" TEXT,
    "cycleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskPhoto" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "TaskPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "locationLabel" TEXT,
    "locationLat" DOUBLE PRECISION,
    "locationLng" DOUBLE PRECISION,
    "preferredAgeMin" INTEGER,
    "preferredAgeMax" INTEGER,
    "preferredGender" TEXT,
    "durationBand" TEXT,
    "sizeMin" INTEGER NOT NULL,
    "sizeMax" INTEGER NOT NULL,
    "verifiedOnly" BOOLEAN NOT NULL DEFAULT false,
    "minRating" DOUBLE PRECISION,
    "leaderId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'RECRUITING',
    "currentCycleNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KickVote" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "KickVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KickBallot" (
    "id" TEXT NOT NULL,
    "voteId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KickBallot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupAllowedCategory" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "GroupAllowedCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupCycle" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "cycleNumber" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "taskOrder" TEXT,

    CONSTRAINT "GroupCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isLeader" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupApplication" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "suggestedTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupInvitation" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "invitedUserId" TEXT NOT NULL,
    "suggestedTaskId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityProposal" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revisionUsed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AvailabilityProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalSubmission" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DateOption" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "startTime" TEXT,
    "endTime" TEXT,

    CONSTRAINT "DateOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityResponse" (
    "id" TEXT NOT NULL,
    "dateOptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL,

    CONSTRAINT "AvailabilityResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkDay" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "confirmedDate" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "startTime" TEXT,
    "endTime" TEXT,
    "foodProvided" BOOLEAN NOT NULL DEFAULT false,
    "addressRevealed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupChatMessage" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "senderId" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "text" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupChatRead" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupChatRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DissolutionVote" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "outcome" TEXT,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "DissolutionVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DissolutionBallot" (
    "id" TEXT NOT NULL,
    "voteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "choice" TEXT NOT NULL,

    CONSTRAINT "DissolutionBallot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatingEvent" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "raterId" TEXT NOT NULL,
    "rateeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scoreA" INTEGER NOT NULL,
    "scoreB" INTEGER NOT NULL,
    "scoreC" INTEGER NOT NULL,
    "isNoShow" BOOLEAN NOT NULL DEFAULT false,
    "isValidAbsence" BOOLEAN NOT NULL DEFAULT false,
    "visible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT,
    "reportedGroupId" TEXT,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favourite" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "favouriteUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favourite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INACTIVE',
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "UserDietary_userId_idx" ON "UserDietary"("userId");

-- CreateIndex
CREATE INDEX "PhoneVerification_phone_idx" ON "PhoneVerification"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "JobCategory_name_key" ON "JobCategory"("name");

-- CreateIndex
CREATE INDEX "Task_ownerId_idx" ON "Task"("ownerId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Group_state_idx" ON "Group"("state");

-- CreateIndex
CREATE INDEX "KickVote_groupId_idx" ON "KickVote"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "KickBallot_voteId_voterId_key" ON "KickBallot"("voteId", "voterId");

-- CreateIndex
CREATE INDEX "GroupAllowedCategory_groupId_idx" ON "GroupAllowedCategory"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupAllowedCategory_groupId_categoryId_key" ON "GroupAllowedCategory"("groupId", "categoryId");

-- CreateIndex
CREATE INDEX "GroupCycle_groupId_idx" ON "GroupCycle"("groupId");

-- CreateIndex
CREATE INDEX "GroupMember_groupId_idx" ON "GroupMember"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");

-- CreateIndex
CREATE INDEX "GroupApplication_groupId_idx" ON "GroupApplication"("groupId");

-- CreateIndex
CREATE INDEX "GroupApplication_applicantId_idx" ON "GroupApplication"("applicantId");

-- CreateIndex
CREATE INDEX "GroupInvitation_groupId_idx" ON "GroupInvitation"("groupId");

-- CreateIndex
CREATE INDEX "GroupInvitation_invitedUserId_idx" ON "GroupInvitation"("invitedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalSubmission_proposalId_userId_key" ON "ProposalSubmission"("proposalId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityResponse_dateOptionId_userId_key" ON "AvailabilityResponse"("dateOptionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkDay_taskId_key" ON "WorkDay"("taskId");

-- CreateIndex
CREATE INDEX "GroupChatMessage_groupId_idx" ON "GroupChatMessage"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupChatRead_groupId_userId_key" ON "GroupChatRead"("groupId", "userId");

-- CreateIndex
CREATE INDEX "DissolutionVote_groupId_idx" ON "DissolutionVote"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "DissolutionBallot_voteId_userId_key" ON "DissolutionBallot"("voteId", "userId");

-- CreateIndex
CREATE INDEX "RatingEvent_rateeId_idx" ON "RatingEvent"("rateeId");

-- CreateIndex
CREATE INDEX "RatingEvent_taskId_idx" ON "RatingEvent"("taskId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Block_blockerId_blockedId_key" ON "Block"("blockerId", "blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "Favourite_ownerId_favouriteUserId_key" ON "Favourite"("ownerId", "favouriteUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminId_idx" ON "AdminAuditLog"("adminId");

-- AddForeignKey
ALTER TABLE "UserPhoto" ADD CONSTRAINT "UserPhoto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDietary" ADD CONSTRAINT "UserDietary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "JobCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "GroupCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPhoto" ADD CONSTRAINT "TaskPhoto_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickVote" ADD CONSTRAINT "KickVote_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickVote" ADD CONSTRAINT "KickVote_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickVote" ADD CONSTRAINT "KickVote_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickBallot" ADD CONSTRAINT "KickBallot_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "KickVote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickBallot" ADD CONSTRAINT "KickBallot_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupAllowedCategory" ADD CONSTRAINT "GroupAllowedCategory_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupAllowedCategory" ADD CONSTRAINT "GroupAllowedCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "JobCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupCycle" ADD CONSTRAINT "GroupCycle_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupApplication" ADD CONSTRAINT "GroupApplication_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupApplication" ADD CONSTRAINT "GroupApplication_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupApplication" ADD CONSTRAINT "GroupApplication_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupInvitation" ADD CONSTRAINT "GroupInvitation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupInvitation" ADD CONSTRAINT "GroupInvitation_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupInvitation" ADD CONSTRAINT "GroupInvitation_suggestedTaskId_fkey" FOREIGN KEY ("suggestedTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityProposal" ADD CONSTRAINT "AvailabilityProposal_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalSubmission" ADD CONSTRAINT "ProposalSubmission_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "AvailabilityProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalSubmission" ADD CONSTRAINT "ProposalSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DateOption" ADD CONSTRAINT "DateOption_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "AvailabilityProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityResponse" ADD CONSTRAINT "AvailabilityResponse_dateOptionId_fkey" FOREIGN KEY ("dateOptionId") REFERENCES "DateOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityResponse" ADD CONSTRAINT "AvailabilityResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkDay" ADD CONSTRAINT "WorkDay_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupChatMessage" ADD CONSTRAINT "GroupChatMessage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupChatMessage" ADD CONSTRAINT "GroupChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupChatRead" ADD CONSTRAINT "GroupChatRead_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupChatRead" ADD CONSTRAINT "GroupChatRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DissolutionVote" ADD CONSTRAINT "DissolutionVote_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DissolutionBallot" ADD CONSTRAINT "DissolutionBallot_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "DissolutionVote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DissolutionBallot" ADD CONSTRAINT "DissolutionBallot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingEvent" ADD CONSTRAINT "RatingEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingEvent" ADD CONSTRAINT "RatingEvent_raterId_fkey" FOREIGN KEY ("raterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingEvent" ADD CONSTRAINT "RatingEvent_rateeId_fkey" FOREIGN KEY ("rateeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favourite" ADD CONSTRAINT "Favourite_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favourite" ADD CONSTRAINT "Favourite_favouriteUserId_fkey" FOREIGN KEY ("favouriteUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

