-- Drop the legacy single-name unique constraint
DROP INDEX IF EXISTS "products_shopId_name_key";

-- Create partial composite unique index on active products: shopId + lower(name) + coalesce(volume, '') + lower(unit) + currentPrice
CREATE UNIQUE INDEX IF NOT EXISTS "products_shopId_name_volume_unit_price_uniq"
ON "products"("shopId", LOWER("name"), COALESCE("volume", ''), LOWER("unit"), "currentPrice")
WHERE "deletedAt" IS NULL;

-- Create supporting index for search & lookups
CREATE INDEX IF NOT EXISTS "products_shopId_name_idx" ON "products"("shopId", "name");
CREATE INDEX IF NOT EXISTS "products_shopId_name_volume_unit_currentPrice_idx" ON "products"("shopId", "name", "volume", "unit", "currentPrice");
