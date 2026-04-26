import Image from "next/image";
import { AuditForm } from "@/components/audit/audit-form";

export default function Home() {
  return (
    <>
      <main className="relative mx-auto max-w-2xl p-8">
        <h1 className="text-5xl font-semibold">Geode</h1>
        <p className="mt-1 text-md text-zinc-500">
          A Single-URL Generative Engine Optimization audit
        </p>
        <div className="mt-6">
          <AuditForm />
        </div>
      </main>
      <Image
        src="/Amatista_Laye_2-removebg-preview.png"
        alt=""
        width={520}
        height={520}
        priority
        aria-hidden
        className="pointer-events-none fixed -bottom-16 -right-16 z-[-1] h-auto w-104 select-none opacity-90"
      />
    </>
  );
}
