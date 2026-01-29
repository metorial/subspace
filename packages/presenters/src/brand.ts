import type { Brand } from '@metorial-subspace/db';

let getImageUrl = (image: Brand['image']): string | null => {
  if (!image || typeof image !== 'object') return null;
  if ('url' in image) return image.url;
  return null;
};

export let brandPresenter = (brand: Brand) => ({
  object: 'brand',

  id: brand.id,
  name: brand.name,
  image: getImageUrl(brand.image),

  createdAt: brand.createdAt
});
