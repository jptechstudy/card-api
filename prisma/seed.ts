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
  priceJan?: number;
  priceFebMar?: number;
};

type ShopConfig = {
  shop: any;
  recorder: any;
  prefix: string;
  customers: Array<{
    first: string;
    last: string;
    mobile: string;
    deposit: number;
    credit: number;
  }>;
  prodMap: Map<string, any>;
  defaultItems: DefaultItemConfig[];
};

async function main() {
  console.log('🌱 Starting comprehensive database seeding for card_020926...\n');

  // ==========================================
  // 0. CLEANUP EXISTING DATA (IDEMPOTENCY)
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
  // 1. SEED PERMISSIONS
  // ==========================================
  console.log('🔐 Seeding 12 System Permissions...');
  const permissionsList = [
    {
      code: PermissionCode.DAILY_ENTRY_CREATE,
      name: 'Create Daily Entry',
      description: 'Record customer purchases',
      category: 'DAILY_ENTRY',
    },
    {
      code: PermissionCode.DAILY_ENTRY_READ,
      name: 'Read Daily Entry',
      description: 'View daily entries',
      category: 'DAILY_ENTRY',
    },
    {
      code: PermissionCode.DAILY_ENTRY_UPDATE,
      name: 'Update Daily Entry',
      description: 'Modify recorded entries',
      category: 'DAILY_ENTRY',
    },
    {
      code: PermissionCode.DAILY_ENTRY_DELETE,
      name: 'Delete Daily Entry',
      description: 'Cancel / delete entries',
      category: 'DAILY_ENTRY',
    },
    {
      code: PermissionCode.CUSTOMER_MANAGE,
      name: 'Manage Customers',
      description: 'Create & edit customer profiles',
      category: 'MANAGEMENT',
    },
    {
      code: PermissionCode.PRODUCT_MANAGE,
      name: 'Manage Products',
      description: 'Add and manage catalog items',
      category: 'MANAGEMENT',
    },
    {
      code: PermissionCode.PRICE_UPDATE,
      name: 'Update Prices',
      description: 'Modify product unit pricing',
      category: 'MANAGEMENT',
    },
    {
      code: PermissionCode.BILLING_MANAGE,
      name: 'Manage Billing',
      description: 'Generate and settle bills',
      category: 'FINANCE',
    },
    {
      code: PermissionCode.DEPOSIT_MANAGE,
      name: 'Manage Deposits',
      description: 'Record and refund deposits',
      category: 'FINANCE',
    },
    {
      code: PermissionCode.REPORTS_VIEW,
      name: 'View Reports',
      description: 'Access shop analytics and reports',
      category: 'ANALYTICS',
    },
    {
      code: PermissionCode.SETTINGS_MANAGE,
      name: 'Manage Settings',
      description: 'Change shop configurations',
      category: 'ADMIN',
    },
    {
      code: PermissionCode.SHOPKEEPER_MANAGE,
      name: 'Manage Shopkeepers',
      description: 'Assign staff and roles',
      category: 'ADMIN',
    },
  ];

  const permMap = new Map<PermissionCode, string>();
  for (const perm of permissionsList) {
    const created = await prisma.permission.create({ data: perm });
    permMap.set(created.code, created.id);
  }
  console.log(`✅ Seeded ${permMap.size} permissions.\n`);

  // Default password for all users
  const defaultPassword = 'password123';

  // ==========================================
  // 2. SEED USERS & SHOPS
  // ==========================================
  console.log('🏬 Seeding 3 Shops & Owners...');

  // --- Shop A: Krishna Dairy & Provision (Owner: Ramesh Patel) ---
  const ownerA = await prisma.user.create({
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

  const shopA = await prisma.shop.create({
    data: {
      name: 'Krishna Dairy & Provision',
      code: 'KD-01',
      phone: '079-26543210',
      address: 'Shop 12, Swastik Cross Roads, Navrangpura',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380009',
      isActive: true,
      createdById: ownerA.id,
    },
  });

  await prisma.shopUser.create({
    data: {
      shopId: shopA.id,
      userId: ownerA.id,
      userType: ShopUserType.OWNER,
      isActive: true,
    },
  });

  // --- Shop B: Radhe Fresh Mart (Owner: Suresh Verma, Senior Shopkeeper: Vijay Kumar) ---
  const ownerB = await prisma.user.create({
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

  const shopkeeperB = await prisma.user.create({
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

  const shopB = await prisma.shop.create({
    data: {
      name: 'Radhe Fresh Mart',
      code: 'RFM-02',
      phone: '0261-2456789',
      address: 'Plot 45, Ring Road, Athwa Lines',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395001',
      isActive: true,
      createdById: ownerB.id,
    },
  });

  await prisma.shopUser.create({
    data: {
      shopId: shopB.id,
      userId: ownerB.id,
      userType: ShopUserType.OWNER,
      isActive: true,
    },
  });

  const suShopkeeperB = await prisma.shopUser.create({
    data: {
      shopId: shopB.id,
      userId: shopkeeperB.id,
      userType: ShopUserType.SHOPKEEPER,
      isActive: true,
    },
  });

  // Role: Senior Manager (Shop B) -> ALL 12 Permissions
  const roleSeniorMgr = await prisma.role.create({
    data: {
      shopId: shopB.id,
      name: 'Senior Manager',
      description: 'Full managerial access including pricing and billing',
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
      shopUserId: suShopkeeperB.id,
      roleId: roleSeniorMgr.id,
    },
  });

  // --- Shop C: Shreeji Daily Goods (Owner: Mansukh Bhai, Junior Shopkeeper: Rahul Prajapati) ---
  const ownerC = await prisma.user.create({
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

  const shopkeeperC = await prisma.user.create({
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

  const shopC = await prisma.shop.create({
    data: {
      name: 'Shreeji Daily Goods',
      code: 'SDG-03',
      phone: '0265-2345678',
      address: '22, Alkapuri Arcade, RC Dutt Road',
      city: 'Vadodara',
      state: 'Gujarat',
      pincode: '390007',
      isActive: true,
      createdById: ownerC.id,
    },
  });

  await prisma.shopUser.create({
    data: {
      shopId: shopC.id,
      userId: ownerC.id,
      userType: ShopUserType.OWNER,
      isActive: true,
    },
  });

  const suShopkeeperC = await prisma.shopUser.create({
    data: {
      shopId: shopC.id,
      userId: shopkeeperC.id,
      userType: ShopUserType.SHOPKEEPER,
      isActive: true,
    },
  });

  // Role: Entry Operator (Shop C) -> ONLY Daily Entry Permissions
  const roleEntryOperator = await prisma.role.create({
    data: {
      shopId: shopC.id,
      name: 'Entry Operator',
      description: 'Restricted staff - can only record and update daily entries',
      isSystem: false,
    },
  });

  const dailyEntryPermCodes = [
    PermissionCode.DAILY_ENTRY_CREATE,
    PermissionCode.DAILY_ENTRY_READ,
    PermissionCode.DAILY_ENTRY_UPDATE,
  ];

  for (const code of dailyEntryPermCodes) {
    const permId = permMap.get(code)!;
    await prisma.rolePermission.create({
      data: {
        roleId: roleEntryOperator.id,
        permissionId: permId,
      },
    });
  }

  await prisma.shopUserRole.create({
    data: {
      shopUserId: suShopkeeperC.id,
      roleId: roleEntryOperator.id,
    },
  });

  console.log('✅ Created 3 Shops, 3 Owners, 2 Shopkeepers & configured custom RBAC.\n');

  // ==========================================
  // 3. SEED PRODUCTS & PRICE HISTORIES
  // ==========================================
  console.log('📦 Seeding Products and Price History...');

  // Shop A Products
  const productsA = [
    { name: 'Pure Cow Milk', code: 'A-MILK-COW', unit: ProductUnit.LITER, price: 60.0 },
    { name: 'Buffalo Milk', code: 'A-MILK-BUFF', unit: ProductUnit.LITER, price: 70.0 },
    { name: 'Fresh Curd / Dahi', code: 'A-CURD', unit: ProductUnit.KG, price: 80.0 },
    { name: 'Pure Desi Cow Ghee', code: 'A-GHEE', unit: ProductUnit.KG, price: 650.0 },
  ];

  const prodMapA = new Map<string, any>();
  for (const p of productsA) {
    const prod = await prisma.product.create({
      data: {
        shopId: shopA.id,
        name: p.name,
        code: p.code,
        unit: p.unit,
        currentPrice: p.price,
        createdById: ownerA.id,
      },
    });
    await prisma.productPriceHistory.create({
      data: {
        productId: prod.id,
        price: p.price,
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        reason: 'Initial catalog pricing',
        createdById: ownerA.id,
      },
    });
    prodMapA.set(p.name, prod);
  }

  // Shop B Products (with Feb price update for Organic Cow Milk)
  const productsB = [
    { name: 'Organic Cow Milk', code: 'B-ORG-MILK', unit: ProductUnit.LITER, price: 68.0, initialPrice: 64.0 },
    { name: 'Farm Fresh Brown Bread', code: 'B-BREAD-BRN', unit: ProductUnit.PIECE, price: 45.0, initialPrice: 45.0 },
    { name: 'Farm Fresh Eggs (6 pcs)', code: 'B-EGGS-6', unit: ProductUnit.BOX, price: 50.0, initialPrice: 50.0 },
    { name: 'Fresh Malai Paneer', code: 'B-PANEER', unit: ProductUnit.KG, price: 400.0, initialPrice: 400.0 },
  ];

  const prodMapB = new Map<string, any>();
  for (const p of productsB) {
    const prod = await prisma.product.create({
      data: {
        shopId: shopB.id,
        name: p.name,
        code: p.code,
        unit: p.unit,
        currentPrice: p.price,
        createdById: shopkeeperB.id,
      },
    });
    // Initial Jan price
    await prisma.productPriceHistory.create({
      data: {
        productId: prod.id,
        price: p.initialPrice,
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        effectiveTo: p.initialPrice !== p.price ? new Date('2026-02-01T00:00:00Z') : null,
        reason: 'Initial setup',
        createdById: shopkeeperB.id,
      },
    });
    // Feb price increase if changed
    if (p.initialPrice !== p.price) {
      await prisma.productPriceHistory.create({
        data: {
          productId: prod.id,
          price: p.price,
          effectiveFrom: new Date('2026-02-01T00:00:00Z'),
          reason: 'Supplier cost increase',
          createdById: shopkeeperB.id,
        },
      });
    }
    prodMapB.set(p.name, prod);
  }

  // Shop C Products
  const productsC = [
    { name: 'Standard Toned Milk', code: 'C-STD-MILK', unit: ProductUnit.LITER, price: 55.0 },
    { name: 'Table Butter 100g', code: 'C-BUTTER', unit: ProductUnit.PIECE, price: 55.0 },
    { name: 'Dahi Pouch 500g', code: 'C-DAHI-500', unit: ProductUnit.PACKET, price: 35.0 },
    { name: 'Tea Toast Biscuit Pack', code: 'C-TOAST', unit: ProductUnit.PACKET, price: 40.0 },
  ];

  const prodMapC = new Map<string, any>();
  for (const p of productsC) {
    const prod = await prisma.product.create({
      data: {
        shopId: shopC.id,
        name: p.name,
        code: p.code,
        unit: p.unit,
        currentPrice: p.price,
        createdById: ownerC.id,
      },
    });
    await prisma.productPriceHistory.create({
      data: {
        productId: prod.id,
        price: p.price,
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        reason: 'Initial pricing',
        createdById: ownerC.id,
      },
    });
    prodMapC.set(p.name, prod);
  }

  console.log('✅ Seeded 12 Products with historical price changes.\n');

  // ==========================================
  // 4. SEED CUSTOMERS & CUSTOMER SHOP PROFILES
  // ==========================================
  console.log('👥 Seeding 15 Customers (5 per shop) with Deposits...');

  const shopConfigs: ShopConfig[] = [
    {
      shop: shopA,
      recorder: ownerA,
      prefix: 'CUST-A',
      customers: [
        { first: 'Amit', last: 'Shah', mobile: '9898000001', deposit: 1000, credit: 3000 },
        { first: 'Bhavik', last: 'Joshi', mobile: '9898000002', deposit: 500, credit: 2500 },
        { first: 'Chetan', last: 'Dave', mobile: '9898000003', deposit: 0, credit: 2000 },
        { first: 'Divyesh', last: 'Mehta', mobile: '9898000004', deposit: 1500, credit: 4000 },
        { first: 'Ekta', last: 'Sharma', mobile: '9898000005', deposit: 500, credit: 2000 },
      ],
      prodMap: prodMapA,
      defaultItems: [
        { name: 'Pure Cow Milk', qty: 1.5, unit: ProductUnit.LITER, price: 60.0 },
        { name: 'Fresh Curd / Dahi', qty: 0.5, unit: ProductUnit.KG, price: 80.0 },
      ],
    },
    {
      shop: shopB,
      recorder: shopkeeperB,
      prefix: 'RFM-C',
      customers: [
        { first: 'Gaurav', last: 'Taneja', mobile: '9898000006', deposit: 2000, credit: 5000 },
        { first: 'Harsh', last: 'Patel', mobile: '9898000007', deposit: 1000, credit: 3000 },
        { first: 'Isha', last: 'Singhania', mobile: '9898000008', deposit: 1500, credit: 4000 },
        { first: 'Jignesh', last: 'Shah', mobile: '9898000009', deposit: 0, credit: 2000 },
        { first: 'Kiran', last: 'Desai', mobile: '9898000010', deposit: 500, credit: 2500 },
      ],
      prodMap: prodMapB,
      defaultItems: [
        { name: 'Organic Cow Milk', qty: 1.0, unit: ProductUnit.LITER, priceJan: 64.0, priceFebMar: 68.0 },
        { name: 'Farm Fresh Brown Bread', qty: 1.0, unit: ProductUnit.PIECE, price: 45.0 },
      ],
    },
    {
      shop: shopC,
      recorder: shopkeeperC,
      prefix: 'SDG-C',
      customers: [
        { first: 'Manish', last: 'Varma', mobile: '9898000011', deposit: 500, credit: 2000 },
        { first: 'Nirav', last: 'Soni', mobile: '9898000012', deposit: 500, credit: 2500 },
        { first: 'Paresh', last: 'Rawal', mobile: '9898000013', deposit: 1000, credit: 3500 },
        { first: 'Queenal', last: 'Shah', mobile: '9898000014', deposit: 0, credit: 1500 },
        { first: 'Rakesh', last: 'Prajapati', mobile: '9898000015', deposit: 2000, credit: 5000 },
      ],
      prodMap: prodMapC,
      defaultItems: [
        { name: 'Standard Toned Milk', qty: 2.0, unit: ProductUnit.LITER, price: 55.0 },
        { name: 'Dahi Pouch 500g', qty: 1.0, unit: ProductUnit.PACKET, price: 35.0 },
      ],
    },
  ];

  // ==========================================
  // 5. SEED 3-MONTH LEDGER, ENTRIES & BILLING
  // ==========================================
  console.log('📅 Seeding 3-Month Ledger (Jan, Feb, Mar 2026), Daily Entries & Bills...');

  const months = [
    { year: 2026, month: 1, days: 31 },
    { year: 2026, month: 2, days: 28 },
    { year: 2026, month: 3, days: 31 },
  ];

  let billCounter = 100;

  for (const shopCfg of shopConfigs) {
    const { shop, recorder, prefix, customers, prodMap, defaultItems } = shopCfg;

    for (let cIdx = 0; cIdx < customers.length; cIdx++) {
      const c = customers[cIdx];
      const custUser = await prisma.user.create({
        data: {
          firstName: c.first,
          lastName: c.last,
          email: `${c.first.toLowerCase()}.${c.last.toLowerCase()}@example.com`,
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

      // Customer Shop Profile
      const custProfile = await prisma.customerShopProfile.create({
        data: {
          shopId: shop.id,
          customerId: custUser.id,
          customerCode: `${prefix}-${String(cIdx + 1).padStart(2, '0')}`,
          depositBalance: c.deposit,
          creditLimit: c.credit,
          currentBalance: 0,
          status: CustomerStatus.ACTIVE,
          joinedAt: new Date('2026-01-01T00:00:00Z'),
        },
      });

      // Initial Deposit record if > 0
      if (c.deposit > 0) {
        await prisma.customerDeposit.create({
          data: {
            shopId: shop.id,
            customerShopProfileId: custProfile.id,
            amount: c.deposit,
            type: DepositType.INITIAL_DEPOSIT,
            transactionDate: new Date('2026-01-01T09:00:00Z'),
            receiptNumber: `DEP-${shop.code}-${cIdx + 1}`,
            remarks: 'Initial onboarding security deposit',
            recordedById: recorder.id,
          },
        });
      }

      // Generate 3 Months of Ledger
      let rollingOpeningBalance = 0;

      for (const m of months) {
        const isCurrentMonth = m.month === 3;
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

        // 2. Generate Daily Entries for selected days in this month
        let monthPurchases = 0;
        const entryDays = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27];
        if (m.days >= 30) entryDays.push(29, 31);

        for (const day of entryDays) {
          if (day > m.days) continue;

          const dateStr = `${m.year}-${String(m.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const entryDate = new Date(`${dateStr}T06:30:00Z`);

          let dayTotal = 0;
          const entryItemsData: any[] = [];

          for (const item of defaultItems) {
            const prod = prodMap.get(item.name);
            let unitPrice = item.price ?? 50.0;
            if (item.priceJan !== undefined && m.month === 1) {
              unitPrice = item.priceJan;
            } else if (item.priceFebMar !== undefined && m.month >= 2) {
              unitPrice = item.priceFebMar;
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
              recordedById: recorder.id,
              entryDate: entryDate,
              totalAmount: dayTotal,
              status: EntryStatus.COMPLETED,
            },
          });

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

        // 3. Monthly Bill & Settlement Calculation
        const totalPayable = rollingOpeningBalance + monthPurchases;
        let paidAmount = 0;
        let dueAmount = totalPayable;
        let paymentStatus: PaymentStatus = PaymentStatus.UNPAID;

        if (m.month === 1) {
          // Month 1: Partially paid or fully paid
          paidAmount = cIdx % 2 === 0 ? totalPayable - 200 : totalPayable;
          dueAmount = totalPayable - paidAmount;
          paymentStatus = dueAmount > 0 ? PaymentStatus.PARTIALLY_PAID : PaymentStatus.PAID;
          rollingOpeningBalance = dueAmount;
        } else if (m.month === 2) {
          // Month 2: Full payment
          paidAmount = totalPayable;
          dueAmount = 0;
          paymentStatus = PaymentStatus.PAID;
          rollingOpeningBalance = 0;
        } else {
          // Month 3 (Current): Active month, unbilled
          paidAmount = 0;
          dueAmount = totalPayable;
          paymentStatus = PaymentStatus.UNPAID;
        }

        // Update MonthlyCard final figures
        await prisma.monthlyCard.update({
          where: { id: monthlyCard.id },
          data: {
            totalAmount: monthPurchases,
            paidAmount: paidAmount,
            closingBalance: dueAmount,
          },
        });

        // Create MonthlyBill for closed months (Jan & Feb)
        if (!isCurrentMonth) {
          billCounter++;
          const billNo = `BILL-${shop.code}-${m.year}${String(m.month).padStart(2, '0')}-${String(billCounter).padStart(4, '0')}`;
          const periodStart = new Date(`${m.year}-${String(m.month).padStart(2, '0')}-01T00:00:00Z`);
          const periodEnd = new Date(
            `${m.year}-${String(m.month).padStart(2, '0')}-${String(m.days).padStart(2, '0')}T23:59:59Z`,
          );

          await prisma.monthlyBill.create({
            data: {
              shopId: shop.id,
              customerShopProfileId: custProfile.id,
              monthlyCardId: monthlyCard.id,
              billNumber: billNo,
              billingPeriodStart: periodStart,
              billingPeriodEnd: periodEnd,
              totalAmount: monthPurchases,
              discountAmount: 0,
              taxAmount: 0,
              netAmount: monthPurchases,
              previousBalance: monthlyCard.openingBalance,
              totalPayable: totalPayable,
              paidAmount: paidAmount,
              dueAmount: dueAmount,
              paymentStatus: paymentStatus,
              paidDate: paymentStatus === PaymentStatus.PAID ? periodEnd : null,
              generatedById: shopCfg.shop.createdById ?? recorder.id,
            },
          });
        }
      }
    }
  }

  console.log('✅ Created 45 Monthly Cards, Daily Entries and Monthly Bills across 3 months.\n');

  // ==========================================
  // 6. SEED AUDIT LOGS
  // ==========================================
  console.log('📝 Seeding Audit Logs...');
  await prisma.auditLog.createMany({
    data: [
      {
        shopId: shopB.id,
        userId: shopkeeperB.id,
        action: 'PRICE_UPDATE',
        entity: 'Product',
        entityId: prodMapB.get('Organic Cow Milk').id,
        newValues: { price: 68.0, reason: 'Supplier cost increase' },
        oldValues: { price: 64.0 },
      },
      {
        shopId: shopA.id,
        userId: ownerA.id,
        action: 'MONTHLY_BILL_GENERATED',
        entity: 'MonthlyBill',
        entityId: 'JANUARY_2026_BATCH',
        newValues: { month: 1, year: 2026, status: 'GENERATED' },
      },
      {
        shopId: shopC.id,
        userId: ownerC.id,
        action: 'INITIAL_DEPOSIT_RECORDED',
        entity: 'CustomerDeposit',
        entityId: 'SDG-01',
        newValues: { amount: 500, type: 'INITIAL_DEPOSIT' },
      },
    ],
  });
  console.log('✅ Audit Logs created.\n');

  console.log('🎉 Seeding successfully completed for database `card_020926`!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
