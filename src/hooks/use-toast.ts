export function toast({ title }: { title: string }) {
  if (typeof window !== "undefined") {
    window.alert(title);
  }
}
