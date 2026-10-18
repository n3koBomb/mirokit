import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";

// Run the repository's real schema and SQL locally; this does not emulate D1's runtime.
export function createDatabase() {
  const database = new DatabaseSync(":memory:");
  const migrations = new URL("../../migrations/", import.meta.url);
  try {
    database.exec("PRAGMA foreign_keys = ON");
    for (const name of readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort()) {
      database.exec(readFileSync(new URL(name, migrations), "utf8"));
    }
  } catch (error) {
    database.close();
    throw error;
  }
  return database;
}

export function executeStatements(database, statements) {
  database.exec("BEGIN");
  try {
    for (const { sql, params } of statements) database.prepare(sql).run(...params);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
