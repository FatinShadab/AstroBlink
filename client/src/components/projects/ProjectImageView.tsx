"use client";

import type { ProjectImage } from "@/data/projectImages";
import { fill } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/LangProvider";
import { SkyThumbnail } from "./SkyThumbnail";

/** A project image with its caption: "Real SPHEREx image · <target>" for real data. */
export function ProjectImageView({
  image,
  aspect,
  className,
}: {
  image: ProjectImage;
  aspect?: "square" | "wide";
  className?: string;
}) {
  const { t } = useT();
  return (
    <SkyThumbnail
      spec={image.spec}
      label={t(image.labelKey)}
      caption={
        image.target ? fill(t("thumb.realCaption"), { target: image.target }) : t("thumb.simulatedCaption")
      }
      aspect={aspect}
      className={className}
    />
  );
}
