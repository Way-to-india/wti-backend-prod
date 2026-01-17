const MEDIA_FIELDS = [
  'image',
  'qrImage',
  'profilePic',
  'profileImage',
  'profileCoverImage',
  'picture',
  'file',
  'thumbFile',
  'selfie',
  'icon',
  'masterPlan',
  'brochures',
  'images',
  'videos',
  'imageUrl',
  'thumbnail',
  'cityImage',
];

export const prependCloudFrontURL = (destination: string): string => {
  if (!destination || typeof destination !== 'string') return destination;

  // If it's already a full URL (starts with http or https), don't prepend
  if (destination.startsWith('http://') || destination.startsWith('https://')) {
    return destination;
  }

  const cleanDestination = destination.startsWith('/') ? destination.substring(1) : destination;

  // Use the environment variable, ensuring no double slashes
  const baseUrl = process.env.AWS_CLOUDFRONT_ENDPOINT || '';
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  if (!cleanBaseUrl) return destination;

  return `${cleanBaseUrl}/${cleanDestination}`;
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

      // Handle array of strings field (e.g., Tour.images)
      if (Array.isArray(value) && MEDIA_FIELDS.includes(key)) {
        (current as any)[key] = value.map((item) => {
          if (typeof item === 'string') {
            return prependCloudFrontURL(item);
          }
          return item;
        });
        continue;
      }

      // Handle single string field
      if (typeof value === 'string' && MEDIA_FIELDS.includes(key)) {
        (current as any)[key] = prependCloudFrontURL(value);
        continue;
      }

      // Recurse into objects and arrays
      if (typeof value === 'object' && value !== null) {
        queue.push(value);
      }
    }
  }
};
