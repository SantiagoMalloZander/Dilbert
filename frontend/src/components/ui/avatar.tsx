import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

function Avatar({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar"
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-foreground",
        className
      )}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-fallback"
      className={cn("flex h-full w-full items-center justify-center text-sm font-medium", className)}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  alt = "",
  src,
}: {
  className?: string;
  alt?: string;
  src?: string | null;
}) {
  if (typeof src !== "string" || !src) {
    return null;
  }

  return (
    <Image
      data-slot="avatar-image"
      src={src}
      alt={alt}
      fill
      unoptimized
      className={cn("h-full w-full object-cover", className)}
    />
  );
}

export { Avatar, AvatarFallback, AvatarImage };
