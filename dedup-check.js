const fs = require("fs");
const path = require("path");
const file = path.join(process.env.USERPROFILE, "biz.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const total = data.length;

const withEmail = data.filter((b) => b.email);
const emailCount = {};
withEmail.forEach((b) => {
  const k = b.email.toLowerCase();
  emailCount[k] = (emailCount[k] || 0) + 1;
});
const dupEmails = Object.entries(emailCount).filter(([, c]) => c > 1);

console.log("=== Total scraped rows: " + total + " ===\n");
console.log("--- EMAIL DUPLICATES (same email on >1 business) ---");
console.log("Rows with email:        " + withEmail.length);
console.log("Unique email addresses: " + Object.keys(emailCount).length);
console.log("Emails shared by >1 biz: " + dupEmails.length);
if (dupEmails.length) {
  console.log("Top 5 most-shared:");
  dupEmails.sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([e, c]) =>
    console.log("  " + c + "x  " + e)
  );
}

console.log("\n--- PHONE DUPLICATES ---");
const withPhone = data.filter((b) => b.phone);
const phoneCount = {};
withPhone.forEach((b) => {
  const norm = (b.phone || "").replace(/[^0-9+]/g, "");
  if (norm) phoneCount[norm] = (phoneCount[norm] || 0) + 1;
});
const dupPhones = Object.entries(phoneCount).filter(([, c]) => c > 1);
console.log("Rows with phone:        " + withPhone.length);
console.log("Unique phone numbers:   " + Object.keys(phoneCount).length);
console.log("Phones shared by >1 biz: " + dupPhones.length);
if (dupPhones.length) {
  console.log("Top 5 most-shared:");
  dupPhones.sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([p, c]) =>
    console.log("  " + c + "x  " + p)
  );
}

console.log("\n--- SAME (name + city) — possible row-level duplicates ---");
const nameCount = {};
data.forEach((b) => {
  const k = (b.name || "").trim().toLowerCase() + "|" + (b.city || "").toLowerCase();
  nameCount[k] = (nameCount[k] || 0) + 1;
});
const dupNames = Object.entries(nameCount).filter(([, c]) => c > 1);
console.log("Same (name, city) appearing >1x: " + dupNames.length);
if (dupNames.length) {
  console.log("First 5:");
  dupNames.slice(0, 5).forEach(([k, c]) => console.log("  " + c + "x  " + k));
}
