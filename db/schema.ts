import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
export const sources = sqliteTable("sources", {
  id: text("id").notNull(), owner: text("owner").notNull(), title: text("title").notNull(),
  url: text("url").notNull(), activeRun: text("active_run"), updated: text("updated").notNull(),
}, t => [primaryKey({columns:[t.owner,t.id]})]);
export const imports = sqliteTable("imports", {
  id: text("id").primaryKey(), owner: text("owner").notNull(), source: text("source").notNull(),
  baseRun: text("base_run"), expected: integer("expected").notNull(), status: text("status").notNull(),
  summary: text("summary").notNull(), created: text("created").notNull(),
}, t => [index("imports_owner").on(t.owner)]);
export const resources = sqliteTable("resources", {
  run: text("run").notNull(), id: text("id").notNull(), owner: text("owner").notNull(),
  source: text("source").notNull(), subject: text("subject").notNull(), kind: text("kind").notNull(),
  title: text("title").notNull(), search: text("search").notNull(), data: text("data").notNull(),
}, t => [primaryKey({columns:[t.run,t.id]}), index("resources_owner_source_run").on(t.owner,t.source,t.run)]);
export const collections = sqliteTable("collections", {
  id: text("id").primaryKey(), owner: text("owner").notNull(), title: text("title").notNull(),
  description: text("description").notNull(), created: text("created").notNull(),
  workspace: text("workspace"), shared: integer("shared").notNull().default(0),
}, t => [index("collections_owner").on(t.owner)]);
export const items = sqliteTable("items", {
  collection: text("collection").notNull(), resource: text("resource").notNull(),
  owner: text("owner").notNull(), snapshot: text("snapshot").notNull(),
  note: text("note").notNull(), position: integer("position").notNull(),
}, t => [primaryKey({columns:[t.collection,t.resource]}), index("items_owner_collection").on(t.owner,t.collection)]);
export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull(), ownerEmail: text("owner_email").notNull(),
  title: text("title").notNull(), created: text("created").notNull(),
});
export const members = sqliteTable("members", {
  email: text("email").primaryKey(), userId: text("user_id"), name: text("name").notNull().default(""),
  role: text("role").notNull(), status: text("status").notNull(), added: text("added").notNull(),
  lastSeen: text("last_seen"),
}, t => [index("members_user_status").on(t.userId,t.status)]);
