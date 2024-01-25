import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({

    publicRoutes: ["/", "/link", "/privacy", "/terms", "/api/trpc-edge/backend.listCapabilities"],
});

export const config = {
    matcher: [
        // Protects routes except those that match the specified patterns
        "/((?!.+\\.[\\w]+$|_next|link|privacy|terms).*)", // Allow '/link', '/privacy', '/terms' and their subpaths
        "/(api|trpc)(.*)", // Protects '/api' and '/trpc' routes
    ],
};
