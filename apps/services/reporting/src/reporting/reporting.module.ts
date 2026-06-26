import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/drizzle/database.module';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminAnalyticsRepository } from './admin-analytics.repository';

/**
 * Reporting read side — the analytics service + repository that query the
 * event-fed projection tables. The write side (projection consumers) lives in
 * ConsumersModule.
 */
@Module({
  imports: [DatabaseModule],
  providers: [AdminAnalyticsService, AdminAnalyticsRepository],
  exports: [AdminAnalyticsService],
})
export class ReportingModule {}
