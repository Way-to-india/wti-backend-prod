const MEDIA_FIELDS = [
  'image',
  'qrImage',
  'profilePic',
  'picture',
  'file',
  'thumbFile',
  'selfie',
  'icon',
  'masterPlan',
  'brochures',
  'images',
  'videos',
];

export const prependCloudFrontURL = (destination: string): string => {
  if (!destination || typeof destination !== 'string') return destination;

  const cleanDestination = destination.startsWith('/') ? destination.substring(1) : destination;

  return `${process.env.AWS_CLOUDFRONT_ENDPOINT}/${cleanDestination}`;
};

export const patchCloudFrontURLs = (doc: any): void => {
  if (!doc || typeof doc !== 'object') return;

  const queue = [doc];
  const seen = new WeakSet();

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);

    for (const key of Object.keys(current)) {
      const value = (current as any)[key];

      // single string field
      if (
        typeof value === 'string' &&
        MEDIA_FIELDS.includes(key) &&
        !value.startsWith(process.env.AWS_CLOUDFRONT_ENDPOINT as string)
      ) {
        (current as any)[key] = prependCloudFrontURL(value);
      }

      // array of strings field
      if (Array.isArray(value) && MEDIA_FIELDS.includes(key)) {
        (current as any)[key] = value.map((item) => {
          if (
            typeof item === 'string' &&
            !item.startsWith(process.env.AWS_CLOUDFRONT_ENDPOINT as string)
          ) {
            return prependCloudFrontURL(item);
          }
          return item;
        });
      }

      if (typeof value === 'object' && value !== null) {
        queue.push(value);
      }
    }
  }
};
