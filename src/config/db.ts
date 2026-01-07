import { PrismaClient } from 'prisma/generated/prisma/client';
import { patchCloudFrontURLs } from '@/utils/mediaPatch';

const base = new PrismaClient();

const prisma = base.$extends({
  query: {
    tour: {
      async findMany({ args, query }) {
        const result = await query(args);
        if (Array.isArray(result)) result.forEach(patchCloudFrontURLs);
        return result;
      },
      async findFirst({ args, query }) {
        const result = await query(args);
        if (result) patchCloudFrontURLs(result);
        return result;
      },
      async findUnique({ args, query }) {
        const result = await query(args);
        if (result) patchCloudFrontURLs(result);
        return result;
      },
    },
    heroSlide: {
      async findMany({ args, query }) {
        const result = await query(args);
        if (Array.isArray(result)) result.forEach(patchCloudFrontURLs);
        return result;
      },
      async findFirst({ args, query }) {
        const result = await query(args);
        if (result) patchCloudFrontURLs(result);
        return result;
      },
      async findUnique({ args, query }) {
        const result = await query(args);
        if (result) patchCloudFrontURLs(result);
        return result;
      },
    },
  },
});

export default prisma;
