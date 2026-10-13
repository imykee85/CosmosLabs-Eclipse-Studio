import ErrorScreen from "@/components/ErrorScreen";

export default function NotFound() {
  return <ErrorScreen title="Page not found" text="There is nothing at this address. It may have moved, or the link may be wrong." homeLabel="Back to Eclipse" homeHref="/dashboard" />;
}
