# How to Use the Image Conversion Script

## For Testing on a Single Tour

To test the conversion on just one tour, use the `--tour-slug` argument:

```bash
# Dry run (preview only, no changes)
bun run scripts/convert-tour-images-to-webp.ts --dry-run --tour-slug=12-jyotirlinga-tour-package

# Live run (will make actual changes)
bun run scripts/convert-tour-images-to-webp.ts --tour-slug=12-jyotirlinga-tour-package
```

## For Converting All Tours

To convert all tour images at once:

```bash
# Dry run first to see what will happen
bun run scripts/convert-tour-images-to-webp.ts --dry-run

# Live run to convert everything
bun run scripts/convert-tour-images-to-webp.ts
```

## What the Script Does

1. **Finds images** in the tour's S3 folder (e.g., `tours/12-jyotirlinga-tour-package/`)
2. **Downloads** each JPG/PNG image
3. **Converts** to WebP format (85% quality)
4. **Uploads** the WebP version to the same folder
5. **Deletes** the old JPG/PNG image
6. **Updates** the database to reference the new `.webp` files

## Example Output

```
🚀 Starting tour image conversion to WebP format

   🎯 Processing single tour: 12-jyotirlinga-tour-package
   Mode: LIVE (will make changes)
   WebP Quality: 85
   S3 Bucket: way-to-india-prod-images
   Region: ap-south-1

📂 Processing single tour folder: tours/12-jyotirlinga-tour-package/

================================================================================
📁 Processing folder: 12-jyotirlinga-tour-package
================================================================================

   Found 5 image(s) to convert

   [1/5] image1.jpg
   📥 Downloading: tours/12-jyotirlinga-tour-package/image1.jpg
   🔄 Converting to WebP...
   📊 Size: 245.32KB → 156.78KB (36.1% reduction)
   📤 Uploading: tours/12-jyotirlinga-tour-package/image1.webp
   🗑️  Deleting: tours/12-jyotirlinga-tour-package/image1.jpg
   ✅ Completed

   ...

📝 Updating database references...

   ✅ Updated tour: 12-jyotirlinga-tour-package (5 images)

   📊 Updated 1 tour(s) in database

================================================================================
📊 CONVERSION SUMMARY
================================================================================

   Total folders processed: 1
   Total images found: 5
   Successfully converted: 5
   Failed conversions: 0

   Original total size: 1.23 MB
   WebP total size: 0.78 MB
   Space saved: 0.45 MB (36.6%)

================================================================================
✨ Conversion completed successfully!
================================================================================
```
