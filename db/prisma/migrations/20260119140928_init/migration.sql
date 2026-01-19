-- CreateEnum
CREATE TYPE "ProviderAuthConfigType" AS ENUM ('manual', 'oauth_automated', 'oauth_manual');

-- CreateEnum
CREATE TYPE "ProviderAuthConfigSource" AS ENUM ('manual', 'setup_session', 'system');

-- CreateEnum
CREATE TYPE "ProviderAuthConfigStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ProviderAuthCredentialsStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ProviderAuthCredentialsType" AS ENUM ('oauth');

-- CreateEnum
CREATE TYPE "ProviderOAuthSetupStatus" AS ENUM ('unused', 'opened', 'completed', 'failed', 'expired');

-- CreateEnum
CREATE TYPE "BackendType" AS ENUM ('slates');

-- CreateEnum
CREATE TYPE "ProviderConfigStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ProviderDeploymentStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ProviderDeploymentSpecificationDiscoveryStatus" AS ENUM ('discovering', 'discovered', 'failed');

-- CreateEnum
CREATE TYPE "ProviderDeploymentConfigPairSpecificationDiscoveryStatus" AS ENUM ('discovering', 'discovered', 'failed');

-- CreateEnum
CREATE TYPE "ProviderConfigVaultStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ProviderListingStatus" AS ENUM ('active', 'archived', 'banned');

-- CreateEnum
CREATE TYPE "ProviderAccess" AS ENUM ('public', 'tenant');

-- CreateEnum
CREATE TYPE "ProviderStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ProviderAuthMethodType" AS ENUM ('oauth', 'token', 'service_account', 'custom');

-- CreateEnum
CREATE TYPE "ProviderSpecificationChangeNotificationTarget" AS ENUM ('version', 'deployment_config_pair');

-- CreateEnum
CREATE TYPE "ProviderVersionSpecificationDiscoveryStatus" AS ENUM ('discovering', 'discovered', 'not_discoverable');

-- CreateEnum
CREATE TYPE "PublisherType" AS ENUM ('tenant', 'metorial', 'external');

-- CreateEnum
CREATE TYPE "SessionConnectionStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "SessionConnectionState" AS ENUM ('connected', 'disconnected');

-- CreateEnum
CREATE TYPE "SessionConnectionInitState" AS ENUM ('pending', 'completed');

-- CreateEnum
CREATE TYPE "SessionConnectionMcpConnectionTransport" AS ENUM ('none', 'sse', 'streamable_http');

-- CreateEnum
CREATE TYPE "SessionConnectionTransport" AS ENUM ('mcp', 'tool_call', 'metorial_protocol');

-- CreateEnum
CREATE TYPE "SessionErrorType" AS ENUM ('message_processing_timeout', 'message_processing_provider_error', 'message_processing_system_error');

-- CreateEnum
CREATE TYPE "SessionEventType" AS ENUM ('session_created', 'session_started', 'provider_run_started', 'provider_run_stopped', 'message_created', 'message_processed', 'connection_created', 'connection_connected', 'connection_disconnected', 'connection_disabled', 'error_occurred');

-- CreateEnum
CREATE TYPE "SessionMessageStatus" AS ENUM ('waiting_for_response', 'failed', 'succeeded');

-- CreateEnum
CREATE TYPE "SessionMessageType" AS ENUM ('tool_call', 'mcp_control', 'unknown');

-- CreateEnum
CREATE TYPE "SessionMessageSource" AS ENUM ('client');

-- CreateEnum
CREATE TYPE "SessionMessageFailureReason" AS ENUM ('timeout', 'provider_error', 'system_error', 'none');

-- CreateEnum
CREATE TYPE "SessionParticipantType" AS ENUM ('mcp_client', 'metorial_protocol_client', 'provider', 'system', 'tool_call', 'unknown');

-- CreateEnum
CREATE TYPE "SessionProviderStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ProviderRunStatus" AS ENUM ('running', 'stopped');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "SessionTemplateStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "SessionTemplateProviderStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ProviderSetupSessionStatus" AS ENUM ('pending', 'completed', 'failed', 'expired', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "ProviderSetupSessionType" AS ENUM ('auth_only', 'config_only', 'auth_and_config');

-- CreateEnum
CREATE TYPE "ProviderSetupSessionUiMode" AS ENUM ('metorial_elements', 'dashboard_embeddable');

-- CreateEnum
CREATE TYPE "ProviderSetupSessionEventType" AS ENUM ('created', 'link_opened', 'config_set', 'auth_config_set', 'oauth_setup_completed', 'oauth_setup_failed', 'completed', 'expired');

