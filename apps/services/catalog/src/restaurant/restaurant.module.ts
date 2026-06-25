import { Module } from '@nestjs/common';
import { RestaurantService } from './restaurant.service';
import { RestaurantRepository } from './restaurant.repository';
import { DatabaseModule } from '@/drizzle/database.module';
import { OutboxModule } from '@/messaging/outbox/outbox.module';
import { MediaClientModule } from '@/integration/media/media-client.module';
import { AiSearchIndexModule } from '@/search/indexing/ai-search-index.module';
import { IdentityClientModule } from '@/integration/identity/identity-client.module';
import { AuthModule } from '@/auth/auth.module';
import { RESTAURANT_ACCESS_PORT } from '@/shared/ports/restaurant-access.port';
import { RestaurantRpcController } from '@/rpc/restaurant-rpc.controller';

@Module({
  imports: [
    DatabaseModule,
    OutboxModule,
    MediaClientModule,
    AiSearchIndexModule,
    IdentityClientModule,
    AuthModule,
  ],
  controllers: [RestaurantRpcController],
  providers: [
    RestaurantService,
    RestaurantRepository,
    { provide: RESTAURANT_ACCESS_PORT, useExisting: RestaurantService },
  ],
  exports: [RestaurantService, RestaurantRepository, RESTAURANT_ACCESS_PORT],
})
export class RestaurantModule {}
