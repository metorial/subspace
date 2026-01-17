import { ServiceError, badRequestError, goneError } from '@lowerdeck/error';

let actionNameMap = {
  update: 'updated',
  delete: 'deleted',
  archive: 'archived'
};

export let checkDeletedEdit = (
  d: {
    isEphemeral?: boolean;
    status?: 'deleted' | 'archived' | string;
  },
  action: 'update' | 'delete' | 'archive'
) => {
  if (d.isEphemeral || d.status == 'deleted' || d.status == 'archived') {
    throw new ServiceError(
      goneError({
        message: `Resource eannot be ${actionNameMap[action]}.`
      })
    );
  }
};

export let checkDeletedRelation = (
  d:
    | { id: string; isEphemeral?: boolean; status?: 'deleted' | 'archived' | string }
    | undefined
    | null,
  opts?: { allowEphemeral?: boolean }
) => {
  if (!d) return;

  if (
    d.status == 'deleted' ||
    d.status == 'archived' ||
    (d.isEphemeral && !opts?.allowEphemeral)
  ) {
    throw new ServiceError(
      badRequestError({
        message: `Cannot use resource as it has been deleted or archived.`,
        entityId: d.id,
        code: 'use_after_delete'
      })
    );
  }
};
