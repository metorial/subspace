import type { Actor } from '@metorial-subspace/db';

export let actorPresenter = (actor: Actor) => ({
  object: 'actor',

  id: actor.id,
  type: actor.type,
  identifier: actor.identifier,
  name: actor.name,
  organizationActorId: actor.organizationActorId,

  createdAt: actor.createdAt
});
