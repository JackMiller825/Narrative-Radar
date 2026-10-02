-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'demo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "chainPreference" TEXT NOT NULL DEFAULT 'ethereum',
    "schedulePreset" TEXT NOT NULL DEFAULT '5m',
    "customIntervalSeconds" INTEGER NOT NULL DEFAULT 300,
    "scheduleEnabled" BOOLEAN NOT NULL DEFAULT true,
    "scheduleVersion" INTEGER NOT NULL DEFAULT 1,
    "nextDueAt" TIMESTAMP(3),
    "lastAttemptedAt" TIMESTAMP(3),
    "lastSuccessfulAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "categories" JSONB NOT NULL,
    "languages" JSONB NOT NULL,
    "regions" JSONB NOT NULL,
    "freshnessHours" INTEGER NOT NULL DEFAULT 72,
    "excludedKeywords" JSONB NOT NULL,
    "watchedEntities" JSONB NOT NULL,
    "excludedSources" JSONB NOT NULL,
    "namingStyle" TEXT NOT NULL DEFAULT 'cute',
    "scoreWeights" JSONB NOT NULL,
    "dailyRequestLimit" INTEGER NOT NULL DEFAULT 2000,
    "textBudgetUsd" DOUBLE PRECISION,
    "imageBudgetUsd" DOUBLE PRECISION,
    "imageQueueCap" INTEGER NOT NULL DEFAULT 10,
    "pauseOnBudget" BOOLEAN NOT NULL DEFAULT true,
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "monitoringStartedAt" TIMESTAMP(3),
    "alertSound" BOOLEAN NOT NULL DEFAULT false,
    "priceAssumptions" JSONB NOT NULL,
    "browserNotifications" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderConnection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "lastSuccessAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT,
    "nextPermittedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedSubscription" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "etag" TEXT,
    "lastModified" TEXT,
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderCursor" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "cursor" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanRun" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "scheduleVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "stats" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerItemId" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "language" TEXT,
    "publishedAt" TIMESTAMP(3),
    "discoveredAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "contentHash" TEXT NOT NULL,
    "entities" JSONB NOT NULL,
    "provenance" JSONB NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "edited" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SourceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceObservation" (
    "id" TEXT NOT NULL,
    "sourceItemId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION,

    CONSTRAINT "SourceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Narrative" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "stableKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "lifecycle" TEXT NOT NULL,
    "provisional" BOOLEAN NOT NULL DEFAULT false,
    "rumor" BOOLEAN NOT NULL DEFAULT false,
    "narrativeScore" DOUBLE PRECISION,
    "evidenceConfidence" DOUBLE PRECISION,
    "dataCoverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "collisionStatus" TEXT NOT NULL DEFAULT 'not_checked',
    "independentSources" INTEGER NOT NULL DEFAULT 0,
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "topName" TEXT,
    "topTicker" TEXT,
    "chainRelevance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "board" TEXT NOT NULL DEFAULT 'new',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "tags" JSONB NOT NULL,
    "firstDiscoveredAt" TIMESTAMP(3) NOT NULL,
    "latestPublishedAt" TIMESTAMP(3),
    "latestMeaningfulAt" TIMESTAMP(3) NOT NULL,
    "latestAnalysisAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "mergedIntoId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Narrative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NarrativeSource" (
    "id" TEXT NOT NULL,
    "narrativeId" TEXT NOT NULL,
    "sourceItemId" TEXT NOT NULL,
    "independent" BOOLEAN NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "NarrativeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NarrativeVersion" (
    "id" TEXT NOT NULL,
    "narrativeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NarrativeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreSnapshot" (
    "id" TEXT NOT NULL,
    "narrativeId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "weights" JSONB NOT NULL,
    "components" JSONB NOT NULL,
    "narrativeScore" DOUBLE PRECISION,
    "evidenceConfidence" DOUBLE PRECISION,
    "dataCoverage" DOUBLE PRECISION NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandingOption" (
    "id" TEXT NOT NULL,
    "narrativeId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "story" TEXT NOT NULL,
    "wordplay" TEXT NOT NULL,
    "memorability" INTEGER NOT NULL,
    "narrativeFit" INTEGER NOT NULL,
    "style" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "isTop" BOOLEAN NOT NULL DEFAULT false,
    "userEdited" BOOLEAN NOT NULL DEFAULT false,
    "collisionStatus" TEXT NOT NULL DEFAULT 'not_checked',
    "checkedAt" TIMESTAMP(3),
    "matches" JSONB NOT NULL,

    CONSTRAINT "BrandingOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollisionCheck" (
    "id" TEXT NOT NULL,
    "narrativeId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "matches" JSONB NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollisionCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "narrativeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "illustrationKey" TEXT NOT NULL,
    "textKey" TEXT NOT NULL,
    "filePath" TEXT,
    "svg" TEXT,
    "error" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "prompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateNote" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "narrativeId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedCandidate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "narrativeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchRule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,

    CONSTRAINT "WatchRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "eventType" TEXT NOT NULL,
    "minScore" DOUBLE PRECISION,
    "minCoverage" DOUBLE PRECISION,
    "categories" JSONB NOT NULL,
    "freshnessHours" INTEGER,
    "chainMinRelevance" DOUBLE PRECISION,
    "excludeKeywords" JSONB NOT NULL,
    "includeProvisional" BOOLEAN NOT NULL DEFAULT false,
    "includeRumors" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'immediate',
    "quietStart" TEXT,
    "quietEnd" TEXT,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 30,
    "dailyCap" INTEGER NOT NULL DEFAULT 40,
    "channels" JSONB NOT NULL,
    "priorityBypassQuiet" BOOLEAN NOT NULL DEFAULT false,
    "hysteresis" DOUBLE PRECISION NOT NULL DEFAULT 5,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertArm" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "narrativeId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "armed" BOOLEAN NOT NULL DEFAULT true,
    "lastFiredAt" TIMESTAMP(3),

    CONSTRAINT "AlertArm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "narrativeId" TEXT,
    "ruleId" TEXT,
    "eventType" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "alertEventId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageLedger" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "units" DOUBLE PRECISION NOT NULL,
    "estimatedUsd" DOUBLE PRECISION,
    "measured" BOOLEAN NOT NULL DEFAULT true,
    "reservation" BOOLEAN NOT NULL DEFAULT false,
    "settled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceLock" (
    "workspaceId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "holder" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "heartbeatAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceLock_pkey" PRIMARY KEY ("workspaceId")
);

-- CreateTable
CREATE TABLE "ScheduleJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "scheduleVersion" INTEGER NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramLink" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "chatId" TEXT,
    "pairingCode" TEXT,
    "pairingExpiresAt" TIMESTAMP(3),
    "pairedAt" TIMESTAMP(3),
    "username" TEXT,

    CONSTRAINT "TelegramLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "narrativeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerHeartbeat" (
    "id" TEXT NOT NULL,
    "beatAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT NOT NULL,

    CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceSettings_workspaceId_key" ON "WorkspaceSettings"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConnection_workspaceId_provider_key" ON "ProviderConnection"("workspaceId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "FeedSubscription_workspaceId_url_key" ON "FeedSubscription"("workspaceId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderCursor_workspaceId_provider_key" ON "ProviderCursor"("workspaceId", "provider");

-- CreateIndex
CREATE INDEX "SourceItem_workspaceId_contentHash_idx" ON "SourceItem"("workspaceId", "contentHash");

-- CreateIndex
CREATE INDEX "SourceItem_workspaceId_canonicalUrl_idx" ON "SourceItem"("workspaceId", "canonicalUrl");

-- CreateIndex
CREATE UNIQUE INDEX "SourceItem_workspaceId_provider_providerItemId_key" ON "SourceItem"("workspaceId", "provider", "providerItemId");

-- CreateIndex
CREATE INDEX "SourceObservation_sourceItemId_metric_observedAt_idx" ON "SourceObservation"("sourceItemId", "metric", "observedAt");

-- CreateIndex
CREATE INDEX "Narrative_workspaceId_narrativeScore_idx" ON "Narrative"("workspaceId", "narrativeScore");

-- CreateIndex
CREATE INDEX "Narrative_workspaceId_latestMeaningfulAt_idx" ON "Narrative"("workspaceId", "latestMeaningfulAt");

-- CreateIndex
CREATE UNIQUE INDEX "Narrative_workspaceId_stableKey_key" ON "Narrative"("workspaceId", "stableKey");

-- CreateIndex
CREATE UNIQUE INDEX "NarrativeSource_narrativeId_sourceItemId_key" ON "NarrativeSource"("narrativeId", "sourceItemId");

-- CreateIndex
CREATE UNIQUE INDEX "NarrativeVersion_narrativeId_version_key" ON "NarrativeVersion"("narrativeId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "SavedCandidate_workspaceId_narrativeId_key" ON "SavedCandidate"("workspaceId", "narrativeId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchRule_workspaceId_entity_key" ON "WatchRule"("workspaceId", "entity");

-- CreateIndex
CREATE UNIQUE INDEX "AlertArm_narrativeId_ruleId_key" ON "AlertArm"("narrativeId", "ruleId");

-- CreateIndex
CREATE INDEX "AlertEvent_workspaceId_createdAt_idx" ON "AlertEvent"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlertEvent_workspaceId_dedupeKey_key" ON "AlertEvent"("workspaceId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDelivery_alertEventId_channel_key" ON "NotificationDelivery"("alertEventId", "channel");

-- CreateIndex
CREATE INDEX "UsageLedger_workspaceId_createdAt_idx" ON "UsageLedger"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "ScheduleJob_status_dueAt_idx" ON "ScheduleJob"("status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLink_workspaceId_key" ON "TelegramLink"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardEvent_workspaceId_seq_key" ON "DashboardEvent"("workspaceId", "seq");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceSettings" ADD CONSTRAINT "WorkspaceSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConnection" ADD CONSTRAINT "ProviderConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedSubscription" ADD CONSTRAINT "FeedSubscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanRun" ADD CONSTRAINT "ScanRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceItem" ADD CONSTRAINT "SourceItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceObservation" ADD CONSTRAINT "SourceObservation_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "SourceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Narrative" ADD CONSTRAINT "Narrative_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarrativeSource" ADD CONSTRAINT "NarrativeSource_narrativeId_fkey" FOREIGN KEY ("narrativeId") REFERENCES "Narrative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarrativeSource" ADD CONSTRAINT "NarrativeSource_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "SourceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NarrativeVersion" ADD CONSTRAINT "NarrativeVersion_narrativeId_fkey" FOREIGN KEY ("narrativeId") REFERENCES "Narrative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreSnapshot" ADD CONSTRAINT "ScoreSnapshot_narrativeId_fkey" FOREIGN KEY ("narrativeId") REFERENCES "Narrative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandingOption" ADD CONSTRAINT "BrandingOption_narrativeId_fkey" FOREIGN KEY ("narrativeId") REFERENCES "Narrative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollisionCheck" ADD CONSTRAINT "CollisionCheck_narrativeId_fkey" FOREIGN KEY ("narrativeId") REFERENCES "Narrative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_narrativeId_fkey" FOREIGN KEY ("narrativeId") REFERENCES "Narrative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateNote" ADD CONSTRAINT "CandidateNote_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateNote" ADD CONSTRAINT "CandidateNote_narrativeId_fkey" FOREIGN KEY ("narrativeId") REFERENCES "Narrative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedCandidate" ADD CONSTRAINT "SavedCandidate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedCandidate" ADD CONSTRAINT "SavedCandidate_narrativeId_fkey" FOREIGN KEY ("narrativeId") REFERENCES "Narrative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchRule" ADD CONSTRAINT "WatchRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertArm" ADD CONSTRAINT "AlertArm_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_alertEventId_fkey" FOREIGN KEY ("alertEventId") REFERENCES "AlertEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLedger" ADD CONSTRAINT "UsageLedger_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceLock" ADD CONSTRAINT "WorkspaceLock_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleJob" ADD CONSTRAINT "ScheduleJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramLink" ADD CONSTRAINT "TelegramLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_narrativeId_fkey" FOREIGN KEY ("narrativeId") REFERENCES "Narrative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardEvent" ADD CONSTRAINT "DashboardEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

