import { AdminAnalyticsRepository } from './admin-analytics.repository';
import { AdminAnalyticsService } from './admin-analytics.service';

const analyticsData = {
  totalRevenue: 600,
  orderCount: 10,
  deliveredCount: 6,
  cancelledCount: 2,
  avgPrepMinutes: 12,
  revenueByDay: [],
  ordersByDay: [],
  topItems: [],
};

describe('AdminAnalyticsService', () => {
  const getRestaurantAnalyticsData = jest.fn();
  const repository = {
    getRestaurantAnalyticsData,
  } as unknown as AdminAnalyticsRepository;
  const service = new AdminAnalyticsService(repository);

  beforeEach(() => {
    getRestaurantAnalyticsData.mockReset();
  });

  it('calculates success rate from terminal orders only', async () => {
    getRestaurantAnalyticsData.mockResolvedValue(analyticsData);

    const result = await service.getRestaurantAnalytics(
      '11111111-1111-4111-8111-111111111111',
      '30d',
    );

    expect(result.range).toBe('30d');
    expect(result.avgOrderValue).toBe(100);
    expect(result.successRate).toBe(75);
    expect(result.cancelRate).toBe(20);
  });

  it('returns a null success rate until an order reaches a terminal state', async () => {
    getRestaurantAnalyticsData.mockResolvedValue({
      ...analyticsData,
      totalRevenue: 0,
      orderCount: 3,
      deliveredCount: 0,
      cancelledCount: 0,
    });

    const result = await service.getRestaurantAnalytics(
      '11111111-1111-4111-8111-111111111111',
      'today',
    );

    expect(result.successRate).toBeNull();
    expect(result.avgOrderValue).toBe(0);
  });
});
