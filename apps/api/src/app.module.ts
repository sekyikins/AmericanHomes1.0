import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import {
  AuthRateLimitMiddleware,
  SecurityHeadersMiddleware,
} from './common/middleware/security.middleware';
import { appConfig } from './config/app.config';
import { authConfig } from './config/auth.config';
import { databaseConfig } from './config/database.config';
import { integrationsConfig } from './config/integrations.config';
import { storageConfig } from './config/storage.config';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './health/health.module';
import { JobsModule } from './jobs/jobs.module';
import { AllocationsModule } from './modules/allocations/allocations.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthenticationModule } from './modules/authentication/authentication.module';
import { CatalogueModule } from './modules/catalogue/catalogue.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { CustomersModule } from './modules/customers/customers.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { GovernanceModule } from './modules/governance/governance.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { ProductRequestsModule } from './modules/product-requests/product-requests.module';
import { ReceivingModule } from './modules/receiving/receiving.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { ReturnsModule } from './modules/returns/returns.module';
import { ShipmentsModule } from './modules/shipments/shipments.module';
import { SourcingModule } from './modules/sourcing/sourcing.module';
import { StaffModule } from './modules/staff/staff.module';
import { StocktakesModule } from './modules/stocktakes/stocktakes.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig, databaseConfig, storageConfig, integrationsConfig],
    }),
    PrismaModule,
    HealthModule,
    AuthenticationModule,
    UsersModule,
    StaffModule,
    PermissionsModule,
    CustomersModule,
    CatalogueModule,
    ShipmentsModule,
    ReceivingModule,
    InventoryModule,
    StocktakesModule,
    ProductRequestsModule,
    SourcingModule,
    AllocationsModule,
    ReservationsModule,
    OrdersModule,
    PaymentsModule,
    CollectionsModule,
    ReturnsModule,
    ExpensesModule,
    GovernanceModule,
    ReportsModule,
    NotificationsModule,
    AuditModule,
    DashboardModule,
    JobsModule,
  ],
  controllers: [AppController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, SecurityHeadersMiddleware).forRoutes('*');
    consumer.apply(AuthRateLimitMiddleware).forRoutes('auth/(.*)');
  }
}
