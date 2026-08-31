import { avatarInitial } from './avatarInitial';

interface AvatarProps {
  label: string;
  variant?: "default" | "mine";
}

export default function Avatar({ label, variant = "default" }: AvatarProps) {
  const classes = ["avatar", variant !== "default" && `avatar-${variant}`].filter(Boolean).join(" ");
  return (
    <span className={classes} aria-hidden="true">
      {avatarInitial(label)}
    </span>
  );
}
