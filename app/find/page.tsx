import { redirect } from "next/navigation";

// "Find my scholarships" now starts with the profile steps. Keep old links working.
export default function FindRedirect() {
  redirect("/profile");
}
