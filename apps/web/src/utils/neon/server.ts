"use server";
import { neon } from "@neondatabase/serverless";

export async function getData() {
    const sql = neon(process.env.NEXT_PUBLIC_NEON_URL as string);
    const data = await sql`select * from users`;
    return data;
}