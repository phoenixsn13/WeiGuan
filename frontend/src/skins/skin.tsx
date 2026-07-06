import type { ComponentType } from "react";

import type { Actor, Platform } from "../model/canonical";
import type { PosterViewModel } from "../pov/poster";
import { RedditFeed } from "./reddit/RedditFeed";
import { WeiboFeed } from "./weibo/WeiboFeed";
import { XNativeFeed } from "./x/XNativeFeed";

export type SkinId = "weibo" | "x" | "reddit";

export interface PlatformSkin {
  id: SkinId;
  label: string;
  Feed: ComponentType<PlatformFeedProps>;
}

export interface PlatformFeedProps {
  vm: PosterViewModel;
  identityHrefForActor?: (actor: Actor) => string | undefined;
  onIdentityClick?: (href: string) => void;
}

export const availableSkins: PlatformSkin[] = [
  { id: "weibo", label: "微博", Feed: WeiboFeed },
  { id: "x", label: "X", Feed: XNativeFeed },
  { id: "reddit", label: "Reddit", Feed: RedditFeed },
];

export function skinForPlatform(platform: Platform | "x" | "weibo"): PlatformSkin {
  if (platform === "reddit") {
    return availableSkins[2];
  }
  if (platform === "x") {
    return availableSkins[1];
  }
  return availableSkins[0];
}

export function labelForPlatform(platform: Platform | "x" | "weibo" | string): string {
  if (platform === "reddit" || platform === "twitter" || platform === "x" || platform === "weibo") {
    return skinForPlatform(platform).label;
  }
  return platform;
}

export function PlatformSkinFeed({
  skin,
  vm,
  identityHrefForActor,
  onIdentityClick,
}: PlatformFeedProps & { skin: SkinId }) {
  const selected = availableSkins.find((item) => item.id === skin) ?? availableSkins[0];
  return (
    <selected.Feed
      vm={vm}
      identityHrefForActor={identityHrefForActor}
      onIdentityClick={onIdentityClick}
    />
  );
}
