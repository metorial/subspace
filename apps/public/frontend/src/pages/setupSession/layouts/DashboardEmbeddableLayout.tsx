import type { ReactNode } from 'react';
import { RiCheckLine } from '@remixicon/react';
import { Flex, Text } from '@metorial-io/ui';

interface DashboardEmbeddableLayoutProps {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
  children: ReactNode;
}

export let DashboardEmbeddableLayout = ({
  currentStep,
  totalSteps,
  stepLabels,
  children
}: DashboardEmbeddableLayoutProps) => {
  return (
    <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
      {totalSteps > 1 && (
        <Flex align="center" style={{ marginBottom: 32 }}>
          {stepLabels.map((label, index) => {
            let isActive = index === currentStep;
            let isCompleted = index < currentStep;
            let isLast = index === stepLabels.length - 1;

            return (
              <Flex key={label} align="center" style={{ flex: isLast ? 0 : 1 }}>
                <Flex align="center" gap={8}>
                  <Flex
                    align="center"
                    justify="center"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      fontSize: 13,
                      fontWeight: 600,
                      transition: 'all 0.2s',
                      background: isCompleted ? '#10b981' : isActive ? '#1a1a1a' : '#e5e5e5',
                      color: isCompleted || isActive ? 'white' : '#999'
                    }}
                  >
                    {isCompleted ? <RiCheckLine size={14} /> : index + 1}
                  </Flex>
                  <Text
                    weight="medium"
                    style={{
                      whiteSpace: 'nowrap',
                      color: isCompleted ? '#10b981' : isActive ? '#1a1a1a' : '#999'
                    }}
                  >
                    {label}
                  </Text>
                </Flex>
                {!isLast && (
                  <div
                    style={{
                      flex: 1,
                      height: 2,
                      margin: '0 12px',
                      background: isCompleted ? '#10b981' : '#e5e5e5',
                      transition: 'background 0.2s'
                    }}
                  />
                )}
              </Flex>
            );
          })}
        </Flex>
      )}

      <div>{children}</div>
    </div>
  );
};
