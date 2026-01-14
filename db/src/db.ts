import {
  type Specification,
  type SpecificationAuthMethod,
  type SpecificationFeatures,
  type SpecificationTool
} from '@metorial-subspace/provider-utils';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../prisma/generated/client';
import { env } from './env';

let adapter = new PrismaPg({ connectionString: env.service.DATABASE_URL });

export let db = new PrismaClient({ adapter });

declare global {
  namespace PrismaJson {
    type EntityImage =
      | { type: 'file'; fileId: string; fileLinkId: string; url: string }
      | { type: 'enterprise_file'; fileId: string }
      | { type: 'url'; url: string }
      | { type: 'default' };

    type PublisherSource = { type: 'github'; url: string; owner: string; repo?: string };

    type ProviderSpecificationValue = {
      specification: Specification;
      authMethods: SpecificationAuthMethod[];
      features: SpecificationFeatures;
      tools: SpecificationTool[];
    };

    type ProviderAuthMethodValue = SpecificationAuthMethod;

    type ProviderToolValue = SpecificationTool;
  }
}
