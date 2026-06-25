import { Module } from '@nestjs/common';
import { ZonesService } from './zones.service';
import { ZonesRepository } from './zones.repository';
import { DatabaseModule } from '@/drizzle/database.module';
import { OutboxModule } from '@/messaging/outbox/outbox.module';
import { GeoModule } from '@/lib/geo/geo.module';
import { AuthModule } from '@/auth/auth.module';
import { RestaurantModule } from '../restaurant.module';
import { ZonesRpcController } from '@/rpc/zones-rpc.controller';

@Module({
  imports: [
    DatabaseModule,
    OutboxModule,
    RestaurantModule,
    GeoModule,
    AuthModule,
  ],
  controllers: [ZonesRpcController],
  providers: [ZonesService, ZonesRepository],
})
export class ZonesModule {}