-- CreateTable
CREATE TABLE "ProviderAuthConfig" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ProviderAuthConfigType" NOT NULL,
    "source" "ProviderAuthConfigSource" NOT NULL,
    "status" "ProviderAuthConfigStatus" NOT NULL,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isEphemeral" BOOLEAN NOT NULL,
    "isDefault" BOOLEAN NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "providerOid" BIGINT NOT NULL,
    "authMethodOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "backendOid" BIGINT NOT NULL,
    "deploymentOid" BIGINT,
    "authCredentialsOid" BIGINT,
    "slateAuthConfigOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderAuthConfig_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderAuthConfigUpdate" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "authConfigOid" BIGINT NOT NULL,
    "slateAuthConfigOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderAuthConfigUpdate_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderAuthConfigUsedForDeployment" (
    "oid" BIGINT NOT NULL,
    "authConfigOid" BIGINT NOT NULL,
    "deploymentOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderAuthConfigUsedForDeployment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderAuthConfigUsedForConfig" (
    "oid" BIGINT NOT NULL,
    "authConfigOid" BIGINT NOT NULL,
    "configOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderAuthConfigUsedForConfig_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderAuthCredentials" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ProviderAuthCredentialsType" NOT NULL,
    "status" "ProviderAuthCredentialsStatus" NOT NULL,
    "isEphemeral" BOOLEAN NOT NULL,
    "isDefault" BOOLEAN NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "tenantOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "backendOid" BIGINT NOT NULL,
    "slateCredentialsOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderAuthCredentials_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderAuthExport" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "note" TEXT,
    "ip" TEXT,
    "ua" TEXT,
    "metadata" JSONB,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "tenantOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "authConfigOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ProviderAuthExport_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderAuthImport" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "ip" TEXT,
    "ua" TEXT,
    "note" TEXT,
    "metadata" JSONB,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "tenantOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "authConfigOid" BIGINT NOT NULL,
    "authConfigUpdateOid" BIGINT NOT NULL,
    "deploymentOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ProviderAuthImport_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderOAuthSetup" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ProviderOAuthSetupStatus" NOT NULL DEFAULT 'unused',
    "clientSecret" TEXT NOT NULL,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isEphemeral" BOOLEAN NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "redirectUrl" TEXT,
    "backendUrl" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "authCredentialsOid" BIGINT NOT NULL,
    "authMethodOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "deploymentOid" BIGINT,
    "authConfigOid" BIGINT,
    "slateOAuthSetupOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderOAuthSetup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Backend" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "BackendType" NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Backend_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderConfig" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ProviderConfigStatus" NOT NULL,
    "isDefault" BOOLEAN NOT NULL,
    "isEphemeral" BOOLEAN NOT NULL,
    "isForVault" BOOLEAN NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "tenantOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "specificationOid" BIGINT NOT NULL,
    "deploymentOid" BIGINT,
    "slateInstanceOid" BIGINT,
    "fromVaultOid" BIGINT,
    "parentConfigOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderConfig_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderDeployment" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ProviderDeploymentStatus" NOT NULL,
    "isEphemeral" BOOLEAN NOT NULL,
    "isDefault" BOOLEAN NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "specificationDiscoveryStatus" "ProviderDeploymentSpecificationDiscoveryStatus" NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "providerVariantOid" BIGINT NOT NULL,
    "lockedVersionOid" BIGINT,
    "defaultConfigOid" BIGINT,
    "defaultAuthConfigOid" BIGINT,
    "specificationOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderDeployment_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderDeploymentConfigPair" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "providerConfigOid" BIGINT NOT NULL,
    "providerDeploymentOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "lastUsedPairVersionOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderDeploymentConfigPair_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderDeploymentConfigPairProviderVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "pairOid" BIGINT NOT NULL,
    "versionOid" BIGINT NOT NULL,
    "previousPairVersionOid" BIGINT,
    "specificationDiscoveryStatus" "ProviderDeploymentConfigPairSpecificationDiscoveryStatus" NOT NULL,
    "specificationOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderDeploymentConfigPairProviderVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderDeploymentConfigPairSpecificationChange" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "fromSpecificationOid" BIGINT NOT NULL,
    "toSpecificationOid" BIGINT NOT NULL,
    "fromPairVersionOid" BIGINT NOT NULL,
    "toPairVersionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderDeploymentConfigPairSpecificationChange_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "TenantProvider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderConfigVault" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ProviderConfigVaultStatus" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "configOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "deploymentOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderConfigVault_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderListingCollection" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderListingCollection_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderListingCategory" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderListingCategory_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderListingGroup" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "tenantOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderListingGroup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderListing" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ProviderListingStatus" NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isCustomized" BOOLEAN NOT NULL DEFAULT false,
    "isMetorial" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "image" JSONB,
    "description" TEXT,
    "readme" TEXT,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "skills" TEXT[],
    "deploymentsCount" INTEGER NOT NULL DEFAULT 0,
    "providerSessionsCount" INTEGER NOT NULL DEFAULT 0,
    "providerMessagesCount" INTEGER NOT NULL DEFAULT 0,
    "ownerTenantOid" BIGINT,
    "ownerSolutionOid" INTEGER,
    "publisherOid" BIGINT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rankUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "ProviderListing_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderListingUpdate" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "providerListingOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderListingUpdate_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderEntry" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "publisherOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderEntry_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Provider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "access" "ProviderAccess" NOT NULL,
    "status" "ProviderStatus" NOT NULL,
    "tag" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "entryOid" BIGINT NOT NULL,
    "publisherOid" BIGINT NOT NULL,
    "ownerTenantOid" BIGINT,
    "ownerSolutionOid" INTEGER,
    "defaultVariantOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderToolGlobal" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "currentInstanceOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderToolGlobal_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderTool" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "specUniqueIdentifier" TEXT NOT NULL,
    "callableId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "value" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "specificationOid" BIGINT NOT NULL,
    "globalOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderTool_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderAuthMethodGlobal" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "currentInstanceOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderAuthMethodGlobal_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderAuthMethod" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "specUniqueIdentifier" TEXT NOT NULL,
    "callableId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" "ProviderAuthMethodType" NOT NULL,
    "isDefault" BOOLEAN NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "value" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "specificationOid" BIGINT NOT NULL,
    "globalOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderAuthMethod_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderSpecification" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "specUniqueIdentifier" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "value" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "supportsAuthMethod" BOOLEAN NOT NULL,
    "configContainsAuth" BOOLEAN NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderSpecification_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderVersionSpecificationChange" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "fromSpecificationOid" BIGINT NOT NULL,
    "toSpecificationOid" BIGINT NOT NULL,
    "fromVersionOid" BIGINT NOT NULL,
    "toVersionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderVersionSpecificationChange_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderSpecificationChangeNotification" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "target" "ProviderSpecificationChangeNotificationTarget" NOT NULL,
    "versionOid" BIGINT NOT NULL,
    "tenantOid" BIGINT,
    "solutionOid" INTEGER,
    "versionSpecificationChangeOid" BIGINT,
    "deploymentConfigPairOid" BIGINT,
    "pairSpecificationChangeOid" BIGINT,

    CONSTRAINT "ProviderSpecificationChangeNotification_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderTag" (
    "oid" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderTag_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderVariant" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "backendOid" BIGINT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "publisherOid" BIGINT NOT NULL,
    "slateOid" BIGINT,
    "currentVersionOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderVariant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "specificationDiscoveryStatus" "ProviderVersionSpecificationDiscoveryStatus" NOT NULL,
    "backendOid" BIGINT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "providerVariantOid" BIGINT NOT NULL,
    "previousVersionOid" BIGINT,
    "slateOid" BIGINT,
    "slateVersionOid" BIGINT,
    "specificationOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Publisher" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "PublisherType" NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tag" TEXT NOT NULL,
    "source" JSONB,
    "tenantOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Publisher_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionConnection" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "isEphemeral" BOOLEAN NOT NULL,
    "status" "SessionConnectionStatus" NOT NULL,
    "transport" "SessionConnectionTransport" NOT NULL,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "state" "SessionConnectionState" NOT NULL,
    "initState" "SessionConnectionInitState" NOT NULL,
    "isManuallyDisabled" BOOLEAN NOT NULL,
    "isReplaced" BOOLEAN NOT NULL,
    "totalProductiveClientMessageCount" INTEGER NOT NULL DEFAULT 0,
    "totalProductiveServerMessageCount" INTEGER NOT NULL DEFAULT 0,
    "sessionOid" BIGINT NOT NULL,
    "participantOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "mcpData" JSONB NOT NULL,
    "mcpTransport" "SessionConnectionMcpConnectionTransport" NOT NULL,
    "mcpProtocolVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastPingAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),

    CONSTRAINT "SessionConnection_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionErrorGroup" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "SessionErrorType" NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "firstOccurrenceOid" BIGINT,
    "providerOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SessionErrorGroup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionErrorGroupOccurrencePeriod" (
    "oid" BIGINT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 0,
    "groupOid" BIGINT NOT NULL,

    CONSTRAINT "SessionErrorGroupOccurrencePeriod_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionError" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "SessionErrorType" NOT NULL,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "isProcessing" BOOLEAN NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "groupOid" BIGINT,
    "connectionOid" BIGINT,
    "sessionOid" BIGINT NOT NULL,
    "providerRunOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionError_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionEvent" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "SessionEventType" NOT NULL,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "sessionOid" BIGINT NOT NULL,
    "providerRunOid" BIGINT,
    "messageOid" BIGINT,
    "connectionOid" BIGINT,
    "errorOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionMessage" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SessionMessageStatus" NOT NULL,
    "type" "SessionMessageType" NOT NULL,
    "source" "SessionMessageSource" NOT NULL,
    "transport" "SessionConnectionTransport" NOT NULL,
    "failureReason" "SessionMessageFailureReason" NOT NULL,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "methodOrToolKey" TEXT,
    "clientMcpId" JSONB NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "isProductive" BOOLEAN NOT NULL DEFAULT true,
    "isOffloadedToStorage" BOOLEAN NOT NULL DEFAULT false,
    "bucketOid" INTEGER NOT NULL,
    "sessionOid" BIGINT NOT NULL,
    "senderParticipantOid" BIGINT NOT NULL,
    "responderParticipantOid" BIGINT,
    "sessionProviderOid" BIGINT,
    "connectionOid" BIGINT,
    "providerRunOid" BIGINT,
    "slateToolCallOid" BIGINT,
    "errorOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "providerToolOid" BIGINT,

    CONSTRAINT "SessionMessage_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionMessageStorageBucket" (
    "oid" INTEGER NOT NULL,
    "bucket" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionMessageStorageBucket_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ToolCall" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "toolKey" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "sessionOid" BIGINT NOT NULL,
    "sessionProviderOid" BIGINT,
    "providerRunOid" BIGINT,
    "toolOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolCall_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionParticipant" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "SessionParticipantType" NOT NULL,
    "hash" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "providerOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionParticipant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionProvider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SessionProviderStatus" NOT NULL,
    "isEphemeral" BOOLEAN NOT NULL,
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "totalProductiveClientMessageCount" INTEGER NOT NULL DEFAULT 0,
    "totalProductiveServerMessageCount" INTEGER NOT NULL DEFAULT 0,
    "tag" TEXT NOT NULL,
    "toolFilter" JSONB NOT NULL,
    "sessionOid" BIGINT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "deploymentOid" BIGINT NOT NULL,
    "configOid" BIGINT NOT NULL,
    "authConfigOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "fromTemplateOid" BIGINT,
    "fromTemplateProviderOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3),

    CONSTRAINT "SessionProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderRun" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ProviderRunStatus" NOT NULL DEFAULT 'running',
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "providerOid" BIGINT NOT NULL,
    "sessionProviderOid" BIGINT NOT NULL,
    "providerVersionOid" BIGINT NOT NULL,
    "sessionOid" BIGINT NOT NULL,
    "instanceOid" BIGINT NOT NULL,
    "connectionOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "lastPingAt" TIMESTAMP(3),

    CONSTRAINT "ProviderRun_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionProviderInstance" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "totalProductiveClientMessageCount" INTEGER NOT NULL DEFAULT 0,
    "totalProductiveServerMessageCount" INTEGER NOT NULL DEFAULT 0,
    "sessionOid" BIGINT NOT NULL,
    "sessionProviderOid" BIGINT NOT NULL,
    "pairOid" BIGINT NOT NULL,
    "pairVersionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRenewedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionProviderInstance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Session" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL,
    "isEphemeral" BOOLEAN NOT NULL,
    "connectionState" "SessionConnectionState" NOT NULL DEFAULT 'disconnected',
    "isStarted" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "sharedProviderName" TEXT,
    "sharedProviderDescription" TEXT,
    "tenantOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "totalProductiveClientMessageCount" INTEGER NOT NULL DEFAULT 0,
    "totalProductiveServerMessageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastConnectionCreatedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionTemplate" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SessionTemplateStatus" NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "tenantOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionTemplate_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SessionTemplateProvider" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "SessionTemplateProviderStatus" NOT NULL,
    "toolFilter" JSONB NOT NULL,
    "sessionTemplateOid" BIGINT NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "deploymentOid" BIGINT NOT NULL,
    "configOid" BIGINT NOT NULL,
    "authConfigOid" BIGINT,
    "tenantOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionTemplateProvider_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateOAuthCredentials" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateOAuthCredentials_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateOAuthSetup" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateOAuthSetup_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateAuthConfig" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateAuthConfig_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateInstance" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "tenantOid" BIGINT NOT NULL,
    "lockedSlateVersionOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateInstance_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateToolCall" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "sessionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateToolCall_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateSession" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "providerRunOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateSession_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Slate" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Slate_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlateVersion" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "slateOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlateVersion_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "SlatesSyncChangeNotificationCursor" (
    "backendOid" BIGINT NOT NULL,
    "cursor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlatesSyncChangeNotificationCursor_pkey" PRIMARY KEY ("backendOid")
);

-- CreateTable
CREATE TABLE "Solution" (
    "oid" INTEGER NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Solution_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slateTenantId" TEXT,
    "slateTenantIdentifier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logRetentionInDays" INTEGER NOT NULL DEFAULT 30,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "Brand" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" JSONB,
    "tenantOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderSetupSession" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "status" "ProviderSetupSessionStatus" NOT NULL,
    "type" "ProviderSetupSessionType" NOT NULL,
    "uiMode" "ProviderSetupSessionUiMode" NOT NULL DEFAULT 'metorial_elements',
    "isParentDeleted" BOOLEAN NOT NULL DEFAULT false,
    "clientSecret" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "redirectUrl" TEXT,
    "tenantOid" BIGINT NOT NULL,
    "solutionOid" INTEGER NOT NULL,
    "providerOid" BIGINT NOT NULL,
    "authMethodOid" BIGINT NOT NULL,
    "deploymentOid" BIGINT,
    "authConfigOid" BIGINT,
    "configOid" BIGINT,
    "oauthSetupOid" BIGINT,
    "authCredentialsOid" BIGINT,
    "brandOid" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderSetupSession_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "ProviderSetupSessionEvent" (
    "oid" BIGINT NOT NULL,
    "id" TEXT NOT NULL,
    "type" "ProviderSetupSessionEventType" NOT NULL,
    "ip" TEXT,
    "ua" TEXT,
    "setupOid" BIGINT,
    "sessionOid" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderSetupSessionEvent_pkey" PRIMARY KEY ("oid")
);

-- CreateTable
CREATE TABLE "_ProviderListingToProviderListingCategory" (
    "A" BIGINT NOT NULL,
    "B" BIGINT NOT NULL,

    CONSTRAINT "_ProviderListingToProviderListingCategory_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ProviderListingToProviderListingCollection" (
    "A" BIGINT NOT NULL,
    "B" BIGINT NOT NULL,

    CONSTRAINT "_ProviderListingToProviderListingCollection_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ProviderListingToProviderListingGroup" (
    "A" BIGINT NOT NULL,
    "B" BIGINT NOT NULL,

    CONSTRAINT "_ProviderListingToProviderListingGroup_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthConfig_id_key" ON "ProviderAuthConfig"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthConfig_slateAuthConfigOid_key" ON "ProviderAuthConfig"("slateAuthConfigOid");

-- CreateIndex
CREATE INDEX "ProviderAuthConfig_isDefault_idx" ON "ProviderAuthConfig"("isDefault");

-- CreateIndex
CREATE INDEX "ProviderAuthConfig_status_idx" ON "ProviderAuthConfig"("status");

-- CreateIndex
CREATE INDEX "ProviderAuthConfig_type_idx" ON "ProviderAuthConfig"("type");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthConfigUpdate_id_key" ON "ProviderAuthConfigUpdate"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthConfigUpdate_slateAuthConfigOid_key" ON "ProviderAuthConfigUpdate"("slateAuthConfigOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthConfigUsedForDeployment_authConfigOid_deploymen_key" ON "ProviderAuthConfigUsedForDeployment"("authConfigOid", "deploymentOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthConfigUsedForConfig_authConfigOid_configOid_key" ON "ProviderAuthConfigUsedForConfig"("authConfigOid", "configOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthCredentials_id_key" ON "ProviderAuthCredentials"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthCredentials_slateCredentialsOid_key" ON "ProviderAuthCredentials"("slateCredentialsOid");

-- CreateIndex
CREATE INDEX "ProviderAuthCredentials_isDefault_idx" ON "ProviderAuthCredentials"("isDefault");

-- CreateIndex
CREATE INDEX "ProviderAuthCredentials_status_idx" ON "ProviderAuthCredentials"("status");

-- CreateIndex
CREATE INDEX "ProviderAuthCredentials_type_idx" ON "ProviderAuthCredentials"("type");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthExport_id_key" ON "ProviderAuthExport"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthImport_id_key" ON "ProviderAuthImport"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderOAuthSetup_id_key" ON "ProviderOAuthSetup"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderOAuthSetup_slateOAuthSetupOid_key" ON "ProviderOAuthSetup"("slateOAuthSetupOid");

-- CreateIndex
CREATE INDEX "ProviderOAuthSetup_status_idx" ON "ProviderOAuthSetup"("status");

-- CreateIndex
CREATE INDEX "ProviderOAuthSetup_expiresAt_idx" ON "ProviderOAuthSetup"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Backend_id_key" ON "Backend"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Backend_type_key" ON "Backend"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Backend_identifier_key" ON "Backend"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConfig_id_key" ON "ProviderConfig"("id");

-- CreateIndex
CREATE INDEX "ProviderConfig_isDefault_idx" ON "ProviderConfig"("isDefault");

-- CreateIndex
CREATE INDEX "ProviderConfig_status_idx" ON "ProviderConfig"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderDeployment_id_key" ON "ProviderDeployment"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderDeployment_defaultConfigOid_key" ON "ProviderDeployment"("defaultConfigOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderDeployment_defaultAuthConfigOid_key" ON "ProviderDeployment"("defaultAuthConfigOid");

-- CreateIndex
CREATE INDEX "ProviderDeployment_isDefault_idx" ON "ProviderDeployment"("isDefault");

-- CreateIndex
CREATE INDEX "ProviderDeployment_status_idx" ON "ProviderDeployment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderDeploymentConfigPair_id_key" ON "ProviderDeploymentConfigPair"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderDeploymentConfigPair_providerConfigOid_providerDepl_key" ON "ProviderDeploymentConfigPair"("providerConfigOid", "providerDeploymentOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderDeploymentConfigPairProviderVersion_id_key" ON "ProviderDeploymentConfigPairProviderVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderDeploymentConfigPairProviderVersion_pairOid_version_key" ON "ProviderDeploymentConfigPairProviderVersion"("pairOid", "versionOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderDeploymentConfigPairSpecificationChange_id_key" ON "ProviderDeploymentConfigPairSpecificationChange"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderDeploymentConfigPairSpecificationChange_fromPairVer_key" ON "ProviderDeploymentConfigPairSpecificationChange"("fromPairVersionOid", "toPairVersionOid", "fromSpecificationOid", "toSpecificationOid");

-- CreateIndex
CREATE UNIQUE INDEX "TenantProvider_id_key" ON "TenantProvider"("id");

-- CreateIndex
CREATE UNIQUE INDEX "TenantProvider_tenantOid_providerOid_key" ON "TenantProvider"("tenantOid", "providerOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConfigVault_id_key" ON "ProviderConfigVault"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConfigVault_configOid_key" ON "ProviderConfigVault"("configOid");

-- CreateIndex
CREATE INDEX "ProviderConfigVault_status_idx" ON "ProviderConfigVault"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderListingCollection_id_key" ON "ProviderListingCollection"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderListingCollection_slug_key" ON "ProviderListingCollection"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderListingCategory_id_key" ON "ProviderListingCategory"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderListingCategory_slug_key" ON "ProviderListingCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderListingGroup_id_key" ON "ProviderListingGroup"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderListingGroup_tenantOid_slug_key" ON "ProviderListingGroup"("tenantOid", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderListing_id_key" ON "ProviderListing"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderListing_slug_key" ON "ProviderListing"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderListing_providerOid_key" ON "ProviderListing"("providerOid");

-- CreateIndex
CREATE INDEX "ProviderListing_rank_idx" ON "ProviderListing"("rank");

-- CreateIndex
CREATE INDEX "ProviderListing_status_idx" ON "ProviderListing"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderListingUpdate_id_key" ON "ProviderListingUpdate"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderEntry_id_key" ON "ProviderEntry"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderEntry_identifier_key" ON "ProviderEntry"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_id_key" ON "Provider"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_tag_key" ON "Provider"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_identifier_key" ON "Provider"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_slug_key" ON "Provider"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_entryOid_key" ON "Provider"("entryOid");

-- CreateIndex
CREATE INDEX "Provider_status_idx" ON "Provider"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderToolGlobal_id_key" ON "ProviderToolGlobal"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderToolGlobal_providerOid_key_key" ON "ProviderToolGlobal"("providerOid", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTool_id_key" ON "ProviderTool"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTool_providerOid_specificationOid_hash_key" ON "ProviderTool"("providerOid", "specificationOid", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTool_specificationOid_key_key" ON "ProviderTool"("specificationOid", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthMethodGlobal_id_key" ON "ProviderAuthMethodGlobal"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthMethodGlobal_providerOid_key_key" ON "ProviderAuthMethodGlobal"("providerOid", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthMethod_id_key" ON "ProviderAuthMethod"("id");

-- CreateIndex
CREATE INDEX "ProviderAuthMethod_isDefault_idx" ON "ProviderAuthMethod"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthMethod_providerOid_specificationOid_hash_key" ON "ProviderAuthMethod"("providerOid", "specificationOid", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAuthMethod_specificationOid_key_key" ON "ProviderAuthMethod"("specificationOid", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSpecification_id_key" ON "ProviderSpecification"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSpecification_providerOid_hash_key" ON "ProviderSpecification"("providerOid", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderVersionSpecificationChange_id_key" ON "ProviderVersionSpecificationChange"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderVersionSpecificationChange_fromVersionOid_toVersion_key" ON "ProviderVersionSpecificationChange"("fromVersionOid", "toVersionOid", "fromSpecificationOid", "toSpecificationOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSpecificationChangeNotification_id_key" ON "ProviderSpecificationChangeNotification"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSpecificationChangeNotification_versionSpecificatio_key" ON "ProviderSpecificationChangeNotification"("versionSpecificationChangeOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSpecificationChangeNotification_pairSpecificationCh_key" ON "ProviderSpecificationChangeNotification"("pairSpecificationChangeOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTag_id_key" ON "ProviderTag"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderTag_tag_key" ON "ProviderTag"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderVariant_id_key" ON "ProviderVariant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderVariant_tag_key" ON "ProviderVariant"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderVariant_identifier_key" ON "ProviderVariant"("identifier");

-- CreateIndex
CREATE INDEX "ProviderVariant_isDefault_idx" ON "ProviderVariant"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderVersion_id_key" ON "ProviderVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderVersion_tag_key" ON "ProviderVersion"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderVersion_identifier_key" ON "ProviderVersion"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Publisher_id_key" ON "Publisher"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Publisher_identifier_key" ON "Publisher"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Publisher_tag_key" ON "Publisher"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "SessionConnection_id_key" ON "SessionConnection"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SessionConnection_token_key" ON "SessionConnection"("token");

-- CreateIndex
CREATE INDEX "SessionConnection_lastActiveAt_idx" ON "SessionConnection"("lastActiveAt");

-- CreateIndex
CREATE INDEX "SessionConnection_state_idx" ON "SessionConnection"("state");

-- CreateIndex
CREATE INDEX "SessionConnection_status_idx" ON "SessionConnection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SessionErrorGroup_id_key" ON "SessionErrorGroup"("id");

-- CreateIndex
CREATE INDEX "SessionErrorGroup_type_idx" ON "SessionErrorGroup"("type");

-- CreateIndex
CREATE UNIQUE INDEX "SessionErrorGroup_type_hash_tenantOid_key" ON "SessionErrorGroup"("type", "hash", "tenantOid");

-- CreateIndex
CREATE UNIQUE INDEX "SessionErrorGroupOccurrencePeriod_groupOid_startsAt_key" ON "SessionErrorGroupOccurrencePeriod"("groupOid", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "SessionError_id_key" ON "SessionError"("id");

-- CreateIndex
CREATE INDEX "SessionError_type_idx" ON "SessionError"("type");

-- CreateIndex
CREATE UNIQUE INDEX "SessionEvent_id_key" ON "SessionEvent"("id");

-- CreateIndex
CREATE INDEX "SessionEvent_type_idx" ON "SessionEvent"("type");

-- CreateIndex
CREATE UNIQUE INDEX "SessionMessage_id_key" ON "SessionMessage"("id");

-- CreateIndex
CREATE INDEX "SessionMessage_isOffloadedToStorage_idx" ON "SessionMessage"("isOffloadedToStorage");

-- CreateIndex
CREATE INDEX "SessionMessage_status_idx" ON "SessionMessage"("status");

-- CreateIndex
CREATE INDEX "SessionMessage_type_idx" ON "SessionMessage"("type");

-- CreateIndex
CREATE UNIQUE INDEX "SessionMessageStorageBucket_bucket_key" ON "SessionMessageStorageBucket"("bucket");

-- CreateIndex
CREATE UNIQUE INDEX "ToolCall_id_key" ON "ToolCall"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ToolCall_messageId_key" ON "ToolCall"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionParticipant_id_key" ON "SessionParticipant"("id");

-- CreateIndex
CREATE INDEX "SessionParticipant_type_idx" ON "SessionParticipant"("type");

-- CreateIndex
CREATE UNIQUE INDEX "SessionParticipant_tenantOid_type_hash_key" ON "SessionParticipant"("tenantOid", "type", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "SessionProvider_id_key" ON "SessionProvider"("id");

-- CreateIndex
CREATE INDEX "SessionProvider_status_idx" ON "SessionProvider"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SessionProvider_sessionOid_tag_key" ON "SessionProvider"("sessionOid", "tag");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderRun_id_key" ON "ProviderRun"("id");

-- CreateIndex
CREATE INDEX "ProviderRun_status_idx" ON "ProviderRun"("status");

-- CreateIndex
CREATE INDEX "ProviderRun_lastPingAt_idx" ON "ProviderRun"("lastPingAt");

-- CreateIndex
CREATE UNIQUE INDEX "SessionProviderInstance_id_key" ON "SessionProviderInstance"("id");

-- CreateIndex
CREATE INDEX "SessionProviderInstance_expiresAt_idx" ON "SessionProviderInstance"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_id_key" ON "Session"("id");

-- CreateIndex
CREATE INDEX "Session_lastActiveAt_idx" ON "Session"("lastActiveAt");

-- CreateIndex
CREATE INDEX "Session_connectionState_idx" ON "Session"("connectionState");

-- CreateIndex
CREATE INDEX "Session_status_idx" ON "Session"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SessionTemplate_id_key" ON "SessionTemplate"("id");

-- CreateIndex
CREATE INDEX "SessionTemplate_status_idx" ON "SessionTemplate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SessionTemplateProvider_id_key" ON "SessionTemplateProvider"("id");

-- CreateIndex
CREATE INDEX "SessionTemplateProvider_status_idx" ON "SessionTemplateProvider"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SlateOAuthCredentials_id_key" ON "SlateOAuthCredentials"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateOAuthSetup_id_key" ON "SlateOAuthSetup"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateAuthConfig_id_key" ON "SlateAuthConfig"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateInstance_id_key" ON "SlateInstance"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateToolCall_id_key" ON "SlateToolCall"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateSession_id_key" ON "SlateSession"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Slate_id_key" ON "Slate"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Slate_identifier_key" ON "Slate"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "SlateVersion_id_key" ON "SlateVersion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SlateVersion_identifier_key" ON "SlateVersion"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Solution_id_key" ON "Solution"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Solution_identifier_key" ON "Solution"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_id_key" ON "Tenant"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_identifier_key" ON "Tenant"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_id_key" ON "Brand"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_identifier_key" ON "Brand"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_tenantOid_key" ON "Brand"("tenantOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSetupSession_id_key" ON "ProviderSetupSession"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSetupSession_authConfigOid_key" ON "ProviderSetupSession"("authConfigOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSetupSession_configOid_key" ON "ProviderSetupSession"("configOid");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSetupSession_oauthSetupOid_key" ON "ProviderSetupSession"("oauthSetupOid");

-- CreateIndex
CREATE INDEX "ProviderSetupSession_status_idx" ON "ProviderSetupSession"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSetupSessionEvent_id_key" ON "ProviderSetupSessionEvent"("id");

-- CreateIndex
CREATE INDEX "_ProviderListingToProviderListingCategory_B_index" ON "_ProviderListingToProviderListingCategory"("B");

-- CreateIndex
CREATE INDEX "_ProviderListingToProviderListingCollection_B_index" ON "_ProviderListingToProviderListingCollection"("B");

-- CreateIndex
CREATE INDEX "_ProviderListingToProviderListingGroup_B_index" ON "_ProviderListingToProviderListingGroup"("B");

-- AddForeignKey
ALTER TABLE "ProviderAuthConfig" ADD CONSTRAINT "ProviderAuthConfig_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfig" ADD CONSTRAINT "ProviderAuthConfig_authMethodOid_fkey" FOREIGN KEY ("authMethodOid") REFERENCES "ProviderAuthMethod"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfig" ADD CONSTRAINT "ProviderAuthConfig_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfig" ADD CONSTRAINT "ProviderAuthConfig_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfig" ADD CONSTRAINT "ProviderAuthConfig_backendOid_fkey" FOREIGN KEY ("backendOid") REFERENCES "Backend"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfig" ADD CONSTRAINT "ProviderAuthConfig_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "ProviderDeployment"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfig" ADD CONSTRAINT "ProviderAuthConfig_authCredentialsOid_fkey" FOREIGN KEY ("authCredentialsOid") REFERENCES "ProviderAuthCredentials"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfig" ADD CONSTRAINT "ProviderAuthConfig_slateAuthConfigOid_fkey" FOREIGN KEY ("slateAuthConfigOid") REFERENCES "SlateAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigUpdate" ADD CONSTRAINT "ProviderAuthConfigUpdate_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "ProviderAuthConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigUpdate" ADD CONSTRAINT "ProviderAuthConfigUpdate_slateAuthConfigOid_fkey" FOREIGN KEY ("slateAuthConfigOid") REFERENCES "SlateAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigUsedForDeployment" ADD CONSTRAINT "ProviderAuthConfigUsedForDeployment_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "ProviderAuthConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigUsedForDeployment" ADD CONSTRAINT "ProviderAuthConfigUsedForDeployment_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "ProviderDeployment"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigUsedForConfig" ADD CONSTRAINT "ProviderAuthConfigUsedForConfig_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "ProviderAuthConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthConfigUsedForConfig" ADD CONSTRAINT "ProviderAuthConfigUsedForConfig_configOid_fkey" FOREIGN KEY ("configOid") REFERENCES "ProviderConfig"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthCredentials" ADD CONSTRAINT "ProviderAuthCredentials_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthCredentials" ADD CONSTRAINT "ProviderAuthCredentials_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthCredentials" ADD CONSTRAINT "ProviderAuthCredentials_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthCredentials" ADD CONSTRAINT "ProviderAuthCredentials_backendOid_fkey" FOREIGN KEY ("backendOid") REFERENCES "Backend"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthCredentials" ADD CONSTRAINT "ProviderAuthCredentials_slateCredentialsOid_fkey" FOREIGN KEY ("slateCredentialsOid") REFERENCES "SlateOAuthCredentials"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthExport" ADD CONSTRAINT "ProviderAuthExport_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthExport" ADD CONSTRAINT "ProviderAuthExport_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthExport" ADD CONSTRAINT "ProviderAuthExport_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "ProviderAuthConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthImport" ADD CONSTRAINT "ProviderAuthImport_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthImport" ADD CONSTRAINT "ProviderAuthImport_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthImport" ADD CONSTRAINT "ProviderAuthImport_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "ProviderAuthConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthImport" ADD CONSTRAINT "ProviderAuthImport_authConfigUpdateOid_fkey" FOREIGN KEY ("authConfigUpdateOid") REFERENCES "ProviderAuthConfigUpdate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthImport" ADD CONSTRAINT "ProviderAuthImport_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "ProviderDeployment"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthSetup" ADD CONSTRAINT "ProviderOAuthSetup_authCredentialsOid_fkey" FOREIGN KEY ("authCredentialsOid") REFERENCES "ProviderAuthCredentials"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthSetup" ADD CONSTRAINT "ProviderOAuthSetup_authMethodOid_fkey" FOREIGN KEY ("authMethodOid") REFERENCES "ProviderAuthMethod"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthSetup" ADD CONSTRAINT "ProviderOAuthSetup_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthSetup" ADD CONSTRAINT "ProviderOAuthSetup_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthSetup" ADD CONSTRAINT "ProviderOAuthSetup_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthSetup" ADD CONSTRAINT "ProviderOAuthSetup_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "ProviderDeployment"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthSetup" ADD CONSTRAINT "ProviderOAuthSetup_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "ProviderAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderOAuthSetup" ADD CONSTRAINT "ProviderOAuthSetup_slateOAuthSetupOid_fkey" FOREIGN KEY ("slateOAuthSetupOid") REFERENCES "SlateOAuthSetup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfig" ADD CONSTRAINT "ProviderConfig_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfig" ADD CONSTRAINT "ProviderConfig_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfig" ADD CONSTRAINT "ProviderConfig_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfig" ADD CONSTRAINT "ProviderConfig_specificationOid_fkey" FOREIGN KEY ("specificationOid") REFERENCES "ProviderSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfig" ADD CONSTRAINT "ProviderConfig_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "ProviderDeployment"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfig" ADD CONSTRAINT "ProviderConfig_slateInstanceOid_fkey" FOREIGN KEY ("slateInstanceOid") REFERENCES "SlateInstance"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfig" ADD CONSTRAINT "ProviderConfig_fromVaultOid_fkey" FOREIGN KEY ("fromVaultOid") REFERENCES "ProviderConfigVault"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfig" ADD CONSTRAINT "ProviderConfig_parentConfigOid_fkey" FOREIGN KEY ("parentConfigOid") REFERENCES "ProviderConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeployment" ADD CONSTRAINT "ProviderDeployment_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeployment" ADD CONSTRAINT "ProviderDeployment_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeployment" ADD CONSTRAINT "ProviderDeployment_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeployment" ADD CONSTRAINT "ProviderDeployment_providerVariantOid_fkey" FOREIGN KEY ("providerVariantOid") REFERENCES "ProviderVariant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeployment" ADD CONSTRAINT "ProviderDeployment_lockedVersionOid_fkey" FOREIGN KEY ("lockedVersionOid") REFERENCES "ProviderVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeployment" ADD CONSTRAINT "ProviderDeployment_defaultConfigOid_fkey" FOREIGN KEY ("defaultConfigOid") REFERENCES "ProviderConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeployment" ADD CONSTRAINT "ProviderDeployment_defaultAuthConfigOid_fkey" FOREIGN KEY ("defaultAuthConfigOid") REFERENCES "ProviderAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeployment" ADD CONSTRAINT "ProviderDeployment_specificationOid_fkey" FOREIGN KEY ("specificationOid") REFERENCES "ProviderSpecification"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPair" ADD CONSTRAINT "ProviderDeploymentConfigPair_providerConfigOid_fkey" FOREIGN KEY ("providerConfigOid") REFERENCES "ProviderConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPair" ADD CONSTRAINT "ProviderDeploymentConfigPair_providerDeploymentOid_fkey" FOREIGN KEY ("providerDeploymentOid") REFERENCES "ProviderDeployment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPair" ADD CONSTRAINT "ProviderDeploymentConfigPair_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPair" ADD CONSTRAINT "ProviderDeploymentConfigPair_lastUsedPairVersionOid_fkey" FOREIGN KEY ("lastUsedPairVersionOid") REFERENCES "ProviderDeploymentConfigPairProviderVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPairProviderVersion" ADD CONSTRAINT "ProviderDeploymentConfigPairProviderVersion_pairOid_fkey" FOREIGN KEY ("pairOid") REFERENCES "ProviderDeploymentConfigPair"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPairProviderVersion" ADD CONSTRAINT "ProviderDeploymentConfigPairProviderVersion_versionOid_fkey" FOREIGN KEY ("versionOid") REFERENCES "ProviderVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPairProviderVersion" ADD CONSTRAINT "ProviderDeploymentConfigPairProviderVersion_previousPairVe_fkey" FOREIGN KEY ("previousPairVersionOid") REFERENCES "ProviderDeploymentConfigPairProviderVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPairProviderVersion" ADD CONSTRAINT "ProviderDeploymentConfigPairProviderVersion_specificationO_fkey" FOREIGN KEY ("specificationOid") REFERENCES "ProviderSpecification"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPairSpecificationChange" ADD CONSTRAINT "ProviderDeploymentConfigPairSpecificationChange_fromSpecif_fkey" FOREIGN KEY ("fromSpecificationOid") REFERENCES "ProviderSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPairSpecificationChange" ADD CONSTRAINT "ProviderDeploymentConfigPairSpecificationChange_toSpecific_fkey" FOREIGN KEY ("toSpecificationOid") REFERENCES "ProviderSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPairSpecificationChange" ADD CONSTRAINT "ProviderDeploymentConfigPairSpecificationChange_fromPairVe_fkey" FOREIGN KEY ("fromPairVersionOid") REFERENCES "ProviderDeploymentConfigPairProviderVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderDeploymentConfigPairSpecificationChange" ADD CONSTRAINT "ProviderDeploymentConfigPairSpecificationChange_toPairVers_fkey" FOREIGN KEY ("toPairVersionOid") REFERENCES "ProviderDeploymentConfigPairProviderVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantProvider" ADD CONSTRAINT "TenantProvider_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantProvider" ADD CONSTRAINT "TenantProvider_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantProvider" ADD CONSTRAINT "TenantProvider_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfigVault" ADD CONSTRAINT "ProviderConfigVault_configOid_fkey" FOREIGN KEY ("configOid") REFERENCES "ProviderConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfigVault" ADD CONSTRAINT "ProviderConfigVault_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfigVault" ADD CONSTRAINT "ProviderConfigVault_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfigVault" ADD CONSTRAINT "ProviderConfigVault_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderConfigVault" ADD CONSTRAINT "ProviderConfigVault_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "ProviderDeployment"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderListingGroup" ADD CONSTRAINT "ProviderListingGroup_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderListingGroup" ADD CONSTRAINT "ProviderListingGroup_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderListing" ADD CONSTRAINT "ProviderListing_ownerTenantOid_fkey" FOREIGN KEY ("ownerTenantOid") REFERENCES "Tenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderListing" ADD CONSTRAINT "ProviderListing_ownerSolutionOid_fkey" FOREIGN KEY ("ownerSolutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderListing" ADD CONSTRAINT "ProviderListing_publisherOid_fkey" FOREIGN KEY ("publisherOid") REFERENCES "Publisher"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderListing" ADD CONSTRAINT "ProviderListing_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderListingUpdate" ADD CONSTRAINT "ProviderListingUpdate_providerListingOid_fkey" FOREIGN KEY ("providerListingOid") REFERENCES "ProviderListing"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderEntry" ADD CONSTRAINT "ProviderEntry_publisherOid_fkey" FOREIGN KEY ("publisherOid") REFERENCES "Publisher"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_tag_fkey" FOREIGN KEY ("tag") REFERENCES "ProviderTag"("tag") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_entryOid_fkey" FOREIGN KEY ("entryOid") REFERENCES "ProviderEntry"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_publisherOid_fkey" FOREIGN KEY ("publisherOid") REFERENCES "Publisher"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_ownerTenantOid_fkey" FOREIGN KEY ("ownerTenantOid") REFERENCES "Tenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_ownerSolutionOid_fkey" FOREIGN KEY ("ownerSolutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Provider" ADD CONSTRAINT "Provider_defaultVariantOid_fkey" FOREIGN KEY ("defaultVariantOid") REFERENCES "ProviderVariant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderToolGlobal" ADD CONSTRAINT "ProviderToolGlobal_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderToolGlobal" ADD CONSTRAINT "ProviderToolGlobal_currentInstanceOid_fkey" FOREIGN KEY ("currentInstanceOid") REFERENCES "ProviderTool"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTool" ADD CONSTRAINT "ProviderTool_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTool" ADD CONSTRAINT "ProviderTool_specificationOid_fkey" FOREIGN KEY ("specificationOid") REFERENCES "ProviderSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderTool" ADD CONSTRAINT "ProviderTool_globalOid_fkey" FOREIGN KEY ("globalOid") REFERENCES "ProviderToolGlobal"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthMethodGlobal" ADD CONSTRAINT "ProviderAuthMethodGlobal_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthMethodGlobal" ADD CONSTRAINT "ProviderAuthMethodGlobal_currentInstanceOid_fkey" FOREIGN KEY ("currentInstanceOid") REFERENCES "ProviderAuthMethod"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthMethod" ADD CONSTRAINT "ProviderAuthMethod_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthMethod" ADD CONSTRAINT "ProviderAuthMethod_specificationOid_fkey" FOREIGN KEY ("specificationOid") REFERENCES "ProviderSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderAuthMethod" ADD CONSTRAINT "ProviderAuthMethod_globalOid_fkey" FOREIGN KEY ("globalOid") REFERENCES "ProviderAuthMethodGlobal"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSpecification" ADD CONSTRAINT "ProviderSpecification_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersionSpecificationChange" ADD CONSTRAINT "ProviderVersionSpecificationChange_fromSpecificationOid_fkey" FOREIGN KEY ("fromSpecificationOid") REFERENCES "ProviderSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersionSpecificationChange" ADD CONSTRAINT "ProviderVersionSpecificationChange_toSpecificationOid_fkey" FOREIGN KEY ("toSpecificationOid") REFERENCES "ProviderSpecification"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersionSpecificationChange" ADD CONSTRAINT "ProviderVersionSpecificationChange_fromVersionOid_fkey" FOREIGN KEY ("fromVersionOid") REFERENCES "ProviderVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersionSpecificationChange" ADD CONSTRAINT "ProviderVersionSpecificationChange_toVersionOid_fkey" FOREIGN KEY ("toVersionOid") REFERENCES "ProviderVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSpecificationChangeNotification" ADD CONSTRAINT "ProviderSpecificationChangeNotification_versionOid_fkey" FOREIGN KEY ("versionOid") REFERENCES "ProviderVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSpecificationChangeNotification" ADD CONSTRAINT "ProviderSpecificationChangeNotification_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSpecificationChangeNotification" ADD CONSTRAINT "ProviderSpecificationChangeNotification_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSpecificationChangeNotification" ADD CONSTRAINT "ProviderSpecificationChangeNotification_versionSpecificati_fkey" FOREIGN KEY ("versionSpecificationChangeOid") REFERENCES "ProviderVersionSpecificationChange"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSpecificationChangeNotification" ADD CONSTRAINT "ProviderSpecificationChangeNotification_deploymentConfigPa_fkey" FOREIGN KEY ("deploymentConfigPairOid") REFERENCES "ProviderDeploymentConfigPair"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSpecificationChangeNotification" ADD CONSTRAINT "ProviderSpecificationChangeNotification_pairSpecificationC_fkey" FOREIGN KEY ("pairSpecificationChangeOid") REFERENCES "ProviderDeploymentConfigPairSpecificationChange"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVariant" ADD CONSTRAINT "ProviderVariant_tag_fkey" FOREIGN KEY ("tag") REFERENCES "ProviderTag"("tag") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVariant" ADD CONSTRAINT "ProviderVariant_backendOid_fkey" FOREIGN KEY ("backendOid") REFERENCES "Backend"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVariant" ADD CONSTRAINT "ProviderVariant_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVariant" ADD CONSTRAINT "ProviderVariant_publisherOid_fkey" FOREIGN KEY ("publisherOid") REFERENCES "Publisher"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVariant" ADD CONSTRAINT "ProviderVariant_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVariant" ADD CONSTRAINT "ProviderVariant_currentVersionOid_fkey" FOREIGN KEY ("currentVersionOid") REFERENCES "ProviderVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersion" ADD CONSTRAINT "ProviderVersion_tag_fkey" FOREIGN KEY ("tag") REFERENCES "ProviderTag"("tag") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersion" ADD CONSTRAINT "ProviderVersion_backendOid_fkey" FOREIGN KEY ("backendOid") REFERENCES "Backend"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersion" ADD CONSTRAINT "ProviderVersion_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersion" ADD CONSTRAINT "ProviderVersion_providerVariantOid_fkey" FOREIGN KEY ("providerVariantOid") REFERENCES "ProviderVariant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersion" ADD CONSTRAINT "ProviderVersion_previousVersionOid_fkey" FOREIGN KEY ("previousVersionOid") REFERENCES "ProviderVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersion" ADD CONSTRAINT "ProviderVersion_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersion" ADD CONSTRAINT "ProviderVersion_slateVersionOid_fkey" FOREIGN KEY ("slateVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderVersion" ADD CONSTRAINT "ProviderVersion_specificationOid_fkey" FOREIGN KEY ("specificationOid") REFERENCES "ProviderSpecification"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publisher" ADD CONSTRAINT "Publisher_tag_fkey" FOREIGN KEY ("tag") REFERENCES "ProviderTag"("tag") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Publisher" ADD CONSTRAINT "Publisher_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionConnection" ADD CONSTRAINT "SessionConnection_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "Session"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionConnection" ADD CONSTRAINT "SessionConnection_participantOid_fkey" FOREIGN KEY ("participantOid") REFERENCES "SessionParticipant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionConnection" ADD CONSTRAINT "SessionConnection_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionConnection" ADD CONSTRAINT "SessionConnection_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionErrorGroup" ADD CONSTRAINT "SessionErrorGroup_firstOccurrenceOid_fkey" FOREIGN KEY ("firstOccurrenceOid") REFERENCES "SessionError"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionErrorGroup" ADD CONSTRAINT "SessionErrorGroup_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionErrorGroup" ADD CONSTRAINT "SessionErrorGroup_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionErrorGroupOccurrencePeriod" ADD CONSTRAINT "SessionErrorGroupOccurrencePeriod_groupOid_fkey" FOREIGN KEY ("groupOid") REFERENCES "SessionErrorGroup"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionError" ADD CONSTRAINT "SessionError_groupOid_fkey" FOREIGN KEY ("groupOid") REFERENCES "SessionErrorGroup"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionError" ADD CONSTRAINT "SessionError_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "SessionConnection"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionError" ADD CONSTRAINT "SessionError_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "Session"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionError" ADD CONSTRAINT "SessionError_providerRunOid_fkey" FOREIGN KEY ("providerRunOid") REFERENCES "ProviderRun"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionError" ADD CONSTRAINT "SessionError_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionError" ADD CONSTRAINT "SessionError_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "Session"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_providerRunOid_fkey" FOREIGN KEY ("providerRunOid") REFERENCES "ProviderRun"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_messageOid_fkey" FOREIGN KEY ("messageOid") REFERENCES "SessionMessage"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "SessionConnection"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_errorOid_fkey" FOREIGN KEY ("errorOid") REFERENCES "SessionError"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_bucketOid_fkey" FOREIGN KEY ("bucketOid") REFERENCES "SessionMessageStorageBucket"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "Session"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_senderParticipantOid_fkey" FOREIGN KEY ("senderParticipantOid") REFERENCES "SessionParticipant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_responderParticipantOid_fkey" FOREIGN KEY ("responderParticipantOid") REFERENCES "SessionParticipant"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_sessionProviderOid_fkey" FOREIGN KEY ("sessionProviderOid") REFERENCES "SessionProvider"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "SessionConnection"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_providerRunOid_fkey" FOREIGN KEY ("providerRunOid") REFERENCES "ProviderRun"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_slateToolCallOid_fkey" FOREIGN KEY ("slateToolCallOid") REFERENCES "SlateToolCall"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_errorOid_fkey" FOREIGN KEY ("errorOid") REFERENCES "SessionError"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionMessage" ADD CONSTRAINT "SessionMessage_providerToolOid_fkey" FOREIGN KEY ("providerToolOid") REFERENCES "ProviderTool"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "SessionMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "Session"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_sessionProviderOid_fkey" FOREIGN KEY ("sessionProviderOid") REFERENCES "SessionProvider"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_providerRunOid_fkey" FOREIGN KEY ("providerRunOid") REFERENCES "ProviderRun"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_toolOid_fkey" FOREIGN KEY ("toolOid") REFERENCES "ProviderTool"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolCall" ADD CONSTRAINT "ToolCall_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProvider" ADD CONSTRAINT "SessionProvider_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "Session"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProvider" ADD CONSTRAINT "SessionProvider_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProvider" ADD CONSTRAINT "SessionProvider_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "ProviderDeployment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProvider" ADD CONSTRAINT "SessionProvider_configOid_fkey" FOREIGN KEY ("configOid") REFERENCES "ProviderConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProvider" ADD CONSTRAINT "SessionProvider_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "ProviderAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProvider" ADD CONSTRAINT "SessionProvider_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProvider" ADD CONSTRAINT "SessionProvider_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProvider" ADD CONSTRAINT "SessionProvider_fromTemplateOid_fkey" FOREIGN KEY ("fromTemplateOid") REFERENCES "SessionTemplate"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProvider" ADD CONSTRAINT "SessionProvider_fromTemplateProviderOid_fkey" FOREIGN KEY ("fromTemplateProviderOid") REFERENCES "SessionTemplateProvider"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRun" ADD CONSTRAINT "ProviderRun_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRun" ADD CONSTRAINT "ProviderRun_sessionProviderOid_fkey" FOREIGN KEY ("sessionProviderOid") REFERENCES "SessionProvider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRun" ADD CONSTRAINT "ProviderRun_providerVersionOid_fkey" FOREIGN KEY ("providerVersionOid") REFERENCES "ProviderVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRun" ADD CONSTRAINT "ProviderRun_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "Session"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRun" ADD CONSTRAINT "ProviderRun_instanceOid_fkey" FOREIGN KEY ("instanceOid") REFERENCES "SessionProviderInstance"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRun" ADD CONSTRAINT "ProviderRun_connectionOid_fkey" FOREIGN KEY ("connectionOid") REFERENCES "SessionConnection"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRun" ADD CONSTRAINT "ProviderRun_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderRun" ADD CONSTRAINT "ProviderRun_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProviderInstance" ADD CONSTRAINT "SessionProviderInstance_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "Session"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProviderInstance" ADD CONSTRAINT "SessionProviderInstance_sessionProviderOid_fkey" FOREIGN KEY ("sessionProviderOid") REFERENCES "SessionProvider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProviderInstance" ADD CONSTRAINT "SessionProviderInstance_pairOid_fkey" FOREIGN KEY ("pairOid") REFERENCES "ProviderDeploymentConfigPair"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionProviderInstance" ADD CONSTRAINT "SessionProviderInstance_pairVersionOid_fkey" FOREIGN KEY ("pairVersionOid") REFERENCES "ProviderDeploymentConfigPairProviderVersion"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplate" ADD CONSTRAINT "SessionTemplate_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplate" ADD CONSTRAINT "SessionTemplate_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplateProvider" ADD CONSTRAINT "SessionTemplateProvider_sessionTemplateOid_fkey" FOREIGN KEY ("sessionTemplateOid") REFERENCES "SessionTemplate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplateProvider" ADD CONSTRAINT "SessionTemplateProvider_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplateProvider" ADD CONSTRAINT "SessionTemplateProvider_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "ProviderDeployment"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplateProvider" ADD CONSTRAINT "SessionTemplateProvider_configOid_fkey" FOREIGN KEY ("configOid") REFERENCES "ProviderConfig"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplateProvider" ADD CONSTRAINT "SessionTemplateProvider_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "ProviderAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplateProvider" ADD CONSTRAINT "SessionTemplateProvider_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplateProvider" ADD CONSTRAINT "SessionTemplateProvider_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateOAuthCredentials" ADD CONSTRAINT "SlateOAuthCredentials_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateOAuthCredentials" ADD CONSTRAINT "SlateOAuthCredentials_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateOAuthSetup" ADD CONSTRAINT "SlateOAuthSetup_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateOAuthSetup" ADD CONSTRAINT "SlateOAuthSetup_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAuthConfig" ADD CONSTRAINT "SlateAuthConfig_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateAuthConfig" ADD CONSTRAINT "SlateAuthConfig_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstance" ADD CONSTRAINT "SlateInstance_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstance" ADD CONSTRAINT "SlateInstance_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateInstance" ADD CONSTRAINT "SlateInstance_lockedSlateVersionOid_fkey" FOREIGN KEY ("lockedSlateVersionOid") REFERENCES "SlateVersion"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateToolCall" ADD CONSTRAINT "SlateToolCall_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "SlateSession"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateSession" ADD CONSTRAINT "SlateSession_providerRunOid_fkey" FOREIGN KEY ("providerRunOid") REFERENCES "ProviderRun"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlateVersion" ADD CONSTRAINT "SlateVersion_slateOid_fkey" FOREIGN KEY ("slateOid") REFERENCES "Slate"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlatesSyncChangeNotificationCursor" ADD CONSTRAINT "SlatesSyncChangeNotificationCursor_backendOid_fkey" FOREIGN KEY ("backendOid") REFERENCES "Backend"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_tenantOid_fkey" FOREIGN KEY ("tenantOid") REFERENCES "Tenant"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_solutionOid_fkey" FOREIGN KEY ("solutionOid") REFERENCES "Solution"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_providerOid_fkey" FOREIGN KEY ("providerOid") REFERENCES "Provider"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_authMethodOid_fkey" FOREIGN KEY ("authMethodOid") REFERENCES "ProviderAuthMethod"("oid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_deploymentOid_fkey" FOREIGN KEY ("deploymentOid") REFERENCES "ProviderDeployment"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_authConfigOid_fkey" FOREIGN KEY ("authConfigOid") REFERENCES "ProviderAuthConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_configOid_fkey" FOREIGN KEY ("configOid") REFERENCES "ProviderConfig"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_oauthSetupOid_fkey" FOREIGN KEY ("oauthSetupOid") REFERENCES "ProviderOAuthSetup"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_authCredentialsOid_fkey" FOREIGN KEY ("authCredentialsOid") REFERENCES "ProviderAuthCredentials"("oid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSession" ADD CONSTRAINT "ProviderSetupSession_brandOid_fkey" FOREIGN KEY ("brandOid") REFERENCES "Brand"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSessionEvent" ADD CONSTRAINT "ProviderSetupSessionEvent_setupOid_fkey" FOREIGN KEY ("setupOid") REFERENCES "ProviderOAuthSetup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSetupSessionEvent" ADD CONSTRAINT "ProviderSetupSessionEvent_sessionOid_fkey" FOREIGN KEY ("sessionOid") REFERENCES "ProviderSetupSession"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProviderListingToProviderListingCategory" ADD CONSTRAINT "_ProviderListingToProviderListingCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "ProviderListing"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProviderListingToProviderListingCategory" ADD CONSTRAINT "_ProviderListingToProviderListingCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "ProviderListingCategory"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProviderListingToProviderListingCollection" ADD CONSTRAINT "_ProviderListingToProviderListingCollection_A_fkey" FOREIGN KEY ("A") REFERENCES "ProviderListing"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProviderListingToProviderListingCollection" ADD CONSTRAINT "_ProviderListingToProviderListingCollection_B_fkey" FOREIGN KEY ("B") REFERENCES "ProviderListingCollection"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProviderListingToProviderListingGroup" ADD CONSTRAINT "_ProviderListingToProviderListingGroup_A_fkey" FOREIGN KEY ("A") REFERENCES "ProviderListing"("oid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProviderListingToProviderListingGroup" ADD CONSTRAINT "_ProviderListingToProviderListingGroup_B_fkey" FOREIGN KEY ("B") REFERENCES "ProviderListingGroup"("oid") ON DELETE CASCADE ON UPDATE CASCADE;
