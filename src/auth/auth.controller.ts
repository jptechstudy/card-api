import { Body, Controller, Get, Post, UnauthorizedException } from '@nestjs/common';
import { Public } from './public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CurrentUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() body: LoginDto) {
    const identifier = body.emailOrMobile || body.email || body.mobile;
    if (!identifier) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Email or Mobile is required for login',
      });
    }
    return this.authService.signIn(identifier, body.password);
  }

  @Get('me')
  getProfile(@CurrentUser('sub') userId: string) {
    return this.authService.getProfile(userId);
  }

  @Public()
  @Post('refresh-token')
  refreshToken(@Body() body: { refreshToken: string }) {
    if (!body?.refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }
    return this.authService.refreshToken(body.refreshToken);
  }

  @Post('logout')
  logout() {
    return this.authService.logout();
  }
}
