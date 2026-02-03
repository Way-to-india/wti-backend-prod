import prisma from '@/config/db';

export class BlogService {

  static async getAllBlogs(
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'publishedAt',
    sortOrder: string = 'desc'
  ) {
    const skip = (page - 1) * limit;
    const orderBy = { [sortBy]: sortOrder };

    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({
        skip,
        take: limit,
        orderBy,
      }),
      prisma.blog.count(),
    ]);

    return {
      blogs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get blog by ID
   */
  static async getBlogById(id: string) {
    const blog = await prisma.blog.findUnique({
      where: { id },
    });

    if (!blog) {
      throw new Error('Blog not found');
    }

    return blog;
  }

  static async getBlogBySlug(slug: string) {
    const blog = await prisma.blog.findUnique({
      where: { slug },
    });

    if (!blog) {
      throw new Error('Blog not found');
    }

    await prisma.blog.update({
      where: { id: blog.id },
      data: { viewCount: { increment: 1 } },
    });

    return blog;
  }

  static async createBlog(data: {
    title: string;
    slug: string;
    excerpt?: string;
    content?: string;
    author?: string;
    imageKey: string;
    imageUrl: string;
    ctaText?: string;
    ctaLink?: string;
    isActive?: boolean;
    isFeatured?: boolean;
    order?: number;
    publishedAt?: Date;
  }) {
    return await prisma.blog.create({
      data,
    });
  }

  static async updateBlog(id: string, data: any) {
    return await prisma.blog.update({
      where: { id },
      data,
    });
  }

  static async deleteBlog(id: string) {
    const blog = await prisma.blog.findUnique({
      where: { id },
      select: { imageKey: true },
    });

    if (!blog) {
      throw new Error('Blog not found');
    }

    await prisma.blog.delete({
      where: { id },
    });

    return blog.imageKey;
  }

  static async getActiveBlogs(limit: number = 6) {
    return await prisma.blog.findMany({
      where: { isActive: true },
      orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        author: true,
        imageUrl: true,
        ctaText: true,
        ctaLink: true,
        publishedAt: true,
        viewCount: true,
      },
    });
  }

  static async getFeaturedBlogs(limit: number = 3) {
    return await prisma.blog.findMany({
      where: { isActive: true, isFeatured: true },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });
  }

  static async updateBlogOrders(blogs: Array<{ id: string; order: number }>) {
    const updatePromises = blogs.map((blog) =>
      prisma.blog.update({
        where: { id: blog.id },
        data: { order: blog.order },
      })
    );

    return await Promise.all(updatePromises);
  }
}
