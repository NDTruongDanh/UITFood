import { Module } from '@nestjs/common';
import { ModifiersService } from './modifiers.service';
import {
  ModifierGroupRepository,
  ModifierOptionRepository,
} from './modifiers.repository';
import { DatabaseModule } from '@/drizzle/database.module';
import { MenuModule } from '../menu.module';
import { RestaurantModule } from '@/restaurant/restaurant.module';
import { AuthModule } from '@/auth/auth.module';
import { ModifiersRpcController } from '@/rpc/modifiers-rpc.controller';

/**
 * ModifiersModule — owns modifier_groups + modifier_options tables.
 * Imports MenuModule (for MenuRepository + MenuService) without a cycle because
 * MenuModule does not import ModifiersModule.
 */
@Module({
  imports: [DatabaseModule, MenuModule, RestaurantModule, AuthModule],
  controllers: [ModifiersRpcController],
  providers: [
    ModifiersService,
    ModifierGroupRepository,
    ModifierOptionRepository,
  ],
})
export class ModifiersModule {}
