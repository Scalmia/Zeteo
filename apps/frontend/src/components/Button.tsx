import { useState, type ButtonHTMLAttributes, type MouseEvent } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  block?: boolean;
}

export default function Button({ variant = "primary", block, className, onClick, ...rest }: ButtonProps) {
  // 500 은 tokens.css의 .btn::before transition: all 0.5s 와 짝이 맞아야 하는 값이다.
  // btn-ripple 을 계속 붙여두면 트랜지션이 끝난 채로 멈춰 있어 재클릭해도 다시 안
  // 터진다 — 500ms 뒤 클래스를 떼어내야 다음 클릭에서 처음부터 다시 재생된다.
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
