import type { Brand } from '../../prisma/generated/client';

export let brandPresenter = (brand: Brand) => ({
  object: 'brand',

  id: brand.id,
  name: brand.name,
  image: brand.image,

  createdAt: brand.createdAt
});
