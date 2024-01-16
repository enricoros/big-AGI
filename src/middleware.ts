import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({});

export const config = {
    matcher: [
        // Protects routes except those that match the specified patterns
        "/((?!.+\\.[\\w]+$|_next|link).*)", // Allow '/link' and its subpaths
        "/(api|trpc)(.*)", // Protects '/api' and '/trpc' routes
    ],
};
