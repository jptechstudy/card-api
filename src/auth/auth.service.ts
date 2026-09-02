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
    });

    if (!user || user.passwordHash !== password) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid credentials',
      });
    }

    const payload = { sub: user.id, email: user.email };
    const expiresIn = (process.env.JWT_EXPIRES_IN ?? '1d') as StringValue;
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      expiresIn,
    });

    return {
      statusCode: 200,
      data: {
        accessToken,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          mobile: user.mobile,
          avatarUrl: user.avatarUrl,
          systemRole: user.systemRole,
          isActive: user.isActive,
        },
      },
    };
  }
}
