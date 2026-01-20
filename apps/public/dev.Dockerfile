FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Copy package.json files preserving directory structure
COPY apps/controller/package.json ./apps/controller/package.json
COPY apps/public/package.json ./apps/public/package.json

COPY db/package.json ./db/package.json
COPY packages/tsconfig/package.json ./packages/tsconfig/package.json
COPY packages/wire/package.json ./packages/wire/package.json

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

# Build frontend
RUN cd apps/public && bun run build

# Run in dev mode with hot reloading
CMD ["sh", "-c", "cd db && bun prisma db push --accept-data-loss && bun prisma generate && cd ../apps/public && bun run start:dev"]
