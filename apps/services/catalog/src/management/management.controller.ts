import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { CATALOG_DATABASE } from '@/drizzle/database.constants';
import type { CatalogDatabase } from '@/drizzle/database.module';

/**
 * Private management HTTP endpoints. `/live` proves the process is up; `/ready`
 * verifies the dependency required to serve traffic (the Catalog database).
 */
@Controller()
export class ManagementController {
  constructor(
    @Inject(CATALOG_DATABASE) private readonly database: CatalogDatabase,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok', service: 'catalog' };
  }

  @Get('ready')
  async ready() {
    try {
      await this.database.execute(sql`select 1`);
      return { status: 'ready', service: 'catalog' };
    } catch {
      throw new ServiceUnavailableException('Catalog database is unavailable.');
    }
  }
}
