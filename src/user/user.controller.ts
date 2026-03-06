import { Controller, Get } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private user: UserService) {}

  @Get()
  getAllUsers() {
    return this.user.findAll();
  }
}
