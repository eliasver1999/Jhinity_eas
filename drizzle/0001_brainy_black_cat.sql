CREATE TABLE "eas_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"expo_username" text NOT NULL,
	"expo_account_name" text NOT NULL,
	"token_ciphertext" text NOT NULL,
	"token_iv" text NOT NULL,
	"token_auth_tag" text NOT NULL,
	"added_by_user_id" text,
	"validated_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "eas_connections_org_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
ALTER TABLE "eas_connections" ADD CONSTRAINT "eas_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eas_connections" ADD CONSTRAINT "eas_connections_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;