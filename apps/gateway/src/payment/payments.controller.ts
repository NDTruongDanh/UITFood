import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PAYMENT_RPC_PATTERNS } from '@uitfood/contracts';
import { InternalJwtService } from '@/identity/internal-jwt.service';
import type { GatewayRequestWithSession } from '@/identity/identity.interfaces';
import type { Response } from 'express';
import type { PaymentRpcGateway } from './payment.interfaces';
import { PAYMENT_RPC_GATEWAY } from './payment.tokens';
import { PaymentSessionGuard } from './payment-session.guard';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('api/payments')
export class PaymentsController {
  constructor(
    @Inject(PAYMENT_RPC_GATEWAY)
    private readonly payment: PaymentRpcGateway,
    private readonly internalJwt: InternalJwtService,
  ) {}

  @Get('vnpay/ipn')
  @HttpCode(HttpStatus.OK)
  processIpn(@Query() query: Record<string, string>) {
    return this.payment.send(PAYMENT_RPC_PATTERNS.processIpn, { query });
  }

  @Get('vnpay/return')
  @HttpCode(HttpStatus.OK)
  resolveReturn(@Query() query: Record<string, string>) {
    return this.payment.send(PAYMENT_RPC_PATTERNS.resolveReturn, { query });
  }

  @Get('vnpay/mobile-return')
  async resolveMobileReturn(
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ): Promise<void> {
    const response = await this.payment.send<{ redirectUrl: string }>(
      PAYMENT_RPC_PATTERNS.resolveMobileReturn,
      { query },
    );
    res.redirect(HttpStatus.FOUND, response.redirectUrl);
  }

  @Get('my')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PaymentSessionGuard)
  listMine(@Req() req: GatewayRequestWithSession) {
    return this.payment.send(PAYMENT_RPC_PATTERNS.listMyTransactions, {
      internalAuth: this.internalJwt.issueForRequest(req, 'payment'),
    });
  }
}
