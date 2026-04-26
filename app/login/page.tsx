import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-8">
      <h1 className="text-3xl font-semibold">Geode</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-500">Demo access</p>
      <LoginForm />
    </main>
  );
}
