import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models";

// GET /api/users - Fetch all registered developers
export async function GET() {
  try {
    await connectToDatabase();
    const users = await User.find({}).sort({ username: 1 });
    return NextResponse.json(users);
  } catch (error: any) {
    console.error("GET /api/users error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch users" }, { status: 500 });
  }
}

// POST /api/users - Register or update a developer profile (one-time login/persist)
export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { id, _id, username, avatar, status, mobileNumber } = body;
    const finalId = id || _id;

    if (!finalId || !username) {
      return NextResponse.json({ error: "id (handle) and username are required" }, { status: 400 });
    }

    // Format handle to lowercase, no spaces
    const cleanId = finalId.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");

    if (!cleanId) {
      return NextResponse.json({ error: "Invalid developer handle" }, { status: 400 });
    }

    // Build update fields dynamically
    const updateFields: any = {
      username: username.trim(),
      avatar: avatar || "",
      status: status || "Coding...",
    };

    if (mobileNumber) {
      const cleanPhone = mobileNumber.replace(/\D/g, "");
      if (cleanPhone.length < 10) {
        return NextResponse.json({ error: "Invalid mobile number format. Minimum 10 digits required." }, { status: 400 });
      }

      // Check uniqueness: ensure no other user has this phone number
      const existingUser = await User.findOne({ mobileNumber: cleanPhone });
      if (existingUser && existingUser._id !== cleanId) {
        return NextResponse.json({ error: "Mobile number is already registered by another developer." }, { status: 400 });
      }
      updateFields.mobileNumber = cleanPhone;
    }

    // Upsert the user profile
    const user = await User.findByIdAndUpdate(
      cleanId,
      updateFields,
      { new: true, upsert: true }
    );

    return NextResponse.json(user);
  } catch (error: any) {
    console.error("POST /api/users error:", error);
    return NextResponse.json({ error: error.message || "Failed to save user profile" }, { status: 500 });
  }
}
