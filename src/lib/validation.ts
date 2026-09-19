import { z } from "zod";

// All API routes validate input with these schemas server-side. Client-side
// form validation exists too (for UX) but is never trusted on its own.

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  password: z.string().min(8).max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const createOrderSchema = z.object({
  productId: z.string().min(1),
  variant: z.enum(["WATERMARKED", "CLEAN"]),
});

export const verifyPaymentSchema = z.object({
  orderId: z.string().min(1),
});

export const singleDownloadSchema = z.object({
  reelId: z.string().min(1),
  intent: z.enum(["preview", "download"]).default("download"),
});

export const batchDownloadCreateSchema = z.object({
  productId: z.string().min(1),
  variant: z.enum(["WATERMARKED", "CLEAN"]),
  reelIds: z.array(z.string().min(1)).min(1).max(200),
});

export const productUpsertSchema = z.object({
  name: z.string().trim().min(1).max(150),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(150)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  categoryId: z.string().nullable().optional(),
  description: z.string().max(10000).default(""),
  shortDescription: z.string().max(300).nullable().optional(),
  watermarkedPriceInPaise: z.number().int().min(0).nullable().optional(),
  cleanPriceInPaise: z.number().int().min(0).nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  featured: z.boolean().default(false),
  purchasable: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  seoTitle: z.string().max(200).nullable().optional(),
  seoDescription: z.string().max(300).nullable().optional(),
  licenseText: z.string().max(10000).nullable().optional(),
});

export const categoryUpsertSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  sortOrder: z.number().int().default(0),
});

export const reelUpsertSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().int().default(0),
  visibility: z.enum(["VISIBLE", "HIDDEN"]).default("VISIBLE"),
});

export const uploadUrlRequestSchema = z.object({
  productId: z.string().min(1),
  reelId: z.string().min(1).optional(), // omitted when creating a new reel
  kind: z.enum(["reel-watermarked", "reel-clean", "reel-thumbnail", "thumbnail", "preview"]),
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive(),
});

export const settingsUpdateSchema = z.record(z.string(), z.any());

// --- Customer account management -----------------------------------------

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export const changeEmailSchema = z.object({
  newEmail: z.string().trim().email().max(200),
  currentPassword: z.string().min(1).max(200),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(8).max(200),
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must be different from your current password",
    path: ["newPassword"],
  });
