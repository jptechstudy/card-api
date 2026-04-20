import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import type { StringValue } from 'ms';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async signIn(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || user.password !== password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email };
    const expiresIn = (process.env.JWT_EXPIRES_IN ?? '1d') as StringValue;
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      expiresIn,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        mobile: user.mobile,
        avatar: user.avatar,
        coverImage: user.coverImage,
        isActive: user.isActive,
        userRoles: user.userRoles.map((userRole) => ({
          roleId: userRole.roleId,
          isActive: userRole.isActive,
          role: {
            id: userRole.role.id,
            name: userRole.role.name,
            description: userRole.role.description,
            isActive: userRole.role.isActive,
          },
        })),
      },
    };
  }
}
