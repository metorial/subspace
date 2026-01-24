import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { renderWithLoader, useMutation } from '@metorial-io/data-hooks';
import { Button, Flex, Error, Spinner, Text } from '@metorial-io/ui';
import { client } from '../../state/client';
import { authConfigSchemaState, configSchemaState } from '../../state/setupSession';
import { MetorialElementsLayout } from './layouts/MetorialElementsLayout';
import { DashboardEmbeddableLayout } from './layouts/DashboardEmbeddableLayout';
import { AuthConfigStep } from './steps/AuthConfigStep';
import { ConfigStep } from './steps/ConfigStep';
import { OAuthRedirectStep } from './steps/OAuthRedirectStep';
import { CompletedStep } from './steps/CompletedStep';
import type { JsonSchema } from '../../lib/jsonSchema';
import type { Session, Brand, OAuthSetup, Step } from './types';

interface SetupSessionFlowProps {
  session: Session;
  brand: Brand;
  clientSecret: string;
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
    if (needsConfig && hasSchemaFields(configSchema)) return 'config';

    if (needsAuthConfig && hasSchemaFields(authConfigSchema)) return 'auth_config';

    if (needsAuthConfig && isOAuth && !hasSchemaFields(authConfigSchema))
      return 'oauth_loading';

    return 'completed';
  }, [needsAuthConfig, needsConfig, isOAuth, authConfigSchema, configSchema]);

  let configMutation = useMutation(async (data: Record<string, unknown>) => {
    await client.setupSession.setConfig({
      sessionId: session.id,
      clientSecret,
      configInput: data
    });

    if (needsAuthConfig && hasSchemaFields(authConfigSchema)) {
      setCurrentStep('auth_config');
    } else if (needsAuthConfig && isOAuth) {
      setCurrentStep('oauth_loading');
    } else {
      setCurrentStep('completed');
    }
  });

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

    setCurrentStep('completed');
  });

  let [oauthError, setOauthError] = useState<string | null>(null);
  let oauthInitiated = useRef(false);
  useEffect(() => {
    let shouldAutoInitiateOAuth =
      needsAuthConfig &&
      isOAuth &&
      authSchemaLoader.data &&
      !hasSchemaFields(authConfigSchema) &&
      !oauthInitiated.current;

    if (shouldAutoInitiateOAuth) {
      oauthInitiated.current = true;
      (async () => {
        try {
          await client.setupSession.setAuthConfig({
            sessionId: session.id,
            clientSecret,
            authConfigInput: {}
          });

          let oauthResult = await client.setupSession.getOauthSetup({
            sessionId: session.id,
            clientSecret
          });
          if (oauthResult) {
            setOauthSetup(oauthResult);
            setCurrentStep('oauth_redirect');
          } else {
            setOauthError('Failed to get OAuth URL. Please try again with a new session.');
          }
        } catch (err: unknown) {
          let message = (err as { message?: string })?.message ?? 'Failed to initiate OAuth';
          setOauthError(message);
        }
      })();
    }
  }, [
    needsAuthConfig,
    isOAuth,
    authSchemaLoader.data,
    authConfigSchema,
    session.id,
    clientSecret
  ]);

  let stepLabels = useMemo(() => {
    let labels: string[] = [];
    if (needsConfig && hasSchemaFields(configSchema)) labels.push('Configuration');
    if (needsAuthConfig && hasSchemaFields(authConfigSchema)) labels.push('Authentication');
    return labels;
  }, [needsAuthConfig, needsConfig, authConfigSchema, configSchema]);

  let currentStepIndex = useMemo(() => {
    let step = currentStep ?? determineStep();
    if (step === 'config') return 0;
    if (step === 'auth_config' || step === 'oauth_redirect' || step === 'oauth_loading')
      return stepLabels.length > 1 ? 1 : 0;
    return stepLabels.length;
  }, [currentStep, determineStep, stepLabels]);

  let renderContent = () => {
    let activeLoaders: Record<string, typeof authSchemaLoader> = {};
    if (needsAuthConfig) activeLoaders.authSchema = authSchemaLoader;
    if (needsConfig) activeLoaders.configSchema = configSchemaLoader;

    return renderWithLoader(activeLoaders, {
      spaceTop: 48,
      spaceBottom: 48,
      error: (err: Error) => (
        <Flex direction="column" align="center" gap={16} style={{ padding: '24px 0' }}>
          <Error>{err.message}</Error>
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
            isMetorialElement={session.uiMode === 'metorial_elements'}
          />
        );
      }

      if (step === 'oauth_loading') {
        if (oauthError) {
          return (
            <Flex direction="column" align="center" gap={16} style={{ padding: '24px 0' }}>
              <Error>{oauthError}</Error>
              <Button onClick={() => window.location.reload()} variant="outline" size="2">
                Try Again
              </Button>
            </Flex>
          );
        }
        return (
          <Flex direction="column" align="center" gap={16} style={{ padding: '48px 0' }}>
            <Spinner size="3" />
            <Text>Preparing authentication...</Text>
          </Flex>
        );
      }

      if (step === 'oauth_redirect' && oauthSetup) {
        return (
          <OAuthRedirectStep
            oauthSetup={oauthSetup}
            isMetorialElement={session.uiMode === 'metorial_elements'}
          />
        );
      }

      if (step === 'config' && configSchema) {
        return (
          <ConfigStep
            schema={configSchema}
            onSubmit={configMutation.mutate}
            isSubmitting={configMutation.isLoading}
            isMetorialElement={session.uiMode === 'metorial_elements'}
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
        currentStep={currentStepIndex}
        stepLabels={stepLabels}
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
