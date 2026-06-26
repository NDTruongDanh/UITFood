import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { ReportingModule } from '@/reporting/reporting.module';
import { ReportingRpcController } from './reporting-rpc.controller';

@Module({
  imports: [AuthModule, ReportingModule],
  controllers: [ReportingRpcController],
})
export class RpcModule {}
