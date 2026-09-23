export class CreateCustomerDto {
  firstName!: string;
  lastName!: string;
  mobile!: string;
  email?: string;
  password?: string;
  address?: string;
  customerCode?: string;
  initialDeposit?: number;
  creditLimit?: number;
  notes?: string;
}
