import { redirect } from "next/navigation";

export const instant = false;

// Categories are now created from the Category dropdown in Register Purchases
export default function CategoriesPage() {
  redirect("/purchases");
}
