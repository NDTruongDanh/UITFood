CREATE TYPE "public"."menu_item_kind" AS ENUM('food', 'beverage', 'mixed');--> statement-breakpoint
ALTER TYPE "public"."nutrition_input_type" ADD VALUE 'manual';--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "item_kind" "menu_item_kind" NOT NULL;--> statement-breakpoint
CREATE INDEX "menu_items_item_kind_idx" ON "menu_items" USING btree ("item_kind");