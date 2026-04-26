import { AuditForm } from "@/components/audit/audit-form";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-5xl font-semibold">Geode</h1>
      <p className="mt-1 text-md text-zinc-500">
        A Single-URL Generative Engine Optimization audit
      </p>
      <div className="mt-6">
        <AuditForm />
      </div>
    </main>
  );
}
