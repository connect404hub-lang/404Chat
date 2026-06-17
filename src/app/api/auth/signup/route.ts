import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models";
import { hashPassword } from "@/lib/authUtils";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { handle, username, password, avatar, mobileNumber } = body;

    if (!handle || !username || !password) {
      return NextResponse.json(
        { error: "Handle, Display Name, and Password are required." },
        { status: 400 }
      );
    }

    const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!cleanHandle) {
      return NextResponse.json(
        { error: "Invalid developer handle format." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    // Check if handle is already taken
    const handleExists = await User.exists({ _id: cleanHandle });
    if (handleExists) {
      return NextResponse.json(
        { error: "Developer handle is already taken." },
        { status: 400 }
      );
    }

    // Check if mobileNumber is taken (only if provided and not empty)
    let cleanPhone = "";
    if (mobileNumber) {
      cleanPhone = mobileNumber.replace(/\D/g, "");
      if (cleanPhone) {
        const phoneExists = await User.exists({ mobileNumber: cleanPhone });
        if (phoneExists) {
          return NextResponse.json(
            { error: "Mobile number is already registered by another developer." },
            { status: 400 }
          );
        }
      }
    }

    // Hash password
    const hashedPassword = hashPassword(password);

    // Save User
    const newUser = new User({
      _id: cleanHandle,
      username: username.trim(),
      password: hashedPassword,
      avatar: avatar || "avatar-terminal",
      status: "Coding...",
      mobileNumber: cleanPhone,
    });

    await newUser.save();

    // Remove password from response for security
    const userObj = newUser.toObject();
    delete userObj.password;

    return NextResponse.json(userObj);
  } catch (error: any) {
    console.error("signup error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sign up." },
      { status: 500 }
    );
  }
}
