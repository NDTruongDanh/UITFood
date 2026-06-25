import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from '@/config/env.schema';
import { DatabaseModule } from '@/drizzle/database.module';
import { ManagementController } from '@/management/management.controller';
import { AuthModule } from '@/auth/auth.module';
import { IdentityRpcController } from '@/rpc/identity-rpc.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    DatabaseModule,
    AuthModule,
  ],
  controllers: [ManagementController, IdentityRpcController],
})
export class AppModule {}
