import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { ERPNextModule } from './erpnext/erpnext.module';
import { AuthModule } from './auth/auth.module';
import { RfqModule } from './rfq/rfq.module';
import { QuotationsModule } from './quotations/quotations.module';
import { PurchaseOrdersModule } from './purchase-orders/purchase-orders.module';
import { InvoicesModule } from './invoices/invoices.module';
import { StatementsModule } from './statements/statements.module';
import { DeveloperModule } from './developer/developer.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ERPNextModule,
    AuthModule,
    RfqModule,
    QuotationsModule,
    PurchaseOrdersModule,
    InvoicesModule,
    StatementsModule,
    DeveloperModule,
    NotificationsModule,
  ],
})
export class AppModule {}
