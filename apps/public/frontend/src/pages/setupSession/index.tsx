import React from 'react';
import { Flex, Spinner, Text, Title } from '@metorial-io/ui';
import { useSetupSession } from '../../state/setupSession';
import { SetupSessionFlow } from './SetupSessionFlow';
import { MetorialElementsLayout } from './layouts/MetorialElementsLayout';
import { SuccessIcon, WarningIcon, ErrorIcon } from './components/StatusIcons';

export let SetupSessionPage = () => {
  let setupSession = useSetupSession();

  if (setupSession.error) {
    return (
      <StatusPageView
        icon={<ErrorIcon />}
        title="Something went wrong"
        description={
          setupSession.error.message || 'An unexpected error occurred. Please try again.'
        }
      />
    );
  }

  if (!setupSession.data) {
    return <LoadingPage />;
  }

  let { session, brand } = setupSession.data;
  let clientSecret = new URLSearchParams(window.location.search).get('client_secret') || '';

  if (session.status === 'completed') {
    if (session.redirectUrl) {
      window.location.href = session.redirectUrl;
      return <LoadingPage />;
    }
    return (
      <StatusPageView
        icon={<SuccessIcon />}
        title="Setup Complete"
        description="This setup session has already been completed. You can close this window."
      />
    );
  }

  if (session.status === 'expired') {
    return (
      <StatusPageView
        icon={<WarningIcon />}
        title="Session Expired"
        description="This setup session has expired. Please request a new setup link."
      />
    );
  }

  if (session.status === 'failed') {
    return (
      <StatusPageView
        icon={<ErrorIcon />}
        title="Setup Failed"
        description="This setup session has failed. Please request a new setup link or contact support."
      />
    );
  }

  return <SetupSessionFlow session={session} brand={brand} clientSecret={clientSecret} />;
};

interface StatusPageViewProps {
  icon: React.ReactElement;
  title: string;
  description: string;
}

let StatusPageView = ({ icon, title, description }: StatusPageViewProps) => {
  return (
    <Flex
      align="center"
      justify="center"
      style={{
        minHeight: '100vh',
        padding: 24,
        background:
          'linear-gradient(135deg, #f5d0e0 0%, #ffecd2 25%, #fcfcfc 50%, #dfe9f3 75%, #e0f7fa 100%)'
      }}
    >
      <Flex
        direction="column"
        align="center"
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'white',
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden'
        }}
      >
        <Flex direction="column" align="center" style={{ padding: '48px 24px' }}>
          <div style={{ marginBottom: 24 }}>{icon}</div>
          <Title size="3" weight="bold" style={{ textAlign: 'center' }}>
            {title}
          </Title>
          <div style={{ height: 12 }} />
          <Text color="gray600" style={{ textAlign: 'center', lineHeight: 1.5 }}>
            {description}
          </Text>
        </Flex>

        <Flex
          align="center"
          justify="center"
          gap={6}
          style={{
            width: '100%',
            padding: '16px 24px',
            borderTop: '1px solid #f0f0f0',
            background: '#fafafa'
          }}
        >
          <Text color="gray600">Secured by</Text>
          <a
            href="https://metorial.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              color: '#1a1a1a',
              textDecoration: 'none',
              fontWeight: 500,
              fontSize: 13
            }}
          >
            <img
              src="https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg"
              alt="Metorial"
              style={{ width: 16, height: 16, borderRadius: 3 }}
            />
            Metorial
          </a>
        </Flex>
      </Flex>
    </Flex>
  );
};

let LoadingPage = () => {
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      gap={16}
      style={{
        minHeight: '100vh',
        background:
          'linear-gradient(135deg, #f5d0e0 0%, #ffecd2 25%, #fcfcfc 50%, #dfe9f3 75%, #e0f7fa 100%)'
      }}
    >
      <Spinner size={32} />
    </Flex>
  );
};
