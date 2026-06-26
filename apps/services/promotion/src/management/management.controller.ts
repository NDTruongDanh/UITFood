import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { PROMOTION_DATABASE } from '@/drizzle/database.constants';
import type { PromotionDatabase } from '@/drizzle/database.module';

/**
 * Private management HTTP endpoints. `/live` proves the process is up; `/ready`
 * verifies the dependency required to serve traffic (the Promotion database).
 */
@Controller()
export class ManagementController {
  constructor(
    @Inject(PROMOTION_DATABASE) private readonly database: PromotionDatabase,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok', service: 'promotion' };
  }

  @Get('ready')
  async ready() {
    try {
      await this.database.execute(sql`select 1`);
      return { status: 'ready', service: 'promotion' };
    } catch {
      throw new ServiceUnavailableException(
        'Promotion database is unavailable.',
      );
    }
  }
}
