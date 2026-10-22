export default function ErrorPanel({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900 sm:p-5"
    >
      <p className="font-semibold">We couldn&apos;t check this</p>
      <p className="mt-1 text-sm">{message}</p>
      <p className="mt-2 text-xs text-red-800">No verdict is shown when the check fails.</p>
    </div>
  );
}
