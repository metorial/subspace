import { useForm } from '@metorial-io/data-hooks';
import { Button, Flex } from '@metorial-io/ui';
import { FormFromSchema } from '../components/FormFromSchema';
import { schemaToYup, getDefaultValues } from '../../../lib/jsonSchema';
import type { JsonSchema } from '../../../lib/jsonSchema';

interface AuthConfigStepProps {
  schema: JsonSchema;
  onSubmit: (data: Record<string, unknown>) => Promise<unknown>;
  isSubmitting: boolean;
}

export let AuthConfigStep = ({ schema, onSubmit, isSubmitting }: AuthConfigStepProps) => {
  let form = useForm({
    initialValues: getDefaultValues(schema),
    schema: () => schemaToYup(schema),
    schemaDependencies: [schema],
    onSubmit: async values => {
      await onSubmit(values);
    }
  });

  return (
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
          Connect
        </Button>
      </Flex>
    </form>
  );
};
