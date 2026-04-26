"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

function getFromParam(): string {
  if (typeof window === "undefined") return "/";
  const from = new URL(window.location.href).searchParams.get("from");
  return from && from.startsWith("/") ? from : "/";
}

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "incorrect password");
      }
      router.replace(getFromParam());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "incorrect password");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
        required
        className="w-full rounded-md border px-3 py-2"
        placeholder="Password"
      />
      <button
        type="submit"
        disabled={submitting}
        className="w-full cursor-pointer rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
