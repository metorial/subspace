import type { Publisher } from '@metorial-subspace/db';

export let publisherPresenter = (publisher: Publisher) => ({
  object: 'publisher',

  id: publisher.id,

  type: publisher.type,
  identifier: publisher.identifier,

  name: publisher.name,
  description: publisher.description,

  createdAt: publisher.createdAt,
  updatedAt: publisher.updatedAt
});
