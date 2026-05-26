// One-off: build drizzle/meta/0004_snapshot.json from 0003 by removing the
// slack_connections table entry and adding chat_connections, then append an
// entry to _journal.json so drizzle considers 0004 part of its history.
//
// This exists because the schema rename was applied manually (drizzle-kit
// generate has an interactive prompt that can't run in this environment).
//
// Run once with: node scripts/fixup-drizzle-meta.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const META = "drizzle/meta";

const prev = JSON.parse(readFileSync(`${META}/0003_snapshot.json`, "utf8"));

const chatConnections = {
  name: "chat_connections",
  schema: "",
  columns: {
    id: { name: "id", type: "text", primaryKey: true, notNull: true },
    organization_id: {
      name: "organization_id",
      type: "text",
      primaryKey: false,
      notNull: true,
    },
    provider: { name: "provider", type: "text", primaryKey: false, notNull: true },
    channel_label: {
      name: "channel_label",
      type: "text",
      primaryKey: false,
      notNull: false,
    },
    webhook_ciphertext: {
      name: "webhook_ciphertext",
      type: "text",
      primaryKey: false,
      notNull: true,
    },
    webhook_iv: {
      name: "webhook_iv",
      type: "text",
      primaryKey: false,
      notNull: true,
    },
    webhook_auth_tag: {
      name: "webhook_auth_tag",
      type: "text",
      primaryKey: false,
      notNull: true,
    },
    added_by_user_id: {
      name: "added_by_user_id",
      type: "text",
      primaryKey: false,
      notNull: false,
    },
    created_at: {
      name: "created_at",
      type: "timestamp",
      primaryKey: false,
      notNull: true,
      default: "now()",
    },
  },
  indexes: {},
  foreignKeys: {
    chat_connections_organization_id_organizations_id_fk: {
      name: "chat_connections_organization_id_organizations_id_fk",
      tableFrom: "chat_connections",
      tableTo: "organizations",
      columnsFrom: ["organization_id"],
      columnsTo: ["id"],
      onDelete: "cascade",
      onUpdate: "no action",
    },
    chat_connections_added_by_user_id_users_id_fk: {
      name: "chat_connections_added_by_user_id_users_id_fk",
      tableFrom: "chat_connections",
      tableTo: "users",
      columnsFrom: ["added_by_user_id"],
      columnsTo: ["id"],
      onDelete: "set null",
      onUpdate: "no action",
    },
  },
  compositePrimaryKeys: {},
  uniqueConstraints: {
    chat_connections_org_provider_unique: {
      name: "chat_connections_org_provider_unique",
      nullsNotDistinct: false,
      columns: ["organization_id", "provider"],
    },
  },
  policies: {},
  checkConstraints: {},
  isRLSEnabled: false,
};

const tables = { ...prev.tables };
delete tables["public.slack_connections"];
tables["public.chat_connections"] = chatConnections;

const snapshot = {
  ...prev,
  id: randomUUID(),
  prevId: prev.id,
  tables,
};

writeFileSync(`${META}/0004_snapshot.json`, JSON.stringify(snapshot, null, 2) + "\n");

const journal = JSON.parse(readFileSync(`${META}/_journal.json`, "utf8"));
const already = journal.entries.find((e) => e.tag === "0004_chat_connections");
if (!already) {
  journal.entries.push({
    idx: journal.entries.length,
    version: "7",
    when: Date.now(),
    tag: "0004_chat_connections",
    breakpoints: true,
  });
  writeFileSync(`${META}/_journal.json`, JSON.stringify(journal, null, 2) + "\n");
}

console.log("0004 snapshot written, journal updated.");
