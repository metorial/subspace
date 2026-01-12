import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { slugify } from '@lowerdeck/slugify';
import { db, getId, Solution, Tenant } from '@metorial-subspace/db';

class providerListingCategoryServiceImpl {
  async getProviderListingCategoryById(d: {
    tenant: Tenant;
    solution: Solution;
    providerListingCategoryId: string;
  }) {
    let providerListingCategory = await db.providerListingCategory.findFirst({
      where: {
        OR: [{ id: d.providerListingCategoryId }, { slug: d.providerListingCategoryId }]
      }
    });
    if (!providerListingCategory) {
      throw new ServiceError(notFoundError('provider_category', d.providerListingCategoryId));
    }

    return providerListingCategory;
  }

  async listProviderListingCategories(d: { tenant: Tenant; solution: Solution }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.providerListingCategory.findMany({
            ...opts
          })
      )
    );
  }

  async upsertProviderListingCategory(d: {
    input: { name: string; slug: string; description: string };
  }) {
    let inner = {
      name: d.input.name,
      slug: slugify(d.input.slug),
      description: d.input.description
    };

    return await db.providerListingCategory.upsert({
      where: { slug: inner.slug },
      create: {
        ...getId('providerCategory'),
        ...inner
      },
      update: inner
    });
  }
}

export let providerListingCategoryService = Service.create(
  'providerListingCategoryService',
  () => new providerListingCategoryServiceImpl()
).build();
