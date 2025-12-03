import { useState, useEffect } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

export function useFarcasterProfile() {
  const [profileImage, setProfileImage] = useState(null);
  const [username, setUsername] = useState(null);
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

        const ctx = await sdk.context;
        if (cancelled) return;

        if (ctx?.user) {
          const pfpUrl = ctx.user.pfpUrl || ctx.user.pfp;
          if (pfpUrl) {
            setProfileImage(pfpUrl);
          }
          if (ctx.user.username) {
            setUsername(ctx.user.username);
          }
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

  return { profileImage, username, isInMiniApp, isLoading };
}

