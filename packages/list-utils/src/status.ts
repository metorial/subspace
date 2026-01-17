export let normalizeStatusForList = <T extends 'inactive' | string>(d: {
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

    let normalized = d.status.filter(s => s !== 'inactive');

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

  if (d.allowDeleted) {
    return {
      hasParent: {
        status: { not: 'inactive' as const },
        isParentDeleted: undefined
      },
      noParent: {
        status: { not: 'inactive' as const }
      },
      onlyParent: {
        isParentDeleted: undefined
      }
    };
  }

  return {
    hasParent: {
      status: { not: 'inactive' as const },
      isParentDeleted: false
    },
    noParent: {
      status: { not: 'inactive' as const }
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
      status: { not: 'inactive' as const },
      isParentDeleted: false
    },
    noParent: {
      status: { not: 'inactive' as const }
    },
    onlyParent: {
      isParentDeleted: false
    }
  };
};
