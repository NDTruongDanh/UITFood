import {
  Controller,
  DefaultValuePipe,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { hasRole } from '@/shared/security/role.util';
import { AdminReviewListResponseDto } from '../dto/review.dto';
import { ReviewRepository } from '../repositories/review.repository';

@ApiTags('Admin Reviews')
@ApiBearerAuth()
@Controller('admin/restaurants')
export class AdminReviewController {
  constructor(private readonly reviewRepo: ReviewRepository) {}

  @Get(':restaurantId/reviews')
  @ApiOperation({
    summary: 'List all reviews for a restaurant (admin, paginated)',
    description:
      'Includes flagged and hidden reviews along with moderation data.',
  })
  @ApiOkResponse({
    description: 'Paginated reviews with stats',
    type: AdminReviewListResponseDto,
  })
  @ApiForbiddenResponse({ description: 'Admin role required.' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated.' })
  @ApiParam({ name: 'restaurantId', format: 'uuid' })
  async getRestaurantReviews(
    @Session() session: UserSession,
    @Param('restaurantId', ParseUUIDPipe) restaurantId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<AdminReviewListResponseDto> {
    if (!hasRole(session.user.role, 'admin')) {
      throw new ForbiddenException('Admin role required.');
    }

    const safePage = page < 1 ? 1 : page;
    const safeLimit = limit < 1 ? 1 : Math.min(limit, 50);

    const result = await this.reviewRepo.findAdminByRestaurantId(
      restaurantId,
      safePage,
      safeLimit,
    );

    return {
      data: result.data.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        customerId: r.customerId,
        restaurantId: r.restaurantId,
        stars: r.stars,
        comment: r.comment,
        tags: r.tags,
        moderationStatus: r.moderationStatus,
        moderationReason: r.moderationReason,
        createdAt: r.createdAt.toISOString(),
      })),
      total: result.total,
      averageRating: result.averageRating,
      ratingDistribution: result.ratingDistribution,
    };
  }
}
