CREATE TABLE "reporting_order_facts" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"restaurant_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_amount" integer NOT NULL,
	"shipping_fee" integer DEFAULT 0 NOT NULL,
	"district" text,
	"placed_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reporting_order_item_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"menu_item_id" text NOT NULL,
	"item_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"revenue" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reporting_order_item_facts_order_item_unique" UNIQUE("order_id","menu_item_id")
);
--> statement-breakpoint
CREATE TABLE "reporting_restaurant_facts" (
	"restaurant_id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_approved" boolean DEFAULT false NOT NULL,
	"is_open" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbox_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consumer" text NOT NULL,
	"event_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	CONSTRAINT "inbox_consumer_event_unique" UNIQUE("consumer","event_id")
);
--> statement-breakpoint
CREATE INDEX "idx_reporting_order_facts_placed_at" ON "reporting_order_facts" USING btree ("placed_at");--> statement-breakpoint
CREATE INDEX "idx_reporting_order_facts_restaurant" ON "reporting_order_facts" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "idx_reporting_order_facts_status" ON "reporting_order_facts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_reporting_order_item_facts_order" ON "reporting_order_item_facts" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_reporting_order_item_facts_menu_item" ON "reporting_order_item_facts" USING btree ("menu_item_id");