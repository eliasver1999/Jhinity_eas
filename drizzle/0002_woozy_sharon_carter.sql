CREATE TABLE "approval_events" (
	"id" text PRIMARY KEY NOT NULL,
	"approval_request_id" text NOT NULL,
	"user_id" text,
	"type" text NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "approval_events_request_user_approve_unique" UNIQUE("approval_request_id","user_id","type")
);
--> statement-breakpoint
CREATE TABLE "approval_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"build_profile" text NOT NULL,
	"required_approvals" integer DEFAULT 1 NOT NULL,
	"approver_role" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "approval_policies_org_profile_unique" UNIQUE("organization_id","build_profile")
);
--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"build_id" text NOT NULL,
	"build_profile" text NOT NULL,
	"app_name" text,
	"app_slug" text,
	"platform" text,
	"git_commit_hash" text,
	"git_commit_message" text,
	"initiating_actor" text,
	"build_created_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"required_approvals" integer NOT NULL,
	"approval_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "approval_requests_org_build_unique" UNIQUE("organization_id","build_id")
);
--> statement-breakpoint
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_approval_request_id_approval_requests_id_fk" FOREIGN KEY ("approval_request_id") REFERENCES "public"."approval_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_policies" ADD CONSTRAINT "approval_policies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;