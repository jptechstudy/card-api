import {
  PrismaClient,
  UserRole,
  ShopUserType,
  CustomerStatus,
  ProductUnit,
  CardStatus,
  EntryStatus,
  PaymentStatus,
  DepositType,
  PermissionCode,
} from '@prisma/client';

const prisma = new PrismaClient();

type DefaultItemConfig = {
  name: string;
  qty: number;
  unit: ProductUnit;
  price?: number;
  priceInitial?: number;
  priceRevised?: number;
};

type CustomerSeedData = {
  first: string;
  last: string;
  mobile: string;
  deposit: number;
  credit: number;
};

type ShopConfig = {
  shop: any;
  owner: any;
  recorder: any; // User who records daily entries (Owner or Shopkeeper)
  manager: any;  // User who has managerial rights (Owner or Senior Shopkeeper)
  prefix: string;
  archetype: 'OWNER_RUN' | 'SHOPKEEPER_DAILY_ENTRY_ONLY' | 'SHOPKEEPER_FULL_ACCESS' | 'MULTI_STAFF_HYBRID';
  customers: CustomerSeedData[];
  prodMap: Map<string, any>;
  defaultItems: DefaultItemConfig[];
};

async function main() {
  console.log('🌱 Starting comprehensive multi-tenant database seeding for Card SaaS...\n');

  // ==========================================
  // 0. CLEANUP EXISTING DATA (IDEMPOTENT)
  // ==========================================
  console.log('🧹 Cleaning up old data in reverse dependency order...');
  await prisma.auditLog.deleteMany();
  await prisma.dailyEntryItem.deleteMany();
  await prisma.dailyEntry.deleteMany();
  await prisma.monthlyBill.deleteMany();
  await prisma.monthlyCard.deleteMany();
  await prisma.customerDeposit.deleteMany();
  await prisma.productPriceHistory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customerShopProfile.deleteMany();
  await prisma.shopUserPermission.deleteMany();
  await prisma.shopUserRole.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.shopUser.deleteMany();
  await prisma.shop.deleteMany();
  await prisma.user.deleteMany();
  await prisma.permission.deleteMany();
  console.log('✅ Cleanup complete.\n');

  // ==========================================
  // 1. SEED 12 SYSTEM PERMISSIONS
  // ==========================================
  console.log('🔐 Seeding 12 System Permissions...');
  const permissionsList = [
    {
      code: PermissionCode.DAILY_ENTRY_CREATE,
      name: 'Create Daily Entry',
      description: 'Record customer purchases and deliveries',
      category: 'DAILY_ENTRY',
    },
    {
      code: PermissionCode.DAILY_ENTRY_READ,
      name: 'Read Daily Entry',
      description: 'View daily entries and logs',
      category: 'DAILY_ENTRY',
    },
    {
      code: PermissionCode.DAILY_ENTRY_UPDATE,
      name: 'Update Daily Entry',
      description: 'Modify existing daily purchase entries',
      category: 'DAILY_ENTRY',
    },
    {
      code: PermissionCode.DAILY_ENTRY_DELETE,
      name: 'Delete Daily Entry',
      description: 'Cancel or delete daily purchase entries',
      category: 'DAILY_ENTRY',
    },
    {
      code: PermissionCode.CUSTOMER_MANAGE,
      name: 'Manage Customers',
      description: 'Register and update customer shop profiles',
      category: 'MANAGEMENT',
    },
    {
      code: PermissionCode.PRODUCT_MANAGE,
      name: 'Manage Products',
      description: 'Add and manage catalog products',
      category: 'MANAGEMENT',
    },
    {
      code: PermissionCode.PRICE_UPDATE,
      name: 'Update Prices',
      description: 'Change unit pricing and record price history',
      category: 'MANAGEMENT',
    },
    {
      code: PermissionCode.BILLING_MANAGE,
      name: 'Manage Billing',
      description: 'Generate monthly bills and record payments',
      category: 'FINANCE',
    },
    {
      code: PermissionCode.DEPOSIT_MANAGE,
      name: 'Manage Deposits',
      description: 'Record and refund security deposits',
      category: 'FINANCE',
    },
    {
      code: PermissionCode.REPORTS_VIEW,
      name: 'View Reports',
      description: 'Access revenue, consumption, and audit reports',
      category: 'ANALYTICS',
    },
    {
      code: PermissionCode.SETTINGS_MANAGE,
      name: 'Manage Settings',
      description: 'Update shop profile and system settings',
      category: 'ADMIN',
    },
    {
      code: PermissionCode.SHOPKEEPER_MANAGE,
      name: 'Manage Shopkeepers',
      description: 'Assign staff, roles, and permission overrides',
      category: 'ADMIN',
    },
  ];

  const permMap = new Map<PermissionCode, string>();
  for (const perm of permissionsList) {
    const created = await prisma.permission.create({ data: perm });
    permMap.set(created.code, created.id);
  }
  console.log(`✅ Seeded ${permMap.size} permissions.\n`);

  const defaultPassword = 'password123';

  // ==========================================
  // 2. SEED 4 SHOPS & USER ARCHETYPES
  // ==========================================
  console.log('🏬 Seeding 4 Shops representing distinct operational archetypes...');

  // --------------------------------------------------------------------------
  // SHOP 1: Owner-Run Shop (No shopkeeper, Owner Ramesh Patel runs everything)
  // --------------------------------------------------------------------------
  const owner1 = await prisma.user.create({
    data: {
      firstName: 'Ramesh',
      lastName: 'Patel',
      email: 'ramesh.patel@example.com',
      mobile: '9825000001',
      passwordHash: defaultPassword,
      systemRole: UserRole.SHOP_OWNER,
      isActive: true,
    },
  });

  const shop1 = await prisma.shop.create({
    data: {
      name: 'Krishna Dairy & Provision',
      code: 'KD-01',
      phone: '079-26543210',
      address: 'Shop 12, Swastik Cross Roads, Navrangpura',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380009',
      isActive: true,
      createdById: owner1.id,
    },
  });

  await prisma.shopUser.create({
    data: {
      shopId: shop1.id,
      userId: owner1.id,
      userType: ShopUserType.OWNER,
      isActive: true,
    },
  });

  // --------------------------------------------------------------------------
  // SHOP 2: Shopkeeper-Run with ONLY Daily Entry (Owner: Mansukh, Junior Staff: Rahul)
  // --------------------------------------------------------------------------
  const owner2 = await prisma.user.create({
    data: {
      firstName: 'Mansukh',
      lastName: 'Bhai',
      email: 'mansukh.bhai@example.com',
      mobile: '9825000004',
      passwordHash: defaultPassword,
      systemRole: UserRole.SHOP_OWNER,
      isActive: true,
    },
  });

  const shopkeeper2 = await prisma.user.create({
    data: {
      firstName: 'Rahul',
      lastName: 'Prajapati',
      email: 'rahul.prajapati@example.com',
      mobile: '9825000005',
      passwordHash: defaultPassword,
      systemRole: UserRole.SHOPKEEPER,
      isActive: true,
    },
  });

  const shop2 = await prisma.shop.create({
    data: {
      name: 'Shreeji Daily Goods',
      code: 'SDG-03',
      phone: '0265-2345678',
      address: '22, Alkapuri Arcade, RC Dutt Road',
      city: 'Vadodara',
      state: 'Gujarat',
      pincode: '390007',
      isActive: true,
      createdById: owner2.id,
    },
  });

  await prisma.shopUser.create({
    data: {
      shopId: shop2.id,
      userId: owner2.id,
      userType: ShopUserType.OWNER,
      isActive: true,
    },
  });

  const suShopkeeper2 = await prisma.shopUser.create({
    data: {
      shopId: shop2.id,
      userId: shopkeeper2.id,
      userType: ShopUserType.SHOPKEEPER,
      isActive: true,
    },
  });

  // Role: Entry Operator -> ONLY Daily Entry CRUD (No pricing or billing)
  const roleEntryOperator = await prisma.role.create({
    data: {
      shopId: shop2.id,
      name: 'Entry Operator',
      description: 'Restricted field clerk - can only record and view daily deliveries',
      isSystem: false,
    },
  });

  const dailyEntryPerms = [
    PermissionCode.DAILY_ENTRY_CREATE,
    PermissionCode.DAILY_ENTRY_READ,
    PermissionCode.DAILY_ENTRY_UPDATE,
  ];
  for (const code of dailyEntryPerms) {
    await prisma.rolePermission.create({
      data: {
        roleId: roleEntryOperator.id,
        permissionId: permMap.get(code)!,
      },
    });
  }

  await prisma.shopUserRole.create({
    data: {
      shopUserId: suShopkeeper2.id,
      roleId: roleEntryOperator.id,
    },
  });

  // --------------------------------------------------------------------------
  // SHOP 3: Shopkeeper-Run with FULL ACCESS (Owner: Suresh, Senior Manager: Vijay)
  // --------------------------------------------------------------------------
  const owner3 = await prisma.user.create({
    data: {
      firstName: 'Suresh',
      lastName: 'Verma',
      email: 'suresh.verma@example.com',
      mobile: '9825000002',
      passwordHash: defaultPassword,
      systemRole: UserRole.SHOP_OWNER,
      isActive: true,
    },
  });

  const shopkeeper3 = await prisma.user.create({
    data: {
      firstName: 'Vijay',
      lastName: 'Kumar',
      email: 'vijay.kumar@example.com',
      mobile: '9825000003',
      passwordHash: defaultPassword,
      systemRole: UserRole.SHOPKEEPER,
      isActive: true,
    },
  });

  const shop3 = await prisma.shop.create({
    data: {
      name: 'Radhe Fresh Mart',
      code: 'RFM-02',
      phone: '0261-2456789',
      address: 'Plot 45, Ring Road, Athwa Lines',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395001',
      isActive: true,
      createdById: owner3.id,
    },
  });

  await prisma.shopUser.create({
    data: {
      shopId: shop3.id,
      userId: owner3.id,
      userType: ShopUserType.OWNER,
      isActive: true,
    },
  });

  const suShopkeeper3 = await prisma.shopUser.create({
    data: {
      shopId: shop3.id,
      userId: shopkeeper3.id,
      userType: ShopUserType.SHOPKEEPER,
      isActive: true,
    },
  });

  // Role: Senior Manager -> ALL 12 Permissions granted
  const roleSeniorMgr = await prisma.role.create({
    data: {
      shopId: shop3.id,
      name: 'Senior Manager',
      description: 'Full operational control including pricing, billing, and staff',
      isSystem: false,
    },
  });

  for (const permId of permMap.values()) {
    await prisma.rolePermission.create({
      data: {
        roleId: roleSeniorMgr.id,
        permissionId: permId,
      },
    });
  }

  await prisma.shopUserRole.create({
    data: {
      shopUserId: suShopkeeper3.id,
      roleId: roleSeniorMgr.id,
    },
  });

  // --------------------------------------------------------------------------
  // SHOP 4: Multi-Staff Supermarket (Owner: Kishore, Manager: Pooja, Cashier: Anil)
  // --------------------------------------------------------------------------
  const owner4 = await prisma.user.create({
    data: {
      firstName: 'Kishore',
      lastName: 'Mehta',
      email: 'kishore.mehta@example.com',
      mobile: '9825000006',
      passwordHash: defaultPassword,
      systemRole: UserRole.SHOP_OWNER,
      isActive: true,
    },
  });

  const manager4 = await prisma.user.create({
    data: {
      firstName: 'Pooja',
      lastName: 'Shah',
      email: 'pooja.shah@example.com',
      mobile: '9825000007',
      passwordHash: defaultPassword,
      systemRole: UserRole.SHOPKEEPER,
      isActive: true,
    },
  });

  const cashier4 = await prisma.user.create({
    data: {
      firstName: 'Anil',
      lastName: 'Sharma',
      email: 'anil.sharma@example.com',
      mobile: '9825000008',
      passwordHash: defaultPassword,
      systemRole: UserRole.SHOPKEEPER,
      isActive: true,
    },
  });

  const shop4 = await prisma.shop.create({
    data: {
      name: 'Apex Mart & Superstore',
      code: 'AMS-04',
      phone: '079-27654321',
      address: '101, Titanium Square, Thaltej',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380054',
      isActive: true,
      createdById: owner4.id,
    },
  });

  await prisma.shopUser.create({
    data: { shopId: shop4.id, userId: owner4.id, userType: ShopUserType.OWNER, isActive: true },
  });

  const suManager4 = await prisma.shopUser.create({
    data: { shopId: shop4.id, userId: manager4.id, userType: ShopUserType.SHOPKEEPER, isActive: true },
  });

  const suCashier4 = await prisma.shopUser.create({
    data: { shopId: shop4.id, userId: cashier4.id, userType: ShopUserType.SHOPKEEPER, isActive: true },
  });

  const roleStoreMgr4 = await prisma.role.create({
    data: {
      shopId: shop4.id,
      name: 'Store Manager',
      description: 'Full store operations and pricing access',
      isSystem: false,
    },
  });
  for (const permId of permMap.values()) {
    await prisma.rolePermission.create({ data: { roleId: roleStoreMgr4.id, permissionId: permId } });
  }
  await prisma.shopUserRole.create({ data: { shopUserId: suManager4.id, roleId: roleStoreMgr4.id } });

  const roleCashier4 = await prisma.role.create({
    data: {
      shopId: shop4.id,
      name: 'Cashier Desk',
      description: 'Records daily customer transactions only',
      isSystem: false,
    },
  });
  for (const code of dailyEntryPerms) {
    await prisma.rolePermission.create({
      data: { roleId: roleCashier4.id, permissionId: permMap.get(code)! },
    });
  }
  await prisma.shopUserRole.create({ data: { shopUserId: suCashier4.id, roleId: roleCashier4.id } });

  console.log('✅ Created 4 Shops with distinct RBAC structures & 7 Staff members.\n');

  // ==========================================
  // 3. DYNAMIC 3-MONTH TIMELINE CALCULATION
  // ==========================================
  // - Month 1: 2 months ago (Last-to-Last Month) -> Status: BILLED
  // - Month 2: 1 month ago (Last Month) -> Status: BILLED (Price change active)
  // - Month 3: Current Month -> Status: ACTIVE (Deliveries up to today, unbilled)
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1 to 12
  const currentDay = now.getDate(); // 1 to 31

  function getMonthMetadata(offsetMonths: number) {
    const d = new Date(currentYear, currentMonth - 1 - offsetMonths, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const daysInMonth = new Date(y, m, 0).getDate();
    const monthName = d.toLocaleString('en-US', { month: 'long' });
    const startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(y, m - 1, daysInMonth, 23, 59, 59));
    return { year: y, month: m, days: daysInMonth, name: monthName, startDate, endDate };
  }

  const m1 = getMonthMetadata(2); // Last to last month (e.g. July)
  const m2 = getMonthMetadata(1); // Last month (e.g. August)
  const m3 = {
    ...getMonthMetadata(0), // Current month (e.g. September)
    days: Math.max(1, Math.min(currentDay, getMonthMetadata(0).days)),
    isCurrent: true,
  };

  const months = [
    { ...m1, isCurrent: false, label: `${m1.name} ${m1.year}` },
    { ...m2, isCurrent: false, label: `${m2.name} ${m2.year}` },
    { ...m3, isCurrent: true, label: `${m3.name} ${m3.year} (Active)` },
  ];

  console.log(`📅 Timeline configured:`);
  console.log(`   - Month 1 (Last-to-Last): ${m1.name} ${m1.year} (${m1.days} days, BILLED)`);
  console.log(`   - Month 2 (Last Month):   ${m2.name} ${m2.year} (${m2.days} days, BILLED)`);
  console.log(`   - Month 3 (Current):      ${m3.name} ${m3.year} (Active up to Day ${m3.days})\n`);

  console.log('📦 Seeding Products and Price Timeline for all 4 shops...');

  // Shop 1 Products (Owner-run)
  const products1 = [
    { name: 'Pure Cow Milk', code: 'KD-MILK-COW', unit: ProductUnit.LITER, price: 60.0 },
    { name: 'Buffalo Milk', code: 'KD-MILK-BUFF', unit: ProductUnit.LITER, price: 70.0 },
    { name: 'Fresh Curd / Dahi', code: 'KD-CURD', unit: ProductUnit.KG, price: 80.0 },
    { name: 'Pure Desi Cow Ghee', code: 'KD-GHEE', unit: ProductUnit.KG, price: 650.0 },
  ];
  const prodMap1 = new Map<string, any>();
  for (const p of products1) {
    const prod = await prisma.product.create({
      data: {
        shopId: shop1.id,
        name: p.name,
        code: p.code,
        unit: p.unit,
        currentPrice: p.price,
        createdById: owner1.id,
      },
    });
    await prisma.productPriceHistory.create({
      data: {
        productId: prod.id,
        price: p.price,
        effectiveFrom: m1.startDate,
        reason: 'Initial catalog pricing',
        createdById: owner1.id,
      },
    });
    prodMap1.set(p.name, prod);
  }

  // Shop 2 Products (Shopkeeper only daily entry, price change managed by Owner Mansukh)
  const products2 = [
    { name: 'Standard Toned Milk', code: 'SDG-STD-MILK', unit: ProductUnit.LITER, price: 55.0 },
    { name: 'Table Butter 100g', code: 'SDG-BUTTER', unit: ProductUnit.PIECE, price: 55.0 },
    { name: 'Dahi Pouch 500g', code: 'SDG-DAHI', unit: ProductUnit.PACKET, price: 35.0 },
    { name: 'Tea Toast Biscuit Pack', code: 'SDG-TOAST', unit: ProductUnit.PACKET, price: 40.0 },
  ];
  const prodMap2 = new Map<string, any>();
  for (const p of products2) {
    const prod = await prisma.product.create({
      data: {
        shopId: shop2.id,
        name: p.name,
        code: p.code,
        unit: p.unit,
        currentPrice: p.price,
        createdById: owner2.id,
      },
    });
    await prisma.productPriceHistory.create({
      data: {
        productId: prod.id,
        price: p.price,
        effectiveFrom: m1.startDate,
        reason: 'Initial catalog pricing',
        createdById: owner2.id,
      },
    });
    prodMap2.set(p.name, prod);
  }

  // Shop 3 Products (Shopkeeper Vijay has full access, updates Organic Milk in Month 2)
  const products3 = [
    { name: 'Organic Cow Milk', code: 'RFM-ORG-MILK', unit: ProductUnit.LITER, price: 68.0, initialPrice: 64.0 },
    { name: 'Farm Fresh Brown Bread', code: 'RFM-BREAD', unit: ProductUnit.PIECE, price: 45.0, initialPrice: 45.0 },
    { name: 'Farm Fresh Eggs (6 pcs)', code: 'RFM-EGGS-6', unit: ProductUnit.BOX, price: 50.0, initialPrice: 50.0 },
    { name: 'Fresh Malai Paneer', code: 'RFM-PANEER', unit: ProductUnit.KG, price: 400.0, initialPrice: 400.0 },
  ];
  const prodMap3 = new Map<string, any>();
  for (const p of products3) {
    const prod = await prisma.product.create({
      data: {
        shopId: shop3.id,
        name: p.name,
        code: p.code,
        unit: p.unit,
        currentPrice: p.price,
        createdById: shopkeeper3.id, // Senior Shopkeeper created product!
      },
    });
    await prisma.productPriceHistory.create({
      data: {
        productId: prod.id,
        price: p.initialPrice,
        effectiveFrom: m1.startDate,
        effectiveTo: p.initialPrice !== p.price ? m2.startDate : null,
        reason: 'Initial setup by Senior Manager',
        createdById: shopkeeper3.id,
      },
    });
    if (p.initialPrice !== p.price) {
      await prisma.productPriceHistory.create({
        data: {
          productId: prod.id,
          price: p.price,
          effectiveFrom: m2.startDate,
          reason: 'Supplier cost increase (authorized by Vijay)',
          createdById: shopkeeper3.id,
        },
      });
    }
    prodMap3.set(p.name, prod);
  }

  // Shop 4 Products (Supermarket)
  const products4 = [
    { name: 'Gold Milk 500ml', code: 'AMS-GOLD-500', unit: ProductUnit.PACKET, price: 34.0 },
    { name: 'Multigrain Bread 400g', code: 'AMS-BREAD-MULTI', unit: ProductUnit.PIECE, price: 55.0 },
    { name: 'Greek Yogurt 200g', code: 'AMS-YOGURT', unit: ProductUnit.BOX, price: 65.0 },
    { name: 'Cow Butter 500g', code: 'AMS-BUTTER-500', unit: ProductUnit.BOX, price: 275.0 },
  ];
  const prodMap4 = new Map<string, any>();
  for (const p of products4) {
    const prod = await prisma.product.create({
      data: {
        shopId: shop4.id,
        name: p.name,
        code: p.code,
        unit: p.unit,
        currentPrice: p.price,
        createdById: manager4.id,
      },
    });
    await prisma.productPriceHistory.create({
      data: {
        productId: prod.id,
        price: p.price,
        effectiveFrom: m1.startDate,
        reason: 'Superstore opening pricing',
        createdById: manager4.id,
      },
    });
    prodMap4.set(p.name, prod);
  }

  console.log('✅ Seeded 16 Products with historical price changes.\n');

  // ==========================================
  // 4. DEFINE 10-12 CUSTOMERS PER SHOP
  // ==========================================
  const shopConfigs: ShopConfig[] = [
    {
      shop: shop1,
      owner: owner1,
      recorder: owner1, // Owner records entries
      manager: owner1,  // Owner manages bills
      prefix: 'KD-C',
      archetype: 'OWNER_RUN',
      customers: [
        { first: 'Amit', last: 'Shah', mobile: '9898010001', deposit: 1000, credit: 3000 },
        { first: 'Bhavik', last: 'Joshi', mobile: '9898010002', deposit: 500, credit: 2500 },
        { first: 'Chetan', last: 'Dave', mobile: '9898010003', deposit: 0, credit: 2000 },
        { first: 'Divyesh', last: 'Mehta', mobile: '9898010004', deposit: 1500, credit: 4000 },
        { first: 'Ekta', last: 'Sharma', mobile: '9898010005', deposit: 500, credit: 2000 },
        { first: 'Farhan', last: 'Shaikh', mobile: '9898010006', deposit: 1000, credit: 3000 },
        { first: 'Geeta', last: 'Solanki', mobile: '9898010007', deposit: 2000, credit: 5000 },
        { first: 'Hitesh', last: 'Vaghela', mobile: '9898010008', deposit: 500, credit: 2500 },
        { first: 'Indira', last: 'Gandhi', mobile: '9898010009', deposit: 0, credit: 2000 },
        { first: 'Jayesh', last: 'Trivedi', mobile: '9898010010', deposit: 1000, credit: 3500 },
        { first: 'Kalpesh', last: 'Raval', mobile: '9898010011', deposit: 1500, credit: 4000 },
        { first: 'Lalita', last: 'Panchal', mobile: '9898010012', deposit: 500, credit: 2000 },
      ], // 12 Customers + 1 Owner = 13 Users
      prodMap: prodMap1,
      defaultItems: [
        { name: 'Pure Cow Milk', qty: 1.5, unit: ProductUnit.LITER, price: 60.0 },
        { name: 'Fresh Curd / Dahi', qty: 0.5, unit: ProductUnit.KG, price: 80.0 },
      ],
    },
    {
      shop: shop2,
      owner: owner2,
      recorder: shopkeeper2, // Rahul (Restricted Shopkeeper) records entries
      manager: owner2,       // Mansukh (Owner) generates bills and changes prices
      prefix: 'SDG-C',
      archetype: 'SHOPKEEPER_DAILY_ENTRY_ONLY',
      customers: [
        { first: 'Manish', last: 'Varma', mobile: '9898020001', deposit: 500, credit: 2000 },
        { first: 'Nirav', last: 'Soni', mobile: '9898020002', deposit: 500, credit: 2500 },
        { first: 'Paresh', last: 'Rawal', mobile: '9898020003', deposit: 1000, credit: 3500 },
        { first: 'Queenal', last: 'Shah', mobile: '9898020004', deposit: 0, credit: 1500 },
        { first: 'Rakesh', last: 'Prajapati', mobile: '9898020005', deposit: 2000, credit: 5000 },
        { first: 'Seema', last: 'Deshmukh', mobile: '9898020006', deposit: 1000, credit: 3000 },
        { first: 'Tarun', last: 'Khanna', mobile: '9898020007', deposit: 500, credit: 2500 },
        { first: 'Urmila', last: 'Bhatt', mobile: '9898020008', deposit: 1500, credit: 4000 },
        { first: 'Vipul', last: 'Chauhan', mobile: '9898020009', deposit: 0, credit: 2000 },
        { first: 'Wasim', last: 'Akram', mobile: '9898020010', deposit: 500, credit: 2500 },
        { first: 'Yash', last: 'Parmar', mobile: '9898020011', deposit: 1000, credit: 3000 },
      ], // 11 Customers + 1 Owner + 1 Shopkeeper = 13 Users
      prodMap: prodMap2,
      defaultItems: [
        { name: 'Standard Toned Milk', qty: 2.0, unit: ProductUnit.LITER, price: 55.0 },
        { name: 'Dahi Pouch 500g', qty: 1.0, unit: ProductUnit.PACKET, price: 35.0 },
      ],
    },
    {
      shop: shop3,
      owner: owner3,
      recorder: shopkeeper3, // Vijay (Senior Shopkeeper) records entries
      manager: shopkeeper3,  // Vijay (Senior Shopkeeper) ALSO manages bills & pricing!
      prefix: 'RFM-C',
      archetype: 'SHOPKEEPER_FULL_ACCESS',
      customers: [
        { first: 'Gaurav', last: 'Taneja', mobile: '9898030001', deposit: 2000, credit: 5000 },
        { first: 'Harsh', last: 'Patel', mobile: '9898030002', deposit: 1000, credit: 3000 },
        { first: 'Isha', last: 'Singhania', mobile: '9898030003', deposit: 1500, credit: 4000 },
        { first: 'Jignesh', last: 'Shah', mobile: '9898030004', deposit: 0, credit: 2000 },
        { first: 'Kiran', last: 'Desai', mobile: '9898030005', deposit: 500, credit: 2500 },
        { first: 'Mohit', last: 'Surana', mobile: '9898030006', deposit: 1000, credit: 3000 },
        { first: 'Neeta', last: 'Ambani', mobile: '9898030007', deposit: 2500, credit: 6000 },
        { first: 'Omkar', last: 'Goswami', mobile: '9898030008', deposit: 500, credit: 2000 },
        { first: 'Pratik', last: 'Gandhi', mobile: '9898030009', deposit: 1500, credit: 4500 },
        { first: 'Rhea', last: 'Pillai', mobile: '9898030010', deposit: 500, credit: 2500 },
        { first: 'Sameer', last: 'Nair', mobile: '9898030011', deposit: 1000, credit: 3000 },
        { first: 'Tanvi', last: 'Azmi', mobile: '9898030012', deposit: 2000, credit: 5000 },
      ], // 12 Customers + 1 Owner + 1 Shopkeeper = 14 Users
      prodMap: prodMap3,
      defaultItems: [
        { name: 'Organic Cow Milk', qty: 1.0, unit: ProductUnit.LITER, priceInitial: 64.0, priceRevised: 68.0 },
        { name: 'Farm Fresh Brown Bread', qty: 1.0, unit: ProductUnit.PIECE, price: 45.0 },
      ],
    },
    {
      shop: shop4,
      owner: owner4,
      recorder: cashier4,  // Anil (Cashier) records daily entries
      manager: manager4,   // Pooja (Store Manager) generates bills & updates pricing
      prefix: 'AMS-C',
      archetype: 'MULTI_STAFF_HYBRID',
      customers: [
        { first: 'Aakash', last: 'Chopra', mobile: '9898040001', deposit: 1500, credit: 4000 },
        { first: 'Bina', last: 'Rao', mobile: '9898040002', deposit: 1000, credit: 3500 },
        { first: 'Chirag', last: 'Paswan', mobile: '9898040003', deposit: 500, credit: 2500 },
        { first: 'Deepak', last: 'Chahar', mobile: '9898040004', deposit: 2000, credit: 5000 },
        { first: 'Eshita', last: 'Dutta', mobile: '9898040005', deposit: 500, credit: 2000 },
        { first: 'Falguni', last: 'Pathak', mobile: '9898040006', deposit: 1000, credit: 3000 },
        { first: 'Girish', last: 'Karnad', mobile: '9898040007', deposit: 0, credit: 2000 },
        { first: 'Hardik', last: 'Pandya', mobile: '9898040008', deposit: 3000, credit: 7000 },
        { first: 'Juhi', last: 'Chawla', mobile: '9898040009', deposit: 1500, credit: 4000 },
        { first: 'Kunal', last: 'Khemu', mobile: '9898040010', deposit: 500, credit: 2500 },
        { first: 'Lokesh', last: 'Rahul', mobile: '9898040011', deposit: 1000, credit: 3000 },
      ], // 11 Customers + 1 Owner + 2 Staff = 14 Users
      prodMap: prodMap4,
      defaultItems: [
        { name: 'Gold Milk 500ml', qty: 2.0, unit: ProductUnit.PACKET, price: 34.0 },
        { name: 'Multigrain Bread 400g', qty: 1.0, unit: ProductUnit.PIECE, price: 55.0 },
      ],
    },
  ];

  // ==========================================
  // 5. DYNAMIC 3-MONTH CHRONOLOGICAL LEDGER & ENTRIES
  // ==========================================
  console.log(`📅 Seeding 3-Month Ledger Timeline: [${months.map(m => m.label).join(' -> ')}]...`);

  let billCounter = 1000;
  let totalEntriesCreated = 0;
  let totalBillsCreated = 0;

  for (const shopCfg of shopConfigs) {
    const { shop, recorder, manager, prefix, customers, prodMap, defaultItems } = shopCfg;
    console.log(`  -> Processing Shop: ${shop.name} (${shopCfg.archetype})...`);

    for (let cIdx = 0; cIdx < customers.length; cIdx++) {
      const c = customers[cIdx];
      const custUser = await prisma.user.create({
        data: {
          firstName: c.first,
          lastName: c.last,
          email: `${c.first.toLowerCase()}.${c.last.toLowerCase()}.${cIdx + 1}@example.com`,
          mobile: c.mobile,
          passwordHash: defaultPassword,
          systemRole: UserRole.CUSTOMER,
          isActive: true,
        },
      });

      // ShopUser link
      await prisma.shopUser.create({
        data: {
          shopId: shop.id,
          userId: custUser.id,
          userType: ShopUserType.CUSTOMER,
          isActive: true,
        },
      });

      // Customer Shop Profile (Onboarded at start of Month 1)
      const custProfile = await prisma.customerShopProfile.create({
        data: {
          shopId: shop.id,
          customerId: custUser.id,
          customerCode: `${prefix}-${String(cIdx + 1).padStart(2, '0')}`,
          depositBalance: c.deposit,
          creditLimit: c.credit,
          currentBalance: 0,
          status: CustomerStatus.ACTIVE,
          joinedAt: m1.startDate,
        },
      });

      // Security Deposit record (Recorded at start of Month 1)
      if (c.deposit > 0) {
        await prisma.customerDeposit.create({
          data: {
            shopId: shop.id,
            customerShopProfileId: custProfile.id,
            amount: c.deposit,
            type: DepositType.INITIAL_DEPOSIT,
            transactionDate: m1.startDate,
            receiptNumber: `DEP-${shop.code}-${cIdx + 1}`,
            remarks: 'Onboarding security deposit',
            recordedById: manager.id,
          },
        });
      }

      // 3-Month Ledger Timeline
      let rollingOpeningBalance = 0;

      for (let mIdx = 0; mIdx < months.length; mIdx++) {
        const m = months[mIdx];
        const isCurrentMonth = m.isCurrent;
        const cardStatus = isCurrentMonth ? CardStatus.ACTIVE : CardStatus.BILLED;

        // 1. Create MonthlyCard
        const monthlyCard = await prisma.monthlyCard.create({
          data: {
            shopId: shop.id,
            customerShopProfileId: custProfile.id,
            year: m.year,
            month: m.month,
            status: cardStatus,
            openingBalance: rollingOpeningBalance,
            totalAmount: 0,
            paidAmount: 0,
            closingBalance: rollingOpeningBalance,
          },
        });

        // 2. Generate Daily Entries for alternate delivery days
        let monthPurchases = 0;
        const allPossibleDays = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31];
        const entryDays = allPossibleDays.filter(day => day <= m.days);

        for (const day of entryDays) {
          const dateStr = `${m.year}-${String(m.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const entryDate = new Date(`${dateStr}T06:30:00Z`);

          let dayTotal = 0;
          const entryItemsData: any[] = [];

          for (const item of defaultItems) {
            const prod = prodMap.get(item.name);
            let unitPrice = item.price ?? 50.0;
            if (item.priceInitial !== undefined && mIdx === 0) {
              unitPrice = item.priceInitial;
            } else if (item.priceRevised !== undefined && mIdx >= 1) {
              unitPrice = item.priceRevised;
            }

            const itemTotal = Number(item.qty) * Number(unitPrice);
            dayTotal += itemTotal;

            entryItemsData.push({
              productId: prod.id,
              productNameSnapshot: prod.name,
              unitSnapshot: prod.unit,
              quantity: item.qty,
              unitPrice: unitPrice,
              totalAmount: itemTotal,
            });
          }

          monthPurchases += dayTotal;

          const dailyEntry = await prisma.dailyEntry.create({
            data: {
              shopId: shop.id,
              customerShopProfileId: custProfile.id,
              monthlyCardId: monthlyCard.id,
              recordedById: recorder.id, // Authenticated user who logged the entry
              entryDate: entryDate,
              totalAmount: dayTotal,
              status: EntryStatus.COMPLETED,
            },
          });
          totalEntriesCreated++;

          for (const itemData of entryItemsData) {
            await prisma.dailyEntryItem.create({
              data: {
                dailyEntryId: dailyEntry.id,
                productId: itemData.productId,
                productNameSnapshot: itemData.productNameSnapshot,
                unitSnapshot: itemData.unitSnapshot,
                quantity: itemData.quantity,
                unitPrice: itemData.unitPrice,
                totalAmount: itemData.totalAmount,
              },
            });
          }
        }

        // 3. Billing & Settlement Calculations
        const totalPayable = rollingOpeningBalance + monthPurchases;
        let paidAmount = 0;
        let dueAmount = totalPayable;
        let paymentStatus: PaymentStatus = PaymentStatus.UNPAID;

        if (mIdx === 0) {
          // Month 1 (Last-to-last month): Partial or full payment
          paidAmount = cIdx % 2 === 0 ? totalPayable - 250 : totalPayable;
          dueAmount = totalPayable - paidAmount;
          paymentStatus = dueAmount > 0 ? PaymentStatus.PARTIALLY_PAID : PaymentStatus.PAID;
          rollingOpeningBalance = dueAmount; // Carried over to Month 2
        } else if (mIdx === 1) {
          // Month 2 (Last month): Paid in full
          paidAmount = totalPayable;
          dueAmount = 0;
          paymentStatus = PaymentStatus.PAID;
          rollingOpeningBalance = 0; // Fresh start for Current Month
        } else {
          // Month 3 (Current month): Active current month (Unbilled)
          paidAmount = 0;
          dueAmount = totalPayable;
          paymentStatus = PaymentStatus.UNPAID;

          // Update Customer currentBalance for ongoing live consumption
          await prisma.customerShopProfile.update({
            where: { id: custProfile.id },
            data: { currentBalance: totalPayable },
          });
        }

        // Update MonthlyCard final totals
        await prisma.monthlyCard.update({
          where: { id: monthlyCard.id },
          data: {
            totalAmount: monthPurchases,
            paidAmount: paidAmount,
            closingBalance: dueAmount,
          },
        });

        // Generate MonthlyBill for closed months (Month 1 & Month 2)
        if (!isCurrentMonth) {
          billCounter++;
          const billNo = `BILL-${shop.code}-${m.year}${String(m.month).padStart(2, '0')}-${String(billCounter).padStart(4, '0')}`;

          await prisma.monthlyBill.create({
            data: {
              shopId: shop.id,
              customerShopProfileId: custProfile.id,
              monthlyCardId: monthlyCard.id,
              billNumber: billNo,
              billingPeriodStart: m.startDate,
              billingPeriodEnd: m.endDate,
              totalAmount: monthPurchases,
              discountAmount: 0,
              taxAmount: 0,
              netAmount: monthPurchases,
              previousBalance: monthlyCard.openingBalance,
              totalPayable: totalPayable,
              paidAmount: paidAmount,
              dueAmount: dueAmount,
              paymentStatus: paymentStatus,
              paidDate: paymentStatus === PaymentStatus.PAID ? m.endDate : null,
              generatedById: manager.id, // User with BILLING_MANAGE permission
            },
          });
          totalBillsCreated++;
        }
      }
    }
  }

  console.log(`\n✅ Generated ledger records across 3 months:`);
  console.log(`   - 138 Monthly Cards (46 customers x 3 months)`);
  console.log(`   - ${totalEntriesCreated} Daily Entries with frozen line items`);
  console.log(`   - ${totalBillsCreated} Invoices generated for closed monthly cycles.\n`);

  // ==========================================
  // 6. SEED AUDIT LOGS FOR ALL ARCHETYPES
  // ==========================================
  console.log('📝 Seeding Comprehensive Audit Trail...');
  await prisma.auditLog.createMany({
    data: [
      {
        shopId: shop1.id,
        userId: owner1.id,
        action: 'SHOP_INITIALIZED',
        entity: 'Shop',
        entityId: shop1.id,
        newValues: { name: shop1.name, archetype: 'OWNER_RUN' },
      },
      {
        shopId: shop2.id,
        userId: owner2.id,
        action: 'ROLE_ASSIGNED_RESTRICTED',
        entity: 'ShopUserRole',
        entityId: suShopkeeper2.id,
        newValues: { role: 'Entry Operator', permissions: dailyEntryPerms },
      },
      {
        shopId: shop3.id,
        userId: shopkeeper3.id,
        action: 'PRICE_UPDATE_AUTHORIZED',
        entity: 'Product',
        entityId: prodMap3.get('Organic Cow Milk').id,
        oldValues: { price: 64.0 },
        newValues: { price: 68.0, reason: `Supplier cost increase effective ${m2.name} (Authorized by Senior Manager)` },
      },
      {
        shopId: shop2.id,
        userId: owner2.id,
        action: 'MONTHLY_BILL_BATCH_GENERATED',
        entity: 'MonthlyBill',
        entityId: `BATCH_${m1.name.toUpperCase()}_${m1.year}`,
        newValues: { month: m1.month, year: m1.year, generatedBy: 'Mansukh Bhai (Owner)' },
      },
      {
        shopId: shop3.id,
        userId: shopkeeper3.id,
        action: 'MONTHLY_BILL_BATCH_GENERATED',
        entity: 'MonthlyBill',
        entityId: `BATCH_${m1.name.toUpperCase()}_${m1.year}_RFM`,
        newValues: { month: m1.month, year: m1.year, generatedBy: 'Vijay Kumar (Senior Shopkeeper)' },
      },
      {
        shopId: shop4.id,
        userId: manager4.id,
        action: 'STORE_MANAGER_RECONCILIATION',
        entity: 'MonthlyCard',
        entityId: `${m2.name.toUpperCase()}_${m2.year}_CLOSE`,
        newValues: { status: 'BILLED', reconciledBy: 'Pooja Shah' },
      },
    ],
  });
  console.log('✅ Audit trail recorded.\n');

  console.log('🎉 Seeding successfully completed for 4 shops, 54 users, and 3-month timeline!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
