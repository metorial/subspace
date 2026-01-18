import { RiTimeLine, RiLockLine } from '@remixicon/react';
import { Button, Flex, Spacer, Text, Title } from '@metorial-io/ui';

interface OAuthRedirectStepProps {
  oauthSetup: {
    url: string | null;
    authMethod: {
      name: string;
    };
  };
}

export let OAuthRedirectStep = ({ oauthSetup }: OAuthRedirectStepProps) => {
  let handleRedirect = () => {
    if (oauthSetup.url) {
      window.location.href = oauthSetup.url;
    }
  };

  if (!oauthSetup.url) {
    return (
      <Flex direction="column" align="center" style={{ padding: '16px 0' }}>
        <Title size="3" weight="bold">
          OAuth Setup Error
        </Title>
        <Spacer size={8} />
        <Text size="5">Unable to initiate OAuth flow. The setup URL is not available.</Text>
      </Flex>
    );
  }

  return (
    <Flex direction="column" align="center" style={{ padding: '16px 0', textAlign: 'center' }}>
      <RiTimeLine size={48} style={{ color: '#e5e5e5', marginBottom: 20 }} />

      <Title size="5">Connect with {oauthSetup.authMethod.name}</Title>

      <Spacer size={12} />

      <Text style={{ maxWidth: 320, lineHeight: 1.5 }}>
        Click the button below to authenticate with your {oauthSetup.authMethod.name} account.
        You will be redirected to complete the authentication.
      </Text>

      <Spacer size={24} />

      <Button onClick={handleRedirect} color="black" size="3">
        Continue to {oauthSetup.authMethod.name}
      </Button>
    </Flex>
  );
};
