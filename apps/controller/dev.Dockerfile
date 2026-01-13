FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Copy package.json files preserving directory structure
COPY apps/controller/package.json ./apps/controller/package.json
COPY apps/public/package.json ./apps/public/package.json

COPY packages/db/package.json ./packages/db/package.json
COPY packages/provider-slates/package.json ./packages/provider-slates/package.json
COPY packages/provider-utils/package.json ./packages/provider-utils/package.json
COPY packages/provider/package.json ./packages/provider/package.json
COPY packages/tsconfig/package.json ./packages/tsconfig/package.json

COPY modules/auth/package.json ./modules/auth/package.json
COPY modules/catalog/package.json ./modules/catalog/package.json
COPY modules/deployment/package.json ./modules/deployment/package.json
COPY modules/provider-internal/package.json ./modules/provider-internal/package.json
COPY modules/search/package.json ./modules/search/package.json
COPY modules/tenant/package.json ./modules/tenant/package.json

RUN bun install

COPY . .

# In case we forgot to copy some package.json files
RUN bun install 

# Run in dev mode with hot reloading
CMD ["sh", "-c", "cd packages/db && bun prisma db push --accept-data-loss && cd ../../apps/controller && bun start:dev"]
