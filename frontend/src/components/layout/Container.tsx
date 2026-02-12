import { PropsWithChildren } from "react";
import "./Container.css";

type ContainerSize = "normal" | "wide";

type ContainerProps = PropsWithChildren<{
  size?: ContainerSize;
  className?: string;
}>;

export default function Container({ size = "normal", className = "", children }: ContainerProps) {
  const classes = `container container--${size} ${className}`.trim();
  return <div className={classes}>{children}</div>;
}
