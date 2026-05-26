import {
  pgTable,
  text,
  timestamp,
  integer,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// -------- Auth.js tables (canonical shape for @auth/drizzle-adapter) --------

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationTokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// -------- Domain: orgs, memberships, invitations --------

export const organizations = pgTable("organizations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const memberRole = ["owner", "admin", "member"] as const;
export type MemberRole = (typeof memberRole)[number];

export const memberships = pgTable(
  "memberships",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role", { enum: memberRole }).notNull().default("member"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique("memberships_user_org_unique").on(t.userId, t.organizationId)],
);

export const easConnections = pgTable(
  "eas_connections",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    expoUsername: text("expo_username").notNull(),
    expoAccountName: text("expo_account_name").notNull(),
    tokenCiphertext: text("token_ciphertext").notNull(),
    tokenIv: text("token_iv").notNull(),
    tokenAuthTag: text("token_auth_tag").notNull(),
    addedByUserId: text("added_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    validatedAt: timestamp("validated_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique("eas_connections_org_unique").on(t.organizationId)],
);

// -------- Mobile / programmatic API tokens --------

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    lastUsedAt: timestamp("last_used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique("api_tokens_hash_unique").on(t.tokenHash)],
);

// -------- Chat notifications (Slack / Discord webhooks) --------

export const chatProvider = ["slack", "discord"] as const;
export type ChatProvider = (typeof chatProvider)[number];

export const chatConnections = pgTable(
  "chat_connections",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: chatProvider }).notNull(),
    channelLabel: text("channel_label"), // user-supplied label, e.g. "#releases"
    webhookCiphertext: text("webhook_ciphertext").notNull(),
    webhookIv: text("webhook_iv").notNull(),
    webhookAuthTag: text("webhook_auth_tag").notNull(),
    addedByUserId: text("added_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique("chat_connections_org_provider_unique").on(t.organizationId, t.provider)],
);

// -------- Approval gating --------

export const approverRole = ["owner", "admin"] as const;
export type ApproverRole = (typeof approverRole)[number];

export const approvalPolicies = pgTable(
  "approval_policies",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    buildProfile: text("build_profile").notNull(),
    requiredApprovals: integer("required_approvals").notNull().default(1),
    approverRole: text("approver_role", { enum: approverRole })
      .notNull()
      .default("admin"),
    // null = broadcast to every connected chat target on sync;
    // set = route only to that connection.
    chatConnectionId: text("chat_connection_id").references(() => chatConnections.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    unique("approval_policies_org_profile_unique").on(t.organizationId, t.buildProfile),
  ],
);

export const approvalStatus = ["pending", "approved", "rejected"] as const;
export type ApprovalStatus = (typeof approvalStatus)[number];

export const approvalRequests = pgTable(
  "approval_requests",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    buildId: text("build_id").notNull(),
    buildProfile: text("build_profile").notNull(),
    appName: text("app_name"),
    appSlug: text("app_slug"),
    platform: text("platform"),
    gitCommitHash: text("git_commit_hash"),
    gitCommitMessage: text("git_commit_message"),
    initiatingActor: text("initiating_actor"),
    buildCreatedAt: timestamp("build_created_at"),
    status: text("status", { enum: approvalStatus }).notNull().default("pending"),
    requiredApprovals: integer("required_approvals").notNull(),
    approvalCount: integer("approval_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [unique("approval_requests_org_build_unique").on(t.organizationId, t.buildId)],
);

export const approvalEventType = [
  "created",
  "approved",
  "rejected",
  "comment",
] as const;
export type ApprovalEventType = (typeof approvalEventType)[number];

export const approvalEvents = pgTable(
  "approval_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    approvalRequestId: text("approval_request_id")
      .notNull()
      .references(() => approvalRequests.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type", { enum: approvalEventType }).notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    unique("approval_events_request_user_approve_unique").on(
      t.approvalRequestId,
      t.userId,
      t.type,
    ),
  ],
);

export const invitations = pgTable(
  "invitations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    invitedByUserId: text("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique("invitations_org_email_unique").on(t.organizationId, t.email)],
);
