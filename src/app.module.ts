import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { ShopModule } from './shop/shop.module';
import { ProductModule } from './product/product.module';
import { CustomerModule } from './customer/customer.module';
import { DailyEntryModule } from './daily-entry/daily-entry.module';
import { CardModule } from './card/card.module';
import { BillingModule } from './billing/billing.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { CustomerPortalModule } from './customer-portal/customer-portal.module';
import { SuperAdminModule } from './super-admin/super-admin.module';

@Module({
  imports: [
    PrismaModule,
    UserModule,
    AuthModule,
    ShopModule,
    ProductModule,
    CustomerModule,
    DailyEntryModule,
    CardModule,
    BillingModule,
    AnalyticsModule,
    AuditLogModule,
    CustomerPortalModule,
    SuperAdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
