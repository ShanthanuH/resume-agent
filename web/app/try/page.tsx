import type { Metadata } from "next";
import { TryFlow } from "@/components/TryFlow";

export const metadata: Metadata = { title: "Tailor your resume" };

export default function TryPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <TryFlow />
    </div>
  );
}
