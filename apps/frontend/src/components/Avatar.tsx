interface AvatarProps {
  /** 참가자 라벨 — 마지막 단어의 첫 글자를 이니셜로 뽑는다.
   * "참가자 4" 같은 라벨은 전부 "참가자"로 시작해 앞글자로는 구분이 안 된다 —
   * 실제 구분값은 뒤에 붙는 번호다. */
  label: string;
  variant?: "default" | "mine" | "dead";
}

export default function Avatar({ label, variant = "default" }: AvatarProps) {
  const tokens = label.trim().split(/\s+/);
  const lastToken = tokens[tokens.length - 1] ?? "";
  const initial = lastToken.charAt(0) || "?";
  const classes = ["avatar", variant !== "default" && `avatar-${variant}`].filter(Boolean).join(" ");
  return (
    <span className={classes} aria-hidden="true">
      {initial}
    </span>
  );
}
