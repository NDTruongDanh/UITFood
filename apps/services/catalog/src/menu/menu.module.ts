import { Module } from '@nestjs/common';
import { MenuService } from './menu.service';
import { MenuRepository } from './menu.repository';
import { DatabaseModule } from '@/drizzle/database.module';
import { OutboxModule } from '@/messaging/outbox/outbox.module';
import { RestaurantModule } from '@/restaurant/restaurant.module';
import { MediaClientModule } from '@/integration/media/media-client.module';
import { AiSearchIndexModule } from '@/search/indexing/ai-search-index.module';
import { AuthModule } from '@/auth/auth.module';
import { MenuRpcController } from '@/rpc/menu-rpc.controller';

/**
 * MenuModule — owns menu_items, menu_categories.
 * ModifiersModule is imported at the catalog root level to avoid the circular
 * dependency (ModifiersModule imports MenuModule for MenuRepository/MenuService).
 */
@Module({
  imports: [
    DatabaseModule,
    OutboxModule,
    RestaurantModule,
    MediaClientModule,
    AiSearchIndexModule,
    AuthModule,
  ],
  controllers: [MenuRpcController],
  providers: [MenuService, MenuRepository],
  exports: [MenuService, MenuRepository],
})
export class MenuModule {}
