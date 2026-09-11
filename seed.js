// Run once, after your database is connected and schema.sql has been applied:
//   npm run seed
//
// Creates the initial Site Manager account. Change SEED_PASSWORD below
// (or set it via an env var) before running, and change it again from
// inside the admin panel after your first login.

const { sql } = require("@vercel/postgres");
const bcrypt = require("bcryptjs");

const SEED_USERNAME = "Jai";
const SEED_PASSWORD = process.env.SEED_PASSWORD || "Jaiden@0811";
const SEED_RANK_TITLE = "Founder";

async function main() {
  const hash = await bcrypt.hash(SEED_PASSWORD, 12);

  await sql`
    INSERT INTO accounts (username, password_hash, rank_tier, rank_title, is_site_manager)
    VALUES (${SEED_USERNAME}, ${hash}, 'high', ${SEED_RANK_TITLE}, TRUE)
    ON CONFLICT (username) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        rank_tier = EXCLUDED.rank_tier,
        rank_title = EXCLUDED.rank_title,
        is_site_manager = TRUE;
  `;

  console.log(`Seeded Site Manager account "${SEED_USERNAME}".`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
