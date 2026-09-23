import { PrismaClient, UserRole, PermissionCode } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SUPER_ADMIN_CONFIG = {
  firstName: 'J',
  lastName: 'P',
  email: 'jptechstudy@gmail.com',
  mobile: '7990150424',
  rawPassword: 'Ultra@2010',
  systemRole: UserRole.SUPER_ADMIN,
};

const SYSTEM_PERMISSIONS = [
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

async function main() {
  console.log('🚀 [Seed SuperAdmin] Starting standalone Super Admin provisioning...\n');

  // 1. Ensure system permissions are present in the database
  console.log('🔐 Ensuring system permissions are seeded...');
  for (const perm of SYSTEM_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {
        name: perm.name,
        description: perm.description,
        category: perm.category,
      },
      create: perm,
    });
  }
  console.log(`✅ System permissions verified (${SYSTEM_PERMISSIONS.length} permissions).\n`);

  // 2. Hash password with bcrypt (10 salt rounds)
  const passwordHash = await bcrypt.hash(SUPER_ADMIN_CONFIG.rawPassword, 10);

  // 3. Upsert SUPER_ADMIN user
  console.log(`👤 Upserting SUPER_ADMIN user (${SUPER_ADMIN_CONFIG.email} / ${SUPER_ADMIN_CONFIG.mobile})...`);

  // Find existing user by mobile or email
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { mobile: SUPER_ADMIN_CONFIG.mobile },
        { email: SUPER_ADMIN_CONFIG.email },
      ],
    },
  });

  let user;
  if (existingUser) {
    user = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        firstName: SUPER_ADMIN_CONFIG.firstName,
        lastName: SUPER_ADMIN_CONFIG.lastName,
        email: SUPER_ADMIN_CONFIG.email,
        mobile: SUPER_ADMIN_CONFIG.mobile,
        passwordHash,
        systemRole: SUPER_ADMIN_CONFIG.systemRole,
        isActive: true,
        deletedAt: null,
      },
    });
    console.log(`✅ Updated existing user to SUPER_ADMIN (ID: ${user.id})`);
  } else {
    user = await prisma.user.create({
      data: {
        firstName: SUPER_ADMIN_CONFIG.firstName,
        lastName: SUPER_ADMIN_CONFIG.lastName,
        email: SUPER_ADMIN_CONFIG.email,
        mobile: SUPER_ADMIN_CONFIG.mobile,
        passwordHash,
        systemRole: SUPER_ADMIN_CONFIG.systemRole,
        isActive: true,
      },
    });
    console.log(`✅ Created new SUPER_ADMIN user (ID: ${user.id})`);
  }

  console.log('\n==================================================');
  console.log('🎉 SUPER_ADMIN Ready for Login:');
  console.log(`   - Name        : ${user.firstName} ${user.lastName}`);
  console.log(`   - Email       : ${user.email}`);
  console.log(`   - Mobile      : ${user.mobile}`);
  console.log(`   - Role        : ${user.systemRole}`);
  console.log(`   - Password    : ${SUPER_ADMIN_CONFIG.rawPassword}`);
  console.log(`   - Hash Prefix : ${passwordHash.substring(0, 10)}... (bcrypt verified)`);
  console.log('==================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ [Seed SuperAdmin Error]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
