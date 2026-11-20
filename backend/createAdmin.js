const bcrypt = require("bcryptjs");
const db = require("./db");

async function main() {
  const hash = await bcrypt.hash("Admin@12345", 10);

  await db.query(
    `INSERT INTO users (first_name, last_name, email, password_hash, role)
     VALUES (?, ?, ?, ?, ?)`,
    ["Allen", "Manago", "allen@pup.edu.ph", hash, "admin"]
  );

  console.log("Admin created: allen@pup.edu.ph / Admin@12345");
  process.exit();
}

main().catch(function (err) {
  console.error(err);
  process.exit(1);
});