-- AlterTable: Add volume and unitCode to products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "volume" VARCHAR(50);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "unitCode" VARCHAR(20);

-- Convert products.unit to VARCHAR(50)
ALTER TABLE "products" ALTER COLUMN "unit" TYPE VARCHAR(50) USING "unit"::text;
ALTER TABLE "products" ALTER COLUMN "unit" SET DEFAULT 'Piece';

-- Backfill legacy enum values in products
UPDATE "products" SET "unit" = 'Liter', "unitCode" = 'L' WHERE "unit"::text = 'LITER';
UPDATE "products" SET "unit" = 'Milliliter', "unitCode" = 'ML' WHERE "unit"::text = 'MILLILITER';
UPDATE "products" SET "unit" = 'Kilogram', "unitCode" = 'KG' WHERE "unit"::text = 'KG';
UPDATE "products" SET "unit" = 'Gram', "unitCode" = 'G' WHERE "unit"::text = 'GRAM';
UPDATE "products" SET "unit" = 'Piece', "unitCode" = 'PCS' WHERE "unit"::text = 'PIECE';
UPDATE "products" SET "unit" = 'Packet', "unitCode" = 'PKT' WHERE "unit"::text = 'PACKET';
UPDATE "products" SET "unit" = 'Box', "unitCode" = 'BOX' WHERE "unit"::text = 'BOX';
UPDATE "products" SET "unit" = 'Can', "unitCode" = 'CAN' WHERE "unit"::text = 'CAN';
UPDATE "products" SET "unit" = 'Other', "unitCode" = 'OTHER' WHERE "unit"::text = 'OTHER';

-- Convert daily_entry_items.unitSnapshot to VARCHAR(50)
ALTER TABLE "daily_entry_items" ALTER COLUMN "unitSnapshot" TYPE VARCHAR(50) USING "unitSnapshot"::text;
ALTER TABLE "daily_entry_items" ALTER COLUMN "unitSnapshot" SET DEFAULT 'Piece';
