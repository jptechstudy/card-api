-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'SHOP_OWNER', 'SHOPKEEPER', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "ShopUserType" AS ENUM ('OWNER', 'SHOPKEEPER', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ProductUnit" AS ENUM ('LITER', 'MILLILITER', 'KG', 'GRAM', 'PIECE', 'PACKET', 'CAN', 'BOX', 'OTHER');

-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'BILLED');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "DepositType" AS ENUM ('INITIAL_DEPOSIT', 'TOP_UP', 'REFUND', 'BILL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PermissionCode" AS ENUM ('DAILY_ENTRY_CREATE', 'DAILY_ENTRY_READ', 'DAILY_ENTRY_UPDATE', 'DAILY_ENTRY_DELETE', 'CUSTOMER_MANAGE', 'PRODUCT_MANAGE', 'PRICE_UPDATE', 'BILLING_MANAGE', 'DEPOSIT_MANAGE', 'REPORTS_VIEW', 'SETTINGS_MANAGE', 'SHOPKEEPER_MANAGE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255),
    "mobile" VARCHAR(20) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "avatarUrl" VARCHAR(500),
    "systemRole" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shops" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(50),
    "phone" VARCHAR(20),
    "address" TEXT,
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "pincode" VARCHAR(20),
    "logoUrl" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_users" (
    "id" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "userType" "ShopUserType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" UUID,

    CONSTRAINT "shop_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "shopId" UUID,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" "PermissionCode" NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "category" VARCHAR(50) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_user_roles" (
    "id" UUID NOT NULL,
    "shopUserId" UUID NOT NULL,
    "roleId" UUID NOT NULL,

    CONSTRAINT "shop_user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_user_permissions" (
    "id" UUID NOT NULL,
    "shopUserId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "isGranted" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "shop_user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_shop_profiles" (
    "id" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "customerCode" VARCHAR(50) NOT NULL,
    "depositBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "creditLimit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currentBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "customer_shop_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "code" VARCHAR(50),
    "description" TEXT,
    "unit" "ProductUnit" NOT NULL DEFAULT 'PIECE',
    "currentPrice" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" UUID,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_price_histories" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "reason" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,

    CONSTRAINT "product_price_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_cards" (
    "id" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "customerShopProfileId" UUID NOT NULL,
    "year" SMALLINT NOT NULL,
    "month" SMALLINT NOT NULL,
    "status" "CardStatus" NOT NULL DEFAULT 'ACTIVE',
    "openingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "closingBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "monthly_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_entries" (
    "id" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "customerShopProfileId" UUID NOT NULL,
    "monthlyCardId" UUID NOT NULL,
    "recordedById" UUID NOT NULL,
    "entryDate" DATE NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "status" "EntryStatus" NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "daily_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_entry_items" (
    "id" UUID NOT NULL,
    "dailyEntryId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "productNameSnapshot" VARCHAR(150) NOT NULL,
    "unitSnapshot" "ProductUnit" NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_entry_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_bills" (
    "id" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "customerShopProfileId" UUID NOT NULL,
    "monthlyCardId" UUID NOT NULL,
    "billNumber" VARCHAR(50) NOT NULL,
    "billingPeriodStart" DATE NOT NULL,
    "billingPeriodEnd" DATE NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "previousBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalPayable" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "dueAmount" DECIMAL(12,2) NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paidDate" TIMESTAMP(3),
    "remarks" TEXT,
    "generatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "monthly_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_deposits" (
    "id" UUID NOT NULL,
    "shopId" UUID NOT NULL,
    "customerShopProfileId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "type" "DepositType" NOT NULL DEFAULT 'INITIAL_DEPOSIT',
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receiptNumber" VARCHAR(50),
    "remarks" TEXT,
    "recordedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "customer_deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "shopId" UUID,
    "userId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity" VARCHAR(100) NOT NULL,
    "entityId" VARCHAR(100) NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_mobile_key" ON "users"("mobile");

-- CreateIndex
CREATE INDEX "users_mobile_idx" ON "users"("mobile");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "shops_code_key" ON "shops"("code");

-- CreateIndex
CREATE INDEX "shops_name_idx" ON "shops"("name");

-- CreateIndex
CREATE INDEX "shops_city_idx" ON "shops"("city");

-- CreateIndex
CREATE INDEX "shops_deletedAt_idx" ON "shops"("deletedAt");

-- CreateIndex
CREATE INDEX "shop_users_shopId_userId_idx" ON "shop_users"("shopId", "userId");

-- CreateIndex
CREATE INDEX "shop_users_userId_idx" ON "shop_users"("userId");

-- CreateIndex
CREATE INDEX "shop_users_deletedAt_idx" ON "shop_users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "shop_users_shopId_userId_userType_key" ON "shop_users"("shopId", "userId", "userType");

-- CreateIndex
CREATE INDEX "roles_shopId_idx" ON "roles"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_shopId_name_key" ON "roles"("shopId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "role_permissions_roleId_idx" ON "role_permissions"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "shop_user_roles_shopUserId_roleId_key" ON "shop_user_roles"("shopUserId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "shop_user_permissions_shopUserId_permissionId_key" ON "shop_user_permissions"("shopUserId", "permissionId");

-- CreateIndex
CREATE INDEX "customer_shop_profiles_shopId_status_idx" ON "customer_shop_profiles"("shopId", "status");

-- CreateIndex
CREATE INDEX "customer_shop_profiles_customerId_idx" ON "customer_shop_profiles"("customerId");

-- CreateIndex
CREATE INDEX "customer_shop_profiles_deletedAt_idx" ON "customer_shop_profiles"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "customer_shop_profiles_shopId_customerId_key" ON "customer_shop_profiles"("shopId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_shop_profiles_shopId_customerCode_key" ON "customer_shop_profiles"("shopId", "customerCode");

-- CreateIndex
CREATE INDEX "products_shopId_isActive_idx" ON "products"("shopId", "isActive");

-- CreateIndex
CREATE INDEX "products_deletedAt_idx" ON "products"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "products_shopId_name_key" ON "products"("shopId", "name");

-- CreateIndex
CREATE INDEX "product_price_histories_productId_effectiveFrom_idx" ON "product_price_histories"("productId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "monthly_cards_shopId_year_month_idx" ON "monthly_cards"("shopId", "year", "month");

-- CreateIndex
CREATE INDEX "monthly_cards_customerShopProfileId_year_month_idx" ON "monthly_cards"("customerShopProfileId", "year", "month");

-- CreateIndex
CREATE INDEX "monthly_cards_deletedAt_idx" ON "monthly_cards"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_cards_shopId_customerShopProfileId_year_month_key" ON "monthly_cards"("shopId", "customerShopProfileId", "year", "month");

-- CreateIndex
CREATE INDEX "daily_entries_shopId_entryDate_idx" ON "daily_entries"("shopId", "entryDate");

-- CreateIndex
CREATE INDEX "daily_entries_customerShopProfileId_entryDate_idx" ON "daily_entries"("customerShopProfileId", "entryDate");

-- CreateIndex
CREATE INDEX "daily_entries_monthlyCardId_idx" ON "daily_entries"("monthlyCardId");

-- CreateIndex
CREATE INDEX "daily_entries_deletedAt_idx" ON "daily_entries"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "daily_entries_customerShopProfileId_entryDate_deletedAt_key" ON "daily_entries"("customerShopProfileId", "entryDate", "deletedAt");

-- CreateIndex
CREATE INDEX "daily_entry_items_dailyEntryId_idx" ON "daily_entry_items"("dailyEntryId");

-- CreateIndex
CREATE INDEX "daily_entry_items_productId_idx" ON "daily_entry_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_bills_monthlyCardId_key" ON "monthly_bills"("monthlyCardId");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_bills_billNumber_key" ON "monthly_bills"("billNumber");

-- CreateIndex
CREATE INDEX "monthly_bills_shopId_paymentStatus_idx" ON "monthly_bills"("shopId", "paymentStatus");

-- CreateIndex
CREATE INDEX "monthly_bills_customerShopProfileId_paymentStatus_idx" ON "monthly_bills"("customerShopProfileId", "paymentStatus");

-- CreateIndex
CREATE INDEX "monthly_bills_deletedAt_idx" ON "monthly_bills"("deletedAt");

-- CreateIndex
CREATE INDEX "customer_deposits_shopId_customerShopProfileId_idx" ON "customer_deposits"("shopId", "customerShopProfileId");

-- CreateIndex
CREATE INDEX "customer_deposits_transactionDate_idx" ON "customer_deposits"("transactionDate");

-- CreateIndex
CREATE INDEX "customer_deposits_deletedAt_idx" ON "customer_deposits"("deletedAt");

-- CreateIndex
CREATE INDEX "audit_logs_shopId_createdAt_idx" ON "audit_logs"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_users" ADD CONSTRAINT "shop_users_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_users" ADD CONSTRAINT "shop_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_user_roles" ADD CONSTRAINT "shop_user_roles_shopUserId_fkey" FOREIGN KEY ("shopUserId") REFERENCES "shop_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_user_roles" ADD CONSTRAINT "shop_user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_user_permissions" ADD CONSTRAINT "shop_user_permissions_shopUserId_fkey" FOREIGN KEY ("shopUserId") REFERENCES "shop_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_user_permissions" ADD CONSTRAINT "shop_user_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_shop_profiles" ADD CONSTRAINT "customer_shop_profiles_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_shop_profiles" ADD CONSTRAINT "customer_shop_profiles_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_price_histories" ADD CONSTRAINT "product_price_histories_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_price_histories" ADD CONSTRAINT "product_price_histories_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_cards" ADD CONSTRAINT "monthly_cards_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_cards" ADD CONSTRAINT "monthly_cards_customerShopProfileId_fkey" FOREIGN KEY ("customerShopProfileId") REFERENCES "customer_shop_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_entries_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_entries_customerShopProfileId_fkey" FOREIGN KEY ("customerShopProfileId") REFERENCES "customer_shop_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_entries_monthlyCardId_fkey" FOREIGN KEY ("monthlyCardId") REFERENCES "monthly_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_entries_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_entry_items" ADD CONSTRAINT "daily_entry_items_dailyEntryId_fkey" FOREIGN KEY ("dailyEntryId") REFERENCES "daily_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_entry_items" ADD CONSTRAINT "daily_entry_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_bills" ADD CONSTRAINT "monthly_bills_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_bills" ADD CONSTRAINT "monthly_bills_customerShopProfileId_fkey" FOREIGN KEY ("customerShopProfileId") REFERENCES "customer_shop_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_bills" ADD CONSTRAINT "monthly_bills_monthlyCardId_fkey" FOREIGN KEY ("monthlyCardId") REFERENCES "monthly_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_bills" ADD CONSTRAINT "monthly_bills_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_deposits" ADD CONSTRAINT "customer_deposits_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_deposits" ADD CONSTRAINT "customer_deposits_customerShopProfileId_fkey" FOREIGN KEY ("customerShopProfileId") REFERENCES "customer_shop_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_deposits" ADD CONSTRAINT "customer_deposits_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
