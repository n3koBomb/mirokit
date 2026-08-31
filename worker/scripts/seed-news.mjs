import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import vm from "node:vm";

const argumentsList = process.argv.slice(2);
const dryRun = argumentsList.includes("--dry-run");
const local = argumentsList.includes("--local");
const databaseName = argumentsList.find((argument) => !argument.startsWith("--")) || "mirokit-news";
const source = readFileSync(new URL("../../site/source/scripts/news-data.js", import.meta.url), "utf8");
const context = {};
vm.runInNewContext(`${source}\nthis.news = MIRoKIT_NEWS;`, context);

const sqlQuote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const now = new Date().toISOString();
const statements = [];

for (const item of context.news) {
	const image = item.image.startsWith("./") ? item.image.slice(1) : item.image;
	statements.push(`INSERT INTO news (id, status, published_at, category, accent, image_url, featured, created_at, updated_at) VALUES (${sqlQuote(item.id)}, 'published', ${sqlQuote(item.publishedAt)}, ${sqlQuote(item.category)}, ${sqlQuote(item.accent)}, ${sqlQuote(image)}, ${item.featured === false ? "NULL" : Number(item.featured)}, ${sqlQuote(now)}, ${sqlQuote(now)}) ON CONFLICT(id) DO UPDATE SET status = 'published', published_at = excluded.published_at, category = excluded.category, accent = excluded.accent, image_url = excluded.image_url, featured = excluded.featured, updated_at = excluded.updated_at;`);
	for (const language of ["ru", "en", "de"]) {
		const translation = {
			alt: item.alt[language],
			title: item.title[language],
			summary: item.summary[language],
			content: item.content[language],
		};
		statements.push(`INSERT INTO news_translations (news_id, language, alt, title, summary, content_json) VALUES (${sqlQuote(item.id)}, ${sqlQuote(language)}, ${sqlQuote(translation.alt)}, ${sqlQuote(translation.title)}, ${sqlQuote(translation.summary)}, ${sqlQuote(JSON.stringify(translation.content))}) ON CONFLICT(news_id, language) DO UPDATE SET alt = excluded.alt, title = excluded.title, summary = excluded.summary, content_json = excluded.content_json;`);
	}
}

if (dryRun) {
	console.log(`Prepared ${statements.length} SQL statements for ${context.news.length} news items.`);
	process.exit(0);
}

const result = spawnSync("npx", ["wrangler", "d1", "execute", databaseName, local ? "--local" : "--remote", "--config", local ? "wrangler.local.jsonc" : "wrangler.jsonc", "--command", statements.join("\n")], {
	 cwd: new URL("..", import.meta.url),
	 stdio: "inherit",
});

process.exit(result.status ?? 1);
