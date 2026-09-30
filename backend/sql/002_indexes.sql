-- 002_indexes.sql — secondary/FK indexes (2026-09-30, applied live via CONCURRENTLY).
-- Prisma declared none of these; live stats showed 10k+ sequential scans on
-- Product/ProductImage/ProductVariant. CONCURRENTLY builds take no write locks
-- and cannot run inside a transaction — apply statement by statement.

-- Relation lookups (the storefront's joined queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS product_image_product_id_idx ON "ProductImage" ("productId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS product_variant_product_id_idx ON "ProductVariant" ("productId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS review_product_id_status_idx ON "Review" ("productId", status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS product_relation_product_id_idx ON "ProductRelation" ("productId");

-- Cart + order line items
CREATE INDEX CONCURRENTLY IF NOT EXISTS cart_item_cart_id_idx ON "CartItem" ("cartId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS order_item_order_id_idx ON "OrderItem" ("orderId");

-- Order lookups: guest/customer history (email, newest first)
CREATE INDEX CONCURRENTLY IF NOT EXISTS order_email_created_at_idx ON "Order" (email, "createdAt" DESC);
-- Paystack webhook fallback lookup (reference only exists on gateway orders)
CREATE INDEX CONCURRENTLY IF NOT EXISTS order_payment_reference_idx ON "Order" ("paymentReference") WHERE "paymentReference" IS NOT NULL;

-- Content listings
CREATE INDEX CONCURRENTLY IF NOT EXISTS journal_post_published_idx ON "JournalPost" ("isPublished", "publishedAt" DESC);
-- Back-in-stock waitlist: per-variant un-notified counts
CREATE INDEX CONCURRENTLY IF NOT EXISTS stock_alert_variant_notified_idx ON "StockAlert" ("variantId", "notifiedAt");
