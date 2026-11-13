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
}, t => [index("collections_owner").on(t.owner)]);
export const items = sqliteTable("items", {
  collection: text("collection").notNull(), resource: text("resource").notNull(),
  owner: text("owner").notNull(), snapshot: text("snapshot").notNull(),
  note: text("note").notNull(), position: integer("position").notNull(),
}, t => [primaryKey({columns:[t.collection,t.resource]}), index("items_owner_collection").on(t.owner,t.collection)]);
