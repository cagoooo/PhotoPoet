import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 transform hover:scale-105 transition-transform",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 transform hover:scale-105 transition-transform",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground transform hover:scale-105 transition-transform",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 transform hover:scale-105 transition-transform shadow-md",
        ghost: "hover:bg-accent hover:text-accent-foreground transform hover:scale-105 transition-transform",
        link: "text-primary underline-offset-4 hover:underline",
        gradient: "relative overflow-hidden bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-2 px-4 rounded transform transition-transform duration-300 hover:scale-105 shadow-md before:absolute before:inset-0 before:animate-[shimmer_2s_linear_infinite] before:bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.5)_50%,rgba(255,255,255,0)_100%)] before:bg-[length:150%_100%] before:bg-no-repeat before:[transform:translateX(-100%)]", // Added gradient variant with shimmer
        upload: "bg-gradient-to-r from-green-400 to-blue-500 hover:from-pink-500 hover:to-yellow-500 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transform transition-transform duration-300 hover:scale-105 shadow-md",
        lightblue: "bg-sky-500 text-white hover:bg-sky-600 transform hover:scale-105 transition-transform",
        lightgreen: "bg-green-500 text-white hover:bg-green-600 transform hover:scale-105 transition-transform",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

