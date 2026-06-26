CREATE TYPE "public"."payment_status" AS ENUM('pending', 'awaiting_ipn', 'completed', 'failed', 'refund_pending', 'refunded');--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"payment_url" text,
	"provider_txn_id" text,
	"vnp_response_code" text,
	"raw_ipn_payload" jsonb,
	"ipn_received_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"refund_initiated_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"refund_retry_count" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_transactions_provider_txn_id_unique" UNIQUE("provider_txn_id")
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"event_version" integer NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"aggregate_version" integer DEFAULT 0 NOT NULL,
	"envelope" jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "inbox_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consumer" text NOT NULL,
	"event_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_inbox_consumer_event_unique" UNIQUE("consumer","event_id")
);
--> statement-breakpoint
CREATE INDEX "idx_ptxn_order_id" ON "payment_transactions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_ptxn_customer_id" ON "payment_transactions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_ptxn_expires_at" ON "payment_transactions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_payment_outbox_due" ON "outbox_events" USING btree ("published_at","next_attempt_at");--> statement-breakpoint
CREATE INDEX "idx_payment_outbox_aggregate" ON "outbox_events" USING btree ("aggregate_id","aggregate_version");--> statement-breakpoint
CREATE INDEX "idx_payment_inbox_consumer" ON "inbox_messages" USING btree ("consumer");