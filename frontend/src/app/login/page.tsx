import { redirect } from "next/navigation";

export default function RootLoginRedirectPage() {
  const defaultSlug =
    process.env.NEXT_PUBLIC_DEFAULT_VILLAGE_SLUG?.toLowerCase() || "ringdikit";
  redirect(`/${defaultSlug}/login`);
}
