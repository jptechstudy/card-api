import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionCode, ProductUnit } from '@prisma/client';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffPermissionsDto } from './dto/update-staff-permissions.dto';
import { hashPassword } from 'src/common/utils/password.util';

@Injectable()
export class ShopService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserShops(userId: string) {
    const memberships = await this.prisma.shopUser.findMany({
      where: {
        userId,
        deletedAt: null,
        isActive: true,
        shop: { deletedAt: null, isActive: true },
      },
      include: {
        shop: true,
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = memberships.map(m => this.formatShopMembership(m));

    return {
      statusCode: 200,
      success: true,
      data,
    };
  }

  async createShop(userId: string, dto: CreateShopDto) {
    if (!dto.name?.trim()) {
      throw new BadRequestException('Shop name is required');
    }

    if (dto.code?.trim()) {
      const existing = await this.prisma.shop.findUnique({
        where: { code: dto.code.trim() },
      });
      if (existing) {
        throw new BadRequestException(`Shop code '${dto.code}' is already in use`);
      }
    }

    const shop = await this.prisma.$transaction(async tx => {
      const createdShop = await tx.shop.create({
        data: {
          name: dto.name.trim(),
          code: dto.code?.trim() || null,
          phone: dto.phone?.trim() || null,
          address: dto.address?.trim() || null,
          city: dto.city?.trim() || null,
          state: dto.state?.trim() || null,
          pincode: dto.pincode?.trim() || null,
          logoUrl: dto.logoUrl?.trim() || null,
          createdById: userId,
        },
      });

      await tx.shopUser.create({
        data: {
          shopId: createdShop.id,
          userId,
          userType: 'OWNER',
          createdById: userId,
        },
      });

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (user && user.systemRole === 'CUSTOMER') {
        await tx.user.update({
          where: { id: userId },
          data: { systemRole: 'SHOP_OWNER' },
        });
      }

      return createdShop;
    });

    return {
      statusCode: 201,
      success: true,
      message: 'Shop created successfully',
      data: {
        id: shop.id,
        name: shop.name,
        code: shop.code ?? '',
        phone: shop.phone ?? '',
        address: shop.address ?? '',
        city: shop.city ?? '',
        state: shop.state ?? '',
        pincode: shop.pincode ?? '',
        logoUrl: shop.logoUrl ?? null,
        ownerId: userId,
        userType: 'SHOP_OWNER',
        roles: ['Owner'],
        permissions: [],
        isActive: shop.isActive,
        createdAt: shop.createdAt.toISOString(),
      },
    };
  }

  async getShopById(userId: string, shopId: string) {
    const membership = await this.prisma.shopUser.findFirst({
      where: {
        shopId,
        userId,
        deletedAt: null,
        isActive: true,
        shop: { deletedAt: null },
      },
      include: {
        shop: {
          include: {
            _count: {
              select: {
                customerProfiles: true,
                products: true,
                memberships: true,
              },
            },
          },
        },
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Shop not found or access denied',
      });
    }

    const formatted = this.formatShopMembership(membership);

    return {
      statusCode: 200,
      success: true,
      data: {
        ...formatted,
        counts: {
          customers: membership.shop._count.customerProfiles,
          products: membership.shop._count.products,
          staff: membership.shop._count.memberships,
        },
      },
    };
  }

  async updateShop(userId: string, shopId: string, dto: UpdateShopDto) {
    await this.assertStaffManager(userId, shopId, 'SETTINGS_MANAGE');

    const updated = await this.prisma.shop.update({
      where: { id: shopId },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        code: dto.code !== undefined ? dto.code.trim() : undefined,
        phone: dto.phone !== undefined ? dto.phone.trim() : undefined,
        address: dto.address !== undefined ? dto.address.trim() : undefined,
        city: dto.city !== undefined ? dto.city.trim() : undefined,
        state: dto.state !== undefined ? dto.state.trim() : undefined,
        pincode: dto.pincode !== undefined ? dto.pincode.trim() : undefined,
        logoUrl: dto.logoUrl !== undefined ? dto.logoUrl.trim() : undefined,
        isActive: dto.isActive !== undefined ? dto.isActive : undefined,
        updatedById: userId,
      },
    });

    return {
      statusCode: 200,
      success: true,
      message: 'Shop updated successfully',
      data: updated,
    };
  }

  async setDefaultShop(userId: string, shopId: string) {
    const membership = await this.prisma.shopUser.findFirst({
      where: {
        shopId,
        userId,
        deletedAt: null,
        isActive: true,
      },
      include: { shop: true },
    });

    if (!membership) {
      throw new NotFoundException('Shop membership not found');
    }

    return {
      statusCode: 200,
      success: true,
      message: 'Default shop set successfully',
      data: {
        shopId,
        name: membership.shop.name,
      },
    };
  }

  // ==========================================
  // STAFF & RBAC METHODS
  // ==========================================

  async getShopStaff(userId: string, shopId: string) {
    await this.assertShopAccess(userId, shopId);

    const staffMembers = await this.prisma.shopUser.findMany({
      where: {
        shopId,
        userType: 'SHOPKEEPER',
        deletedAt: null,
      },
      include: {
        user: true,
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = staffMembers.map(su => this.formatStaff(su));

    return {
      statusCode: 200,
      success: true,
      data,
    };
  }

  async createStaff(userId: string, shopId: string, dto: CreateStaffDto) {
    await this.assertStaffManager(userId, shopId, 'SHOPKEEPER_MANAGE');

    if (!dto.firstName?.trim() || !dto.lastName?.trim() || !dto.mobile?.trim()) {
      throw new BadRequestException('First name, last name, and mobile number are required');
    }

    const cleanMobile = dto.mobile.replace(/[^0-9]/g, '');
    if (cleanMobile.length < 10) {
      throw new BadRequestException('Please provide a valid 10-digit mobile number');
    }

    const result = await this.prisma.$transaction(async tx => {
      let targetUser = await tx.user.findFirst({
        where: {
          OR: [
            { mobile: cleanMobile },
            ...(dto.email?.trim() ? [{ email: dto.email.trim() }] : []),
          ],
          deletedAt: null,
        },
      });

      if (!targetUser) {
        targetUser = await tx.user.create({
          data: {
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            mobile: cleanMobile,
            email: dto.email?.trim() || null,
            passwordHash: await hashPassword(dto.password || 'password123'),
            systemRole: 'SHOPKEEPER',
            createdById: userId,
          },
        });
      }

      const existingMember = await tx.shopUser.findFirst({
        where: {
          shopId,
          userId: targetUser.id,
          deletedAt: null,
        },
      });

      if (existingMember) {
        throw new BadRequestException('User is already assigned to this shop');
      }

      const shopUser = await tx.shopUser.create({
        data: {
          shopId,
          userId: targetUser.id,
          userType: 'SHOPKEEPER',
          createdById: userId,
        },
      });

      // Role assignment
      const isManager = dto.accessLevel === 'manager' || dto.roleName === 'Senior Manager';
      const roleName = isManager ? 'Senior Manager' : 'Entry Operator';

      let role = await tx.role.findFirst({
        where: {
          shopId,
          name: roleName,
          deletedAt: null,
        },
      });

      if (!role) {
        role = await tx.role.create({
          data: {
            shopId,
            name: roleName,
            description: isManager ? 'Full managerial access' : 'Daily entries access only',
          },
        });

        // Seed default permissions for this role
        const defaultPermCodes: PermissionCode[] = isManager
          ? Object.values(PermissionCode)
          : [
              PermissionCode.DAILY_ENTRY_CREATE,
              PermissionCode.DAILY_ENTRY_READ,
              PermissionCode.DAILY_ENTRY_UPDATE,
            ];

        const perms = await tx.permission.findMany({
          where: { code: { in: defaultPermCodes } },
        });

        for (const p of perms) {
          await tx.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId: p.id,
            },
          });
        }
      }

      await tx.shopUserRole.create({
        data: {
          shopUserId: shopUser.id,
          roleId: role.id,
        },
      });

      // Explicit permission overrides if passed
      if (dto.permissions && dto.permissions.length > 0) {
        const explicitPerms = await tx.permission.findMany({
          where: { code: { in: dto.permissions as PermissionCode[] } },
        });
        for (const ep of explicitPerms) {
          await tx.shopUserPermission.create({
            data: {
              shopUserId: shopUser.id,
              permissionId: ep.id,
              isGranted: true,
            },
          });
        }
      }

      return tx.shopUser.findUnique({
        where: { id: shopUser.id },
        include: {
          user: true,
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });
    });

    return {
      statusCode: 201,
      success: true,
      message: 'Shopkeeper created successfully',
      data: this.formatStaff(result),
    };
  }

  async getStaffDetail(userId: string, shopId: string, staffId: string) {
    await this.assertShopAccess(userId, shopId);

    const su = await this.prisma.shopUser.findFirst({
      where: {
        id: staffId,
        shopId,
        deletedAt: null,
      },
      include: {
        user: true,
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!su) {
      throw new NotFoundException('Staff member not found');
    }

    const allPermissions = await this.prisma.permission.findMany({
      orderBy: { code: 'asc' },
    });

    return {
      statusCode: 200,
      success: true,
      data: {
        ...this.formatStaff(su),
        availablePermissions: allPermissions.map(p => ({
          code: p.code,
          name: p.name,
          description: p.description,
          category: p.category,
        })),
      },
    };
  }

  async updateStaffPermissions(
    userId: string,
    shopId: string,
    staffId: string,
    dto: UpdateStaffPermissionsDto,
  ) {
    await this.assertStaffManager(userId, shopId, 'SHOPKEEPER_MANAGE');

    const su = await this.prisma.shopUser.findFirst({
      where: { id: staffId, shopId, deletedAt: null },
    });

    if (!su) {
      throw new NotFoundException('Staff member not found');
    }

    await this.prisma.$transaction(async tx => {
      if (dto.isActive !== undefined) {
        await tx.shopUser.update({
          where: { id: staffId },
          data: { isActive: dto.isActive },
        });
      }

      if (dto.roleName) {
        let role = await tx.role.findFirst({
          where: { shopId, name: dto.roleName, deletedAt: null },
        });
        if (!role) {
          const isManager = dto.roleName === 'Senior Manager';
          role = await tx.role.create({
            data: {
              shopId,
              name: dto.roleName,
              description: isManager ? 'Full managerial access' : 'Daily entries access only',
            },
          });
          const defaultPermCodes: PermissionCode[] = isManager
            ? Object.values(PermissionCode)
            : [
                PermissionCode.DAILY_ENTRY_CREATE,
                PermissionCode.DAILY_ENTRY_READ,
                PermissionCode.DAILY_ENTRY_UPDATE,
              ];
          const perms = await tx.permission.findMany({
            where: { code: { in: defaultPermCodes } },
          });
          for (const p of perms) {
            await tx.rolePermission.create({
              data: { roleId: role.id, permissionId: p.id },
            });
          }
        }

        await tx.shopUserRole.deleteMany({ where: { shopUserId: staffId } });
        await tx.shopUserRole.create({
          data: { shopUserId: staffId, roleId: role.id },
        });
      }

      if (dto.permissions !== undefined) {
        await tx.shopUserPermission.deleteMany({ where: { shopUserId: staffId } });

        const permissions = await tx.permission.findMany({
          where: { code: { in: dto.permissions as PermissionCode[] } },
        });

        for (const p of permissions) {
          await tx.shopUserPermission.create({
            data: {
              shopUserId: staffId,
              permissionId: p.id,
              isGranted: true,
            },
          });
        }
      }
    });

    return this.getStaffDetail(userId, shopId, staffId);
  }

  async deleteStaff(userId: string, shopId: string, staffId: string) {
    await this.assertStaffManager(userId, shopId, 'SHOPKEEPER_MANAGE');

    const su = await this.prisma.shopUser.findFirst({
      where: { id: staffId, shopId, deletedAt: null },
    });

    if (!su) {
      throw new NotFoundException('Staff member not found');
    }

    await this.prisma.shopUser.update({
      where: { id: staffId },
      data: { deletedAt: new Date(), isActive: false },
    });

    return {
      statusCode: 200,
      success: true,
      message: 'Staff member removed successfully',
    };
  }

  async getShopRoles(userId: string, shopId: string) {
    await this.assertShopAccess(userId, shopId);

    const [roles, permissions] = await Promise.all([
      this.prisma.role.findMany({
        where: {
          OR: [{ shopId }, { shopId: null }],
          deletedAt: null,
        },
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      }),
      this.prisma.permission.findMany({
        orderBy: { code: 'asc' },
      }),
    ]);

    return {
      statusCode: 200,
      success: true,
      data: {
        roles: roles.map(r => ({
          id: r.id,
          name: r.name,
          description: r.description,
          permissions: r.permissions.map(p => p.permission.code),
        })),
        permissions: permissions.map(p => ({
          code: p.code,
          name: p.name,
          description: p.description,
          category: p.category,
        })),
      },
    };
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private async assertShopAccess(userId: string, shopId: string) {
    const membership = await this.prisma.shopUser.findFirst({
      where: { shopId, userId, deletedAt: null, isActive: true },
    });
    if (!membership) {
      throw new ForbiddenException('Access denied to this shop');
    }
    return membership;
  }

  private async assertStaffManager(userId: string, shopId: string, permission: PermissionCode) {
    const membership = await this.prisma.shopUser.findFirst({
      where: { shopId, userId, deletedAt: null, isActive: true },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
        permissions: {
          include: { permission: true },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('Access denied to this shop');
    }

    if (membership.userType === 'OWNER') {
      return membership;
    }

    const hasRolePerm = membership.roles.some(r =>
      r.role.permissions.some(p => p.permission.code === permission),
    );
    const hasExplicitPerm = membership.permissions.some(
      p => p.isGranted && p.permission.code === permission,
    );

    if (!hasRolePerm && !hasExplicitPerm) {
      throw new ForbiddenException(`Missing required permission: ${permission}`);
    }

    return membership;
  }

  private formatStaff(su: any) {
    const rolePermissions =
      su.roles?.flatMap((r: any) =>
        r.role?.permissions?.map((p: any) => p.permission?.code) ?? [],
      ) ?? [];

    const explicitPermissions =
      su.permissions
        ?.filter((p: any) => p.isGranted)
        ?.map((p: any) => p.permission?.code) ?? [];

    const permissions = Array.from(new Set([...rolePermissions, ...explicitPermissions]));
    const roles = su.roles?.map((r: any) => r.role?.name) ?? [];
    const isManager = roles.some((r: string) => r.toLowerCase().includes('manager'));

    return {
      id: su.id,
      userId: su.user?.id,
      firstName: su.user?.firstName ?? '',
      lastName: su.user?.lastName ?? '',
      name: `${su.user?.firstName ?? ''} ${su.user?.lastName ?? ''}`.trim(),
      email: su.user?.email ?? '',
      mobile: su.user?.mobile ?? '',
      avatarUrl: su.user?.avatarUrl ?? undefined,
      status: su.isActive ? ('Active' as const) : ('Inactive' as const),
      accessLevel: isManager ? ('manager' as const) : ('standard' as const),
      roles,
      permissions,
      createdAt: su.createdAt?.toISOString?.() ?? new Date().toISOString(),
    };
  }

  private formatShopMembership(membership: any) {
    const rolePermissions =
      membership.roles?.flatMap((r: any) =>
        r.role?.permissions?.map((p: any) => p.permission?.code) ?? [],
      ) ?? [];

    const explicitPermissions =
      membership.permissions
        ?.filter((p: any) => p.isGranted)
        ?.map((p: any) => p.permission?.code) ?? [];

    const permissions = Array.from(new Set([...rolePermissions, ...explicitPermissions]));

    return {
      id: membership.shop.id,
      name: membership.shop.name,
      code: membership.shop.code ?? '',
      phone: membership.shop.phone ?? '',
      address: membership.shop.address ?? '',
      city: membership.shop.city ?? '',
      state: membership.shop.state ?? '',
      pincode: membership.shop.pincode ?? '',
      logoUrl: membership.shop.logoUrl ?? null,
      ownerId: membership.shop.createdById ?? '',
      userType:
        membership.userType === 'OWNER'
          ? 'SHOP_OWNER'
          : membership.userType === 'SHOPKEEPER'
          ? 'SHOP_KEEPER'
          : 'CUSTOMER',
      roles: membership.roles?.map((r: any) => r.role?.name) ?? [],
      permissions,
      isActive: membership.shop.isActive,
      createdAt: membership.shop.createdAt?.toISOString?.() ?? new Date().toISOString(),
    };
  }
}
