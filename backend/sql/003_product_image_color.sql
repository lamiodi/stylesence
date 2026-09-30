-- 003_product_image_color.sql — colour-scoped product galleries (2026-09-30).
-- ProductImage.color holds the colourway name an image belongs to (mirrors
-- ProductVariant.color); NULL = shared, shown for every colour. Nullable, no
-- default, no index needed (galleries are fetched whole per product).

ALTER TABLE "ProductImage" ADD COLUMN IF NOT EXISTS color TEXT;
