import { defineConfig } from 'prisma/config'

export default defineConfig({
  ...(process.env.DATABASE_URL && {
    datasource: {
      url: process.env.DATABASE_URL,
    },
  }),
  migrations: {
    seed: 'npx tsx prisma/seed.ts',
  },
})
