import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Template from "@/models/Template";
import { getUserId } from "@/lib/auth";

export async function GET(request) {
  const userId = getUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const templates = await Template.find({ userId }).sort({
    isDefault: -1,
    createdAt: 1,
  });

  return NextResponse.json(templates);
}
export async function POST(request) {
  const userId = getUserId(request);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.name || !body?.schema) {
    return NextResponse.json(
      { error: "name and schema are required" },
      { status: 400 },
    );
  }

  await connectDB();
  // userId always comes from the verified JWT above — never from the request body.
  const template = await Template.create({
    userId,
    name: body.name,
    schema: body.schema,
    isDefault: !!body.isDefault,
  });
  return NextResponse.json(template, { status: 201 });
}
