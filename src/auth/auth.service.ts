import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import type { StringValue } from 'ms';
import { JwtPayload } from './auth.guard';
import { comparePassword } from 'src/common/utils/password.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async signIn(identifier: string, password: string) {
    if (!identifier || !password) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Identifier (email or mobile) and password are required',
      });
    }

    const trimmedIdentifier = identifier.trim();

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: trimmedIdentifier },
          { mobile: trimmedIdentifier },
        ],
        deletedAt: null,
      },
      include: {
        shopMemberships: {
          where: {
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
        },
      },
    });

    const isPasswordValid = user ? await comparePassword(password, user.passwordHash) : false;
    if (!user || !isPasswordValid) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid email/mobile or password',
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        statusCode: 403,
        message: 'Your account is deactivated. Please contact support.',
      });
    }

    return this.buildAuthResponse(user);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      include: {
        shopMemberships: {
          where: {
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
        },
      },
    });

    if (!user) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'User profile not found',
      });
    }

    const formattedData = await this.formatUserData(user);
    return {
      statusCode: 200,
      success: true,
      data: formattedData,
    };
  }

  async refreshToken(refreshTokenStr: string) {
    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; type?: string }>(refreshTokenStr, {
        secret:
          process.env.REFRESH_TOKEN_SECRET ??
          process.env.JWT_REFRESH_SECRET ??
          process.env.JWT_SECRET ??
          'dev-secret-change-me',
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub, deletedAt: null },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User is inactive or not found');
      }

      const newPayload: JwtPayload = {
        sub: user.id,
        email: user.email ?? undefined,
        mobile: user.mobile,
        systemRole: user.systemRole,
      };

      const expiresIn = (process.env.JWT_EXPIRES_IN ?? '1d') as StringValue;
      const accessToken = await this.jwtService.signAsync(newPayload, {
        secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
        expiresIn,
      });

      return {
        statusCode: 200,
        success: true,
        data: { accessToken },
      };
    } catch {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid or expired refresh token',
      });
    }
  }

  logout() {
    return {
      statusCode: 200,
      success: true,
      message: 'Logged out successfully',
      data: null,
    };
  }

  private async buildAuthResponse(user: any) {
    const formatted = await this.formatUserData(user);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email ?? undefined,
      mobile: user.mobile,
      systemRole: user.systemRole,
    };

    const expiresIn = (process.env.JWT_EXPIRES_IN ?? '1d') as StringValue;
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      expiresIn,
    });

    const refreshExpiresIn = (process.env.REFRESH_TOKEN_EXPIRY ??
      process.env.JWT_REFRESH_EXPIRES_IN ??
      '7d') as StringValue;
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, type: 'refresh' },
      {
        secret:
          process.env.REFRESH_TOKEN_SECRET ??
          process.env.JWT_REFRESH_SECRET ??
          process.env.JWT_SECRET ??
          'dev-secret-change-me',
        expiresIn: refreshExpiresIn,
      },
    );

    return {
      statusCode: 200,
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        user: formatted.user,
        shops: formatted.shops,
      },
    };
  }

  private async formatUserData(user: any) {
    let userType = 'CUSTOMER';
    if (user.systemRole === 'SUPER_ADMIN') {
      userType = 'SUPER_ADMIN';
    } else if (user.systemRole === 'SHOP_OWNER' || user.shopMemberships?.some((m: any) => m.userType === 'OWNER')) {
      userType = 'SHOP_OWNER';
    } else if (user.systemRole === 'SHOPKEEPER' || user.shopMemberships?.some((m: any) => m.userType === 'SHOPKEEPER')) {
      userType = 'SHOP_KEEPER';
    }

    const shops = (user.shopMemberships ?? []).map((membership: any) => {
      const rolePermissions = membership.roles?.flatMap((r: any) =>
        r.role?.permissions?.map((p: any) => p.permission?.code) ?? []
      ) ?? [];

      const explicitPermissions = membership.permissions
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
        userType: membership.userType === 'OWNER' ? 'SHOP_OWNER' : membership.userType === 'SHOPKEEPER' ? 'SHOP_KEEPER' : 'CUSTOMER',
        roles: membership.roles?.map((r: any) => r.role?.name) ?? [],
        permissions,
      };
    });

    return {
      user: {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email ?? '',
        mobile: user.mobile,
        userType,
        systemRole: user.systemRole,
        avatarUrl: user.avatarUrl ?? null,
      },
      shops,
    };
  }
}
