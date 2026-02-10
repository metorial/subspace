export default {
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations'
  },
  datasource: {
    url: process.env.DATABASE_URL
  }
};
