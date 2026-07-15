import { randomBytes } from "node:crypto";
import process from "node:process";
import {
  createPasswordHash,
  encodeBase32,
  verifyTotp,
} from "../netlify/functions/admin/_security.mjs";

function hiddenPrompt(label) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
      reject(new Error("Run this setup in an interactive terminal."));
      return;
    }
    let value = "";
    process.stdout.write(label);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", onData);
    };
    const onData = (chunk) => {
      for (const char of chunk.toString("utf8")) {
        if (char === "\u0003") {
          cleanup();
          process.stdout.write("\n");
          reject(new Error("Setup cancelled."));
          return;
        }
        if (char === "\r" || char === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u007f" || char === "\b") {
          if (value) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }
        if (char >= " ") {
          value += char;
          process.stdout.write("•");
        }
      }
    };
    process.stdin.on("data", onData);
  });
}

function visiblePrompt(label) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error("Run this setup in an interactive terminal."));
      return;
    }
    process.stdout.write(label);
    process.stdin.resume();
    process.stdin.once("data", (chunk) => {
      process.stdin.pause();
      resolve(chunk.toString("utf8").trim());
    });
  });
}

async function main() {
  console.log("FitJo secure admin setup\n");
  const password = await hiddenPrompt("Choose an admin password (12+ characters): ");
  if (password.length < 12) throw new Error("The password must be at least 12 characters long.");
  const confirmation = await hiddenPrompt("Confirm the admin password: ");
  if (password !== confirmation) throw new Error("The passwords do not match.");

  const totpSecret = encodeBase32(randomBytes(20));
  const account = "FitJo Admin";
  const issuer = "FitJo";
  const uri = `otpauth://totp/${encodeURIComponent(account)}?secret=${totpSecret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

  console.log("\nAdd this account to Google Authenticator, Microsoft Authenticator, Authy, or 1Password:");
  console.log(`  Account: ${account}`);
  console.log(`  Secret:  ${totpSecret}`);
  console.log(`  Setup link: ${uri}\n`);

  const code = await visiblePrompt("Enter the current 6-digit code to confirm setup: ");
  if (!verifyTotp(totpSecret, code)) throw new Error("That authenticator code is not valid. Check the account and try again.");

  console.log("\nAdd these three values to Netlify's secure environment variables (Functions scope), then redeploy:\n");
  console.log(`ADMIN_PASSWORD_HASH=${createPasswordHash(password)}`);
  console.log(`ADMIN_TOTP_SECRET=${totpSecret}`);
  console.log(`ADMIN_SESSION_SECRET=${randomBytes(48).toString("base64url")}`);
  console.log("\nKeep these values private. Do not add them to GitHub.");
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
});
