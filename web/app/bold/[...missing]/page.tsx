import { notFound } from "next/navigation";

// Any address that is not a page of this skin: show the skin's 404 page.
// (Without this, an unknown address would get Next.js's plain default.)
export default function Missing() {
  notFound();
}
