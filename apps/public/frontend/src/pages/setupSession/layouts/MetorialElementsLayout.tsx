import type { ReactNode } from 'react';
import { Flex, Text, Title } from '@metorial-io/ui';

let AnimatedDots = () => (
  <Flex align="center" gap={6} style={{ padding: '0 4px' }}>
    {[0, 1, 2].map(i => (
      <div
        key={i}
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#ccc',
          animation: 'pulse 1.4s ease-in-out infinite',
          animationDelay: `${i * 0.2}s`
        }}
      />
    ))}
    <style>{`
      @keyframes pulse {
        0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
        40% { opacity: 1; transform: scale(1); }
      }
    `}</style>
  </Flex>
);

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
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'white',
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden'
        }}
      >
        {!hideHeader && (
          <Flex
            direction="column"
            align="center"
            gap={16}
            style={{
              padding: '32px 24px 24px',
              background: 'linear-gradient(180deg, #fff9f9 0%, #ffffff 100%)'
            }}
          >
            <Flex align="center" gap={12}>
              {brand.image && (
                <img
                  src={brand.image}
                  alt={brand.name}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    objectFit: 'contain',
                    background: 'white'
                  }}
                />
              )}
              <AnimatedDots />
              <Flex
                align="center"
                justify="center"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  fontSize: 20,
                  fontWeight: 600
                }}
              >
                {providerName.charAt(0).toUpperCase()}
              </Flex>
            </Flex>

            <Title size="6" weight="bold" style={{ textAlign: 'center', lineHeight: 1.4 }}>
              Connect {brand.name}
              <br />
              to {providerName}
            </Title>
          </Flex>
        )}

        <div style={{ padding: hideHeader ? '32px 24px' : 24 }}>{children}</div>

        <Flex
          align="center"
          justify="center"
          gap={6}
          style={{
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
