import { useState, type ButtonHTMLAttributes, type MouseEvent } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  block?: boolean;
}

export default function Button({ variant = "primary", block, className, onClick, ...rest }: ButtonProps) {
  const [rippling, setRippling] = useState(false);
  const classes = ["btn", `btn-${variant}`, block && "btn-block", rippling && "btn-ripple", className]
    .filter(Boolean)
    .join(" ");

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    setRippling(true);
    setTimeout(() => setRippling(false), 500);
    onClick?.(e);
  };

  return <button className={classes} onClick={handleClick} {...rest} />;
}
