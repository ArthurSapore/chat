import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),

  // JWT_SECRET: z.string().min(32),

  // DATABASE_URL: z.url(),
  UI_URL: z.string().nonempty().default('http://localhost:5173')
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment variables:");

  console.error(z.prettifyError(result.error));

  process.exit(1);
}

export const env = result.data;