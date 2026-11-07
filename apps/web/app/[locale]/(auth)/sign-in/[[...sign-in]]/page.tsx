import { Suspense } from "react";
import { SignInForm } from "@/components/auth-forms";

// The boundary keeps the shell static: the form reads the URL.
export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
