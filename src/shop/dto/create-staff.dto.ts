export class CreateStaffDto {
  firstName!: string;
  lastName!: string;
  mobile!: string;
  email?: string;
  password?: string;
  roleName?: string;
  accessLevel?: 'standard' | 'manager';
  permissions?: string[];
}
