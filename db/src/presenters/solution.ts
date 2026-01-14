import type { Solution } from '../../prisma/generated/client';

export let solutionPresenter = (solution: Solution) => ({
  object: 'solution',

  id: solution.id,
  identifier: solution.identifier,
  name: solution.name,

  createdAt: solution.createdAt
});
