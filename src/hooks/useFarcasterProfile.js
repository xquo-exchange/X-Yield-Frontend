import { useState, useEffect } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

export function useFarcasterProfile() {
  const [profileImage, setProfileImage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInMiniApp, setIsInMiniApp] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const inMiniApp = await sdk.isInMiniApp();
        if (cancelled) return;

        setIsInMiniApp(inMiniApp);

        if (!inMiniApp) {
          setIsLoading(false);
          return;
        }

        // Get context which contains user information
        const ctx = await sdk.context;
        if (cancelled) return;

        // Log context structure for debugging
        console.log("Farcaster context structure:", ctx);

        // Farcaster context typically has user object with pfp (profile picture)
        // The structure may vary, but common paths are:
        // - ctx.user.pfp or ctx.user.pfpUrl
        // - ctx.user.avatar or ctx.user.avatarUrl
        // - ctx.user.profileImage
        // - ctx.user.profile?.pfp or ctx.user.profile?.pfpUrl
        // - ctx.castAuthor?.pfp (if available)
        
        let pfpUrl = null;
        
        if (ctx?.user) {
          pfpUrl = 
            ctx.user.pfp || 
            ctx.user.pfpUrl || 
            ctx.user.avatar || 
            ctx.user.avatarUrl ||
            ctx.user.profileImage ||
            ctx.user.profile?.pfp ||
            ctx.user.profile?.pfpUrl ||
            ctx.user.profile?.avatar ||
            ctx.user.profile?.avatarUrl;
        }
        
        // Also check castAuthor if available
        if (!pfpUrl && ctx?.castAuthor) {
          pfpUrl = 
            ctx.castAuthor.pfp ||
            ctx.castAuthor.pfpUrl ||
            ctx.castAuthor.avatar ||
            ctx.castAuthor.avatarUrl;
        }
        
        if (pfpUrl) {
          console.log("Found Farcaster profile image:", pfpUrl);
          setProfileImage(pfpUrl);
        } else {
          console.log("No profile image found in Farcaster context");
        }
      } catch (error) {
        console.error("Failed to get Farcaster profile:", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { profileImage, isInMiniApp, isLoading };
}

