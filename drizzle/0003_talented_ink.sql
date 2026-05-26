CREATE TABLE "slack_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"channel_label" text,
	"webhook_ciphertext" text NOT NULL,
	"webhook_iv" text NOT NULL,
	"webhook_auth_tag" text NOT NULL,
	"added_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "slack_connections_org_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
ALTER TABLE "slack_connections" ADD CONSTRAINT "slack_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_connections" ADD CONSTRAINT "slack_connections_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;