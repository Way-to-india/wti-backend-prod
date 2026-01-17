import { patchCloudFrontURLs } from '@/utils/mediaPatch';
import { PrismaClient } from 'prisma/generated/prisma/client';

const base = new PrismaClient();

const prisma = base.$extends({
  query: {
    $allModels: {
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
      async findFirstOrThrow({ args, query }) {
        const result = await query(args);
        if (result) patchCloudFrontURLs(result);
        return result;
      },
      async findUnique({ args, query }) {
        const result = await query(args);
        if (result) patchCloudFrontURLs(result);
        return result;
      },
      async findUniqueOrThrow({ args, query }) {
        const result = await query(args);
        if (result) patchCloudFrontURLs(result);
        return result;
      },
      async create({ args, query }) {
        const result = await query(args);
        if (result) patchCloudFrontURLs(result);
        return result;
      },
      async update({ args, query }) {
        const result = await query(args);
        if (result) patchCloudFrontURLs(result);
        return result;
      },
      async upsert({ args, query }) {
        const result = await query(args);
        if (result) patchCloudFrontURLs(result);
        return result;
      },
    },
  },
});

export default prisma;
