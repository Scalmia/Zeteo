import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  block?: boolean;
}

export default function Button({ variant = "primary", block, className, ...rest }: ButtonProps) {
  const classes = ["btn", `btn-${variant}`, block && "btn-block", className].filter(Boolean).join(" ");
  return <button className={classes} {...rest} />;
}
