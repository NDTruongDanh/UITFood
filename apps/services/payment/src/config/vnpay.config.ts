import { registerAs } from '@nestjs/config';

export const vnpayConfig = registerAs('vnpay', () => ({
  tmnCode: process.env['VNPAY_TMN_CODE']!,
  hashSecret: process.env['VNPAY_HASH_SECRET']!,
  url: process.env['VNPAY_URL']!,
  returnUrl: process.env['VNPAY_RETURN_URL']!,
  mobileReturnUrl: process.env['MOBILE_PAYMENT_RETURN_URL']!,
  sessionTimeoutSeconds: parseInt(
    process.env['PAYMENT_SESSION_TIMEOUT_SECONDS'] ?? '1800',
    10,
  ),
  refundEnabled: ['1', 'true', 'yes'].includes(
    (process.env['VNPAY_REFUND_ENABLED'] ?? 'false').trim().toLowerCase(),
  ),
  apiUrl:
    process.env['VNPAY_API_URL'] ??
    'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
  refundMaxRetries: parseInt(
    process.env['VNPAY_REFUND_MAX_RETRIES'] ?? '5',
    10,
  ),
}));

export type VNPayConfig = ReturnType<typeof vnpayConfig>;
