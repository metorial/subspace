import { useForm } from '@metorial-io/data-hooks';
import styled from 'styled-components';
import { Button, Flex, theme } from '@metorial-io/ui';
import { FormFromSchema } from '../components/FormFromSchema';
import { schemaToYup, getDefaultValues } from '../../../lib/jsonSchema';
import type { JsonSchema } from '../../../lib/jsonSchema';

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

interface ConfigStepProps {
  schema: JsonSchema;
  onSubmit: (data: Record<string, unknown>) => Promise<unknown>;
  isSubmitting: boolean;
  isMetorialLayout?: boolean;
}

export let ConfigStep = ({
  schema,
  onSubmit,
  isSubmitting,
  isMetorialLayout = false
}: ConfigStepProps) => {
  let form = useForm({
    initialValues: getDefaultValues(schema),
    schema: () => schemaToYup(schema),
    schemaDependencies: [schema],
    onSubmit: async values => {
      await onSubmit(values);
    }
  });

  return (
    <Wrapper $isMetorialLayout={isMetorialLayout}>
      <ContentBlock $isMetorialLayout={isMetorialLayout}>
        <form onSubmit={form.handleSubmit}>
          <Flex direction="column" gap={20}>
            <FormFromSchema schema={schema} form={form} RenderError={form.RenderError} />

            <Button
              type="submit"
              color="black"
              size="3"
              fullWidth
              loading={isSubmitting}
              disabled={!form.isValid}
            >
              Continue
            </Button>
          </Flex>
        </form>

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
