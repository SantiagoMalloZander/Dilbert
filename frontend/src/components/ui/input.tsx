import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-lg border-2 border-[#2A1A0A] bg-white px-3 py-2 text-sm text-[#1A1A1A] transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[#1A1A1A]/40 focus-visible:border-[#D4420A] focus-visible:ring-3 focus-visible:ring-[#D4420A]/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-[#D4420A] md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
