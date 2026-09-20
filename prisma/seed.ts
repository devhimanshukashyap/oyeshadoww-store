import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

/**
 * Run with `npm run seed`. Safe to re-run — every step checks for an
 * existing row first, so it won't create duplicates or overwrite an admin
 * password you've already changed.
 */
async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error(
      "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set before running the seed."
    );
  }

  const existingAdmin = await db.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await db.user.create({
      data: { email: adminEmail, name: "Admin", passwordHash, role: "ADMIN" },
    });
    console.log(`✔ Created admin account: ${adminEmail}`);
    console.log(`  Log in at /admin/login with the password from SEED_ADMIN_PASSWORD.`);
    console.log(`  ⚠ Change this password immediately after your first login.`);
  } else {
    console.log(`✔ Admin account already exists: ${adminEmail} (skipped)`);
  }

  const categoryData = [
    { name: "AI Snake Reels", slug: "ai-snake-reels", sortOrder: 0 },
    { name: "AI Animal Reels", slug: "ai-animal-reels", sortOrder: 1 },
    { name: "Funny AI Reels", slug: "funny-ai-reels", sortOrder: 2 },
  ];

  for (const cat of categoryData) {
    const existing = await db.category.findUnique({ where: { slug: cat.slug } });
    if (!existing) {
      await db.category.create({ data: cat });
      console.log(`✔ Created category: ${cat.name}`);
    }
  }

  const snakeCategory = await db.category.findUnique({ where: { slug: "ai-snake-reels" } });

  const sampleSlug = "ai-snake-reels-vol-01";
  const existingProduct = await db.product.findUnique({ where: { slug: sampleSlug } });
  if (!existingProduct) {
    await db.product.create({
      data: {
        name: "AI Snake Reels Vol. 01",
        slug: sampleSlug,
        categoryId: snakeCategory?.id,
        description:
          "A starter bundle of AI-generated snake reels. This is sample data created by the seed script — " +
          "edit it, add your own reels, and publish from Admin → Products.",
        shortDescription: "AI-generated snake reels, ready to post.",
        watermarkedPriceInPaise: 4900, // ₹49
        cleanPriceInPaise: 13900, // ₹139
        status: "DRAFT", // left as draft on purpose — publish once real reels are uploaded
        featured: false,
        purchasable: true,
      },
    });
    console.log(`✔ Created sample bundle: ${sampleSlug} (DRAFT — add reels, then publish)`);
  } else {
    console.log(`✔ Sample bundle already exists: ${sampleSlug} (skipped)`);
  }

  console.log("\nSeed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
