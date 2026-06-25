/**
 * Image creation payload sent to the Media service.
 *
 * Plain interface (no swagger/class-validator) — Catalog exposes RPC, not HTTP,
 * and the wire payload is validated by the zod schemas in `@uitfood/contracts`.
 */
export interface CreateImageDto {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
}
