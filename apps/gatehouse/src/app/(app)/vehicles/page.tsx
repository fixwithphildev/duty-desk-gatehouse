import { redirect } from "next/navigation";

// Vehicle Access is now the Gate Console.
export default function VehiclesPage() {
  redirect("/gate");
}
