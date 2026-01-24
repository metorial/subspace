import type { ReactNode } from 'react';
import styled, { keyframes } from 'styled-components';
import { Spacer, Text, Title, theme } from '@metorial-io/ui';

let Wrapper = styled.div`
  min-height: 100dvh;
  padding: 60px 20px;
  background: ${theme.colors.gray100};
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-width: 640px) {
    padding: 0;
    background: white;
    align-items: flex-start;
  }
`;

let Inner = styled.div`
  width: 400px;
  max-width: 100%;
  margin: 0 auto;
`;

let Card = styled.div`
  background: white;
  box-shadow: ${theme.shadows.medium};
  border-radius: 12px;
  border: 1px solid ${theme.colors.gray300};
  overflow: hidden;

  @media (max-width: 640px) {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    box-shadow: none;
    border-radius: 0;
    border: none;
  }
`;

let Header = styled.div`
  padding: 32px 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  background: linear-gradient(180deg, #fff9f9 0%, #ffffff 100%);
  border-bottom: 1px solid ${theme.colors.gray200};

  @media (max-width: 640px) {
    padding-top: 48px;
  }
`;

let IconsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

let BrandIcon = styled.img`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  object-fit: contain;
  background: white;
`;

let chevronPulse = keyframes`
  0%, 100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
`;

let Chevrons = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  color: ${theme.colors.gray600};
`;

let ChevronSvg = styled.svg<{ $delay: number }>`
  animation: ${chevronPulse} 1.5s ease-in-out infinite;
  animation-delay: ${p => p.$delay}s;
`;

let ChevronIcon = ({ delay = 0 }: { delay?: number }) => (
  <ChevronSvg $delay={delay} width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path
      d="M6 4L10 8L6 12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </ChevronSvg>
);

let ProviderIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 20px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
`;

let HeaderText = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`;

let Content = styled.div<{ $hideHeader: boolean }>`
  padding: ${p => (p.$hideHeader ? '32px 32px 0' : '20px 32px 0')};

  @media (max-width: 640px) {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
`;

let Footer = styled.div`
  padding: 16px 24px 24px;

  @media (max-width: 640px) {
    display: none;
  }
`;

let SecuredBy = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  color: ${theme.colors.gray600};
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

interface MetorialElementsLayoutProps {
  brand: { name: string; image: string | null };
  providerName: string;
  children: ReactNode;
  hideHeader?: boolean;
}

export let MetorialElementsLayout = ({
  brand,
  providerName,
  children,
  hideHeader = false
}: MetorialElementsLayoutProps) => {
  let brandName = typeof brand.name === 'string' ? brand.name : 'App';
  let brandImage = typeof brand.image === 'string' ? brand.image : null;
  let displayProviderName = typeof providerName === 'string' ? providerName : 'Provider';

  return (
    <Wrapper data-layout="metorial-elements">
      <Inner>
        <Card>
          {!hideHeader && (
            <Header>
              <IconsRow>
                {brandImage && <BrandIcon src={brandImage} alt={brandName} />}
                <Chevrons>
                  <ChevronIcon delay={0} />
                  <ChevronIcon delay={0.3} />
                  <ChevronIcon delay={0.6} />
                </Chevrons>
                <ProviderIcon>{displayProviderName.charAt(0).toUpperCase()}</ProviderIcon>
              </IconsRow>

              <HeaderText>
                <Title size="5" weight="strong" style={{ textAlign: 'center' }}>
                  Connect to {displayProviderName}
                </Title>
              </HeaderText>
            </Header>
          )}

          <Content $hideHeader={hideHeader}>{children}</Content>

          <Footer>
            <SecuredBy>
              <span>Secured by</span>
              <SecuredByLink
                href="https://metorial.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <SecuredByLogo
                  src="https://cdn.metorial.com/2025-06-13--14-59-55/logos/metorial/primary_logo/raw.svg"
                  alt="Metorial"
                />
                Metorial
              </SecuredByLink>
            </SecuredBy>
          </Footer>
        </Card>
      </Inner>
    </Wrapper>
  );
};
