import { useState, useMemo, useCallback } from 'react';
import { renderWithLoader, useMutation } from '@metorial-io/data-hooks';
import { Button, Flex, Error } from '@metorial-io/ui';
import { client } from '../../state/client';
import { authConfigSchemaState, configSchemaState } from '../../state/setupSession';
import { MetorialElementsLayout } from './layouts/MetorialElementsLayout';
import { DashboardEmbeddableLayout } from './layouts/DashboardEmbeddableLayout';
import { AuthConfigStep } from './steps/AuthConfigStep';
import { ConfigStep } from './steps/ConfigStep';
import { OAuthRedirectStep } from './steps/OAuthRedirectStep';
import { CompletedStep } from './steps/CompletedStep';
import type { JsonSchema } from '../../lib/jsonSchema';

type SessionType = 'auth_only' | 'config_only' | 'auth_and_config';
type UiMode = 'metorial_elements' | 'dashboard_embeddable';
type Step = 'auth_config' | 'oauth_redirect' | 'config' | 'completed';

interface Session {
  id: string;
  type: SessionType;
  uiMode: UiMode;
  status: string;
  authConfig: unknown | null;
  config: unknown | null;
  redirectUrl: string | null;
  providerId: string;
  authMethod: {
    id: string;
    type: string;
    name: string;
  };
}

interface Brand {
  name: string;
  image: string | null;
}

interface SetupSessionFlowProps {
  session: Session;
  brand: Brand;
  clientSecret: string;
}

interface OAuthSetup {
  url: string | null;
  authMethod: { name: string };
}

let hasSchemaFields = (schema: JsonSchema | null) => {
  return schema !== null && Object.keys(schema.properties || {}).length > 0;
};

let extractSchema = (result: unknown): JsonSchema | null => {
  let r = result as { schema?: { type: string; schema: unknown } } | null;
  if (r?.schema?.type === 'required') {
    return r.schema.schema as JsonSchema;
  }
  return null;
};

export let SetupSessionFlow = ({ session, brand, clientSecret }: SetupSessionFlowProps) => {
  let needsAuthConfig = session.type !== 'config_only' && !session.authConfig;
  let needsConfig = session.type !== 'auth_only' && !session.config;
  let isOAuth = session.authMethod.type === 'oauth';

  let loaderInput = { sessionId: session.id, clientSecret };
  let authSchemaLoader = authConfigSchemaState.use(needsAuthConfig ? loaderInput : null);
  let configSchemaLoader = configSchemaState.use(needsConfig ? loaderInput : null);

  let [currentStep, setCurrentStep] = useState<Step | null>(null);
  let [oauthSetup, setOauthSetup] = useState<OAuthSetup | null>(null);

  let authConfigSchema = extractSchema(authSchemaLoader.data);
  let configSchema = extractSchema(configSchemaLoader.data);

  let determineStep = useCallback((): Step => {
    if (needsAuthConfig && hasSchemaFields(authConfigSchema)) return 'auth_config';
    if (needsConfig && hasSchemaFields(configSchema)) return 'config';
    return 'completed';
  }, [needsAuthConfig, needsConfig, authConfigSchema, configSchema]);

  let authConfigMutation = useMutation(async (data: Record<string, unknown>) => {
    await client.setupSession.setAuthConfig({
      sessionId: session.id,
      clientSecret,
      authConfigInput: data
    });

    if (isOAuth) {
      let oauthResult = await client.setupSession.getOauthSetup({
        sessionId: session.id,
        clientSecret
      });
      if (oauthResult) {
        setOauthSetup(oauthResult);
        setCurrentStep('oauth_redirect');
        return;
      }
    }

    if (needsConfig && hasSchemaFields(configSchema)) {
      setCurrentStep('config');
    } else if (needsConfig && configSchema) {
      await client.setupSession.setConfig({
        sessionId: session.id,
        clientSecret,
        configInput: {}
      });
      setCurrentStep('completed');
    } else {
      setCurrentStep('completed');
    }
  });

  let configMutation = useMutation(async (data: Record<string, unknown>) => {
    await client.setupSession.setConfig({
      sessionId: session.id,
      clientSecret,
      configInput: data
    });
    setCurrentStep('completed');
  });

  let stepLabels = useMemo(() => {
    let labels: string[] = [];
    if (needsAuthConfig && hasSchemaFields(authConfigSchema)) labels.push('Authentication');
    if (needsConfig && hasSchemaFields(configSchema)) labels.push('Configuration');
    return labels;
  }, [needsAuthConfig, needsConfig, authConfigSchema, configSchema]);

  let currentStepIndex = useMemo(() => {
    let step = currentStep ?? determineStep();
    if (step === 'auth_config' || step === 'oauth_redirect') return 0;
    if (step === 'config') return stepLabels.length > 1 ? 1 : 0;
    return stepLabels.length;
  }, [currentStep, determineStep, stepLabels]);

  let renderContent = () => {
    let activeLoaders: Record<string, typeof authSchemaLoader> = {};
    if (needsAuthConfig) activeLoaders.authSchema = authSchemaLoader;
    if (needsConfig) activeLoaders.configSchema = configSchemaLoader;

    return renderWithLoader(activeLoaders, {
      spaceTop: 48,
      spaceBottom: 48,
      error: err => (
        <Flex direction="column" align="center" gap={16} style={{ padding: '24px 0' }}>
          <Error>{err.message || 'Failed to load configuration. Please try again.'}</Error>
          <Button onClick={() => window.location.reload()} variant="outline" size="2">
            Try Again
          </Button>
        </Flex>
      )
    })(() => {
      let step = currentStep ?? determineStep();

      if (step === 'auth_config' && authConfigSchema) {
        return (
          <AuthConfigStep
            schema={authConfigSchema}
            onSubmit={authConfigMutation.mutate}
            isSubmitting={authConfigMutation.isLoading}
          />
        );
      }

      if (step === 'oauth_redirect' && oauthSetup) {
        return <OAuthRedirectStep oauthSetup={oauthSetup} />;
      }

      if (step === 'config' && configSchema) {
        return (
          <ConfigStep
            schema={configSchema}
            onSubmit={configMutation.mutate}
            isSubmitting={configMutation.isLoading}
          />
        );
      }

      if (step === 'completed') {
        return <CompletedStep redirectUrl={session.redirectUrl} />;
      }

      return null;
    });
  };

  let isCompleted = (currentStep ?? determineStep()) === 'completed';

  if (session.uiMode === 'metorial_elements') {
    return (
      <MetorialElementsLayout
        brand={brand}
        providerName={session.authMethod.name}
        hideHeader={isCompleted}
      >
        {renderContent()}
      </MetorialElementsLayout>
    );
  }

  return (
    <DashboardEmbeddableLayout
      currentStep={currentStepIndex}
      totalSteps={stepLabels.length}
      stepLabels={stepLabels}
    >
      {renderContent()}
    </DashboardEmbeddableLayout>
  );
};
