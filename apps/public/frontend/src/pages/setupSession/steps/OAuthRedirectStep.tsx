import styled from 'styled-components';
import { Button, Flex, Spacer, Text, Title, theme } from '@metorial-io/ui';

let Wrapper = styled.div<{ $isMetorialLayout: boolean }>`
  display: flex;
  flex-direction: column;

  @media (max-width: 640px) {
    ${p =>
      p.$isMetorialLayout &&
      `
      flex: 1;
      justify-content: flex-end;
    `}
  }
`;

let ContentBlock = styled.div<{ $isMetorialLayout: boolean }>`
  @media (max-width: 640px) {
    ${p =>
      p.$isMetorialLayout &&
      `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: white;
      border-radius: 24px 24px 0 0;
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
      padding: 32px 24px 32px;
    `}
  }
`;

let SecuredBy = styled.div<{ $isMetorialLayout: boolean }>`
  display: none;

  @media (max-width: 640px) {
    ${p =>
      p.$isMetorialLayout &&
      `
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      font-size: 12px;
      color: #666;
      margin-top: 16px;
    `}
  }
`;

let SecuredByLink = styled.a`
  display: flex;
  align-items: center;
  gap: 3px;
  color: ${theme.colors.gray900};
  text-decoration: none;
  font-weight: 500;
`;

let SecuredByLogo = styled.img`
  width: 14px;
  height: 14px;
  border-radius: 3px;
`;

interface OAuthRedirectStepProps {
  oauthSetup: {
    url: string | null;
    authMethod: {
      name: string;
    };
  };
  isMetorialLayout?: boolean;
}

export let OAuthRedirectStep = ({
  oauthSetup,
  isMetorialLayout = false
}: OAuthRedirectStepProps) => {
  let safeUrl = typeof oauthSetup.url === 'string' ? oauthSetup.url : null;

  let handleRedirect = () => {
    if (safeUrl) {
      window.location.href = safeUrl;
    }
  };

  if (!safeUrl) {
    return (
      <Flex
        direction="column"
        align="center"
        style={{ padding: '16px 0', textAlign: 'center' }}
      >
        <Title size="3" weight="bold">
          OAuth Setup Error
        </Title>
        <Spacer size={8} />
        <Text style={{ textAlign: 'center' }}>
          Unable to initiate OAuth flow. The setup URL is not available.
        </Text>
      </Flex>
    );
  }

  return (
    <Wrapper $isMetorialLayout={isMetorialLayout}>
      <ContentBlock $isMetorialLayout={isMetorialLayout}>
        <div>
          <Text size="2" weight="medium">
            Sign in required
          </Text>
          <Spacer size={4} />
          <Text size="2" color="gray600">
            You'll be redirected to connect your account.
          </Text>
        </div>

        <Spacer size={50} />

        <Button onClick={handleRedirect} color="black" size="4" fullWidth>
          Connect Account
        </Button>

        <SecuredBy $isMetorialLayout={isMetorialLayout}>
          <span>Secured by</span>
          <SecuredByLink href="https://metorial.com" target="_blank" rel="noopener noreferrer">
            <SecuredByLogo
              src="https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg"
              alt="Metorial"
            />
            Metorial
          </SecuredByLink>
        </SecuredBy>
      </ContentBlock>
    </Wrapper>
  );
};
