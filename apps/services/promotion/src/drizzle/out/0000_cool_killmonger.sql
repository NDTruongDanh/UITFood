CREATE TYPE "public"."coupon_status" AS ENUM('active', 'exhausted', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."promotion_scope" AS ENUM('platform', 'restaurant');--> statement-breakpoint
CREATE TYPE "public"."promotion_status" AS ENUM('draft', 'active', 'paused', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."promotion_trigger" AS ENUM('auto_apply', 'coupon_code');--> statement-breakpoint
CREATE TYPE "public"."promotion_type" AS ENUM('percentage', 'fixed_amount', 'free_delivery', 'reduced_delivery', 'buy_x_get_y', 'free_item');--> statement-breakpoint
CREATE TYPE "public"."stacking_mode" AS ENUM('non_stackable', 'stackable', 'exclusive');--> statement-breakpoint
CREATE TYPE "public"."usage_status" AS ENUM('reserved', 'confirmed', 'rolled_back');--> statement-breakpoint
CREATE TABLE "coupon_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promotion_id" uuid NOT NULL,
	"code" text NOT NULL,
	"status" "coupon_status" DEFAULT 'active' NOT NULL,
	"max_uses" integer,
	"current_uses" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coupon_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "promotion_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promotion_id" uuid NOT NULL,
	"coupon_code_id" uuid,
	"order_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"discount_on_items" integer DEFAULT 0 NOT NULL,
	"discount_on_shipping" integer DEFAULT 0 NOT NULL,
	"discount_amount" integer NOT NULL,
	"status" "usage_status" DEFAULT 'reserved' NOT NULL,
	"reserved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"rolled_back_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "promotion_type" NOT NULL,
	"scope" "promotion_scope" NOT NULL,
	"status" "promotion_status" DEFAULT 'draft' NOT NULL,
	"trigger" "promotion_trigger" NOT NULL,
	"stacking_mode" "stacking_mode" DEFAULT 'non_stackable' NOT NULL,
	"restaurant_id" uuid,
	"discount_value" integer NOT NULL,
	"min_order_amount" integer,
	"max_discount_amount" integer,
	"max_total_uses" integer,
	"current_total_uses" integer DEFAULT 0 NOT NULL,
	"max_uses_per_user" integer,
	"requires_approved_restaurant" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_coupon_codes_promotion_id" ON "coupon_codes" USING btree ("promotion_id");--> statement-breakpoint
CREATE INDEX "idx_coupon_codes_status" ON "coupon_codes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_promo_usages_order_id" ON "promotion_usages" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_promo_usages_promo_customer" ON "promotion_usages" USING btree ("promotion_id","customer_id");--> statement-breakpoint
CREATE INDEX "idx_promo_usages_status_reserved_at" ON "promotion_usages" USING btree ("status","reserved_at");--> statement-breakpoint
CREATE INDEX "idx_promotions_status" ON "promotions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_promotions_restaurant_id" ON "promotions" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "idx_promotions_scope_trigger_status" ON "promotions" USING btree ("scope","trigger","status");--> statement-breakpoint
CREATE INDEX "idx_promotions_ends_at" ON "promotions" USING btree ("ends_at");