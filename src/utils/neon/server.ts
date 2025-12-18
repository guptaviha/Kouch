"use server";
import { neon } from "@neondatabase/serverless";

export async function getData() {
    const sql = neon(process.env.NEXT_PUBLIC_NEON_URL);
    const data = await sql`...`;
    return data;
}