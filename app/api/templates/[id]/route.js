import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Template from "@/models/Template";
import { getUserId } from "@/lib/auth";

export async function GET(request, { params }) {
  const userId = getUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const template = await Template.findOne({ _id: params.id, userId });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(template);
}

export async function PUT(request, { params }) {
  const userId = getUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const update = {};
  if (typeof body?.name === "string") update.name = body.name;
  if (body?.schema) update.schema = body.schema;
  if (typeof body?.isDefault === "boolean") update.isDefault = body.isDefault;

  await connectDB();
  // Query is scoped to { _id, userId } together, so one user can never
  // update another user's template even by guessing an id.
  const template = await Template.findOneAndUpdate(
    { _id: params.id, userId },
    { $set: update },
    { new: true },
  );
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(template);
}

export async function DELETE(request, { params }) {
  const userId = getUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const result = await Template.deleteOne({ _id: params.id, userId });
  if (result.deletedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
