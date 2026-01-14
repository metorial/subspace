import type { Publisher } from '../../prisma/generated/client';

export let publisherPresenter = (publisher: Publisher) => ({
  object: 'publisher',

  id: publisher.id,

  type: publisher.type,
  identifier: publisher.identifier,

  name: publisher.name,
  description: publisher.description,

  source: publisher.source,

  createdAt: publisher.createdAt,
  updatedAt: publisher.updatedAt
});
