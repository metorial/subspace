/**
 * ## Deletion behavior:
 *
 * # Lists:
 * By default we exclude deleted and inactive items from lists.
 * If allowDeleted is true, we include deleted items as well.
 * If allowDeleted is false, inactive is allowed, but deleted is excluded.
 *
 * # Gets:
 * If allowDeleted is true, we include deleted items as well.
 * If allowDeleted is false, deleted items are excluded.
 * Inactive items are always allowed in gets.
 */

export let normalizeStatusForList = <T extends 'inactive' | 'deleted' | string>(d: {
  allowDeleted?: boolean;
  status?: T[];
}) => {
  if (d.status?.length) {
    if (d.allowDeleted) {
      return {
        hasParent: {
          status: { in: d.status },
          isParentDeleted: undefined
        },
        noParent: {
          status: { in: d.status }
        },
        onlyParent: {
          isParentDeleted: undefined
        }
      };
    }

    let normalized = d.status.filter(s => s != 'deleted');

    return {
      hasParent: {
        status: normalized.length ? { in: normalized } : undefined,
        isParentDeleted: false
      },
      noParent: {
        status: normalized.length ? { in: normalized } : undefined
      },
      onlyParent: {
        isParentDeleted: false
      }
    };
  }

  return {
    hasParent: {
      status: { notIn: ['inactive' as const, 'deleted' as const] },
      isParentDeleted: false
    },
    noParent: {
      status: { notIn: ['inactive' as const, 'deleted' as const] }
    },
    onlyParent: {
      isParentDeleted: false
    }
  };
};

export let normalizeStatusForGet = (d: { allowDeleted?: boolean }) => {
  if (d.allowDeleted) {
    return {
      hasParent: {
        status: undefined,
        isParentDeleted: undefined
      },
      noParent: {
        status: undefined
      },
      onlyParent: {
        isParentDeleted: undefined
      }
    };
  }

  return {
    hasParent: {
      status: { not: 'deleted' as const },
      isParentDeleted: false
    },
    noParent: {
      status: { not: 'deleted' as const }
    },
    onlyParent: {
      isParentDeleted: false
    }
  };
};
