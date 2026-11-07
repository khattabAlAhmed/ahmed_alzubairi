import { Suspense } from "react";
import { SignUpForm } from "@/components/auth-forms";

// The boundary keeps the shell static: the form reads the URL.
export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
