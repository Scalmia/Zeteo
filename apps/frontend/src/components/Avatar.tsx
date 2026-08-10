interface AvatarProps {
  /** 참가자 라벨 — 첫 글자만 이니셜로 뽑는다 */
  label: string;
  variant?: "default" | "mine";
}

export default function Avatar({ label, variant = "default" }: AvatarProps) {
  const initial = label.trim().charAt(0) || "?";
  const classes = ["avatar", variant !== "default" && `avatar-${variant}`].filter(Boolean).join(" ");
  return (
    <span className={classes} aria-hidden="true">
      {initial}
    </span>
  );
}
