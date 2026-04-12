import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirebaseAuth } from "./firebase";

const ALLOWED_EMAIL = process.env.NEXT_PUBLIC_ALLOWED_EMAIL || "";

export const isAllowedUser = (email: string | null): boolean => {
  if (!email) return false;
  return email.toLowerCase() === ALLOWED_EMAIL.toLowerCase();
};

export const signInWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    if (!isAllowedUser(result.user.email)) {
      await signOut(auth);
      return { success: false, error: "Ingen tilgang. Kun autorisert konto kan logge inn." };
    }
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Innlogging feilet";
    return { success: false, error: msg };
  }
};

export const signOutUser = async (): Promise<void> => {
  await signOut(getFirebaseAuth());
};
