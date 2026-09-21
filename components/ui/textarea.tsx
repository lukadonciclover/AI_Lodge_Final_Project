import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn("flex min-h-28 w-full rounded-md border border-line bg-white px-3 py-2 text-sm leading-6 text-ink outline-none placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-blue-100", className)} {...props} />
));
Textarea.displayName = "Textarea";
