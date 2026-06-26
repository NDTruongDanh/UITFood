import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { REPORTING_DATABASE } from '@/drizzle/database.constants';
import type { ReportingDatabase } from '@/drizzle/database.module';

/**
 * Private management HTTP endpoints. `/live` proves the process is up; `/ready`
 * verifies the dependency required to serve traffic (the Reporting database).
 */
@Controller()
export class ManagementController {
  constructor(
    @Inject(REPORTING_DATABASE) private readonly database: ReportingDatabase,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok', service: 'reporting' };
  }

  @Get('ready')
  async ready() {
    try {
      await this.database.execute(sql`select 1`);
      return { status: 'ready', service: 'reporting' };
    } catch {
      throw new ServiceUnavailableException(
        'Reporting database is unavailable.',
      );
    }
  }
}
