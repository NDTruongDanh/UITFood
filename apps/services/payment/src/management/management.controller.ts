import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { PAYMENT_DATABASE } from '@/drizzle/database.constants';
import type { PaymentDatabase } from '@/drizzle/database.module';

/**
 * Private management HTTP endpoints. `/live` proves the process is up; `/ready`
 * verifies the dependency required to serve traffic (the Payment database).
 */
@Controller()
export class ManagementController {
  constructor(
    @Inject(PAYMENT_DATABASE) private readonly database: PaymentDatabase,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok', service: 'payment' };
  }

  @Get('ready')
  async ready() {
    try {
      await this.database.execute(sql`select 1`);
      return { status: 'ready', service: 'payment' };
    } catch {
      throw new ServiceUnavailableException('Payment database is unavailable.');
    }
  }
}
