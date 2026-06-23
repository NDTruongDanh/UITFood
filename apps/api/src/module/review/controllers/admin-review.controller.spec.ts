jest.mock('@thallesp/nestjs-better-auth', () => ({
  Session: () => () => undefined,
}));

import { ForbiddenException } from '@nestjs/common';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import type { ReviewRepository } from '../repositories/review.repository';
import { AdminReviewController } from './admin-review.controller';

describe('AdminReviewController', () => {
  const findAdminByRestaurantId = jest.fn();
  const repository = {
    findAdminByRestaurantId,
  } as unknown as ReviewRepository;
  const controller = new AdminReviewController(repository);
  const adminSession = {
    user: { id: 'admin-1', role: 'admin' },
  } as UserSession;

  beforeEach(() => {
    findAdminByRestaurantId.mockReset();
  });

  it('clamps pagination and maps review dates', async () => {
    findAdminByRestaurantId.mockResolvedValue({
      data: [
        {
          id: 'review-1',
          orderId: 'order-1',
          customerId: 'customer-1',
          restaurantId: 'restaurant-1',
          stars: 4,
          comment: 'Good',
          tags: null,
          moderationStatus: 'visible',
          moderationReason: null,
          createdAt: new Date('2026-06-23T00:00:00.000Z'),
        },
      ],
      total: 1,
      averageRating: 4,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 0 },
    });

    const result = await controller.getRestaurantReviews(
      adminSession,
      '11111111-1111-4111-8111-111111111111',
      0,
      100,
    );

    expect(findAdminByRestaurantId).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      1,
      50,
    );
    expect(result.data[0]?.createdAt).toBe('2026-06-23T00:00:00.000Z');
  });

  it('rejects non-admin callers', async () => {
    const userSession = {
      user: { id: 'user-1', role: 'user' },
    } as UserSession;

    await expect(
      controller.getRestaurantReviews(
        userSession,
        '11111111-1111-4111-8111-111111111111',
        1,
        20,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
