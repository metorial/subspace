import type { Brand } from '@metorial-subspace/db';

export let brandPresenter = (brand: Brand) => ({
  object: 'brand',

  id: brand.id,
  name: brand.name,
  image: brand.image,

  createdAt: brand.createdAt
});
