import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models";
import { verifyPassword } from "@/lib/authUtils";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { handle, password } = body;

    if (!handle || !password) {
      return NextResponse.json(
        { error: "Developer Handle and Password are required." },
        { status: 400 }
      );
    }

    const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");

    // Find User
    const user = await User.findById(cleanHandle);
    if (!user) {
      return NextResponse.json(
        { error: "Developer handle not found. Please sign up." },
        { status: 401 }
      );
    }

    // Verify Password
    const isValid = verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Incorrect password. Please try again." },
        { status: 401 }
      );
    }

    // Remove password from response for security
    const userObj = user.toObject();
    delete userObj.password;

    return NextResponse.json(userObj);
  } catch (error: any) {
    console.error("login error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to log in." },
      { status: 500 }
    );
  }
}
