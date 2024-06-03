// import { RealtimeChannel, Session } from "@supabase/supabase-js";
// import { useEffect, useState, createContext  } from "react";
// import { getSupabaseClient } from '~/modules/supabasesync/supabaseSync.client';
// import * as React from "react";

// export interface UserProfile {
//     username: string;
//     avatarUrl?: string;
// }

// export interface BigAgiUserInfo {
//     session: Session | null;
//     profile: UserProfile | null;
// }

// export const UserContext = React.createContext<BigAgiUserInfo>({
//     session: null,
//     profile: null,
// });


// export function useSession(): BigAgiUserInfo {
//     const [userInfo, setUserInfo] = useState<BigAgiUserInfo>({
//         profile: null,
//         session: null,
//     });
//     const [channel, setChannel] = useState<RealtimeChannel | null>(null);
//     useEffect(() => {
//         const supaClient = getSupabaseClient();
//         if (!supaClient) {
//             return;
//         }
//         supaClient.auth.getSession().then(({ data: { session } }) => {
//             setUserInfo({ ...userInfo, session });
//             supaClient.auth.onAuthStateChange((_event, session) => {
//                 setUserInfo({ session, profile: null });
//             });
//         });
//     }, []);

//     useEffect(() => {
//         if (userInfo.session?.user && !userInfo.profile) {
//             listenToUserProfileChanges(userInfo.session.user.id).then(
//                 (newChannel) => {
//                     if (channel) {
//                         channel.unsubscribe();
//                     }
//                     setChannel(newChannel);
//                 }
//             );
//         } else if (!userInfo.session?.user) {
//             channel?.unsubscribe();
//             setChannel(null);
//         }
//     }, [userInfo.session]);

//     async function listenToUserProfileChanges(userId: string) {
//         const supaClient = getSupabaseClient();
//         const { data } = await supaClient
//             .from("user_profiles")
//             .select("*")
//             .filter("user_id", "eq", userId);
//         if (data?.[0]) {
//             setUserInfo({ ...userInfo, profile: data?.[0] });
//         }
//         return supaClient
//             .channel(`public:user_profiles`)
//             .on(
//                 "postgres_changes",
//                 {
//                     event: "*",
//                     schema: "public",
//                     table: "user_profiles",
//                     filter: `user_id=eq.${userId}`,
//                 },
//                 (payload) => {
//                     setUserInfo({ ...userInfo, profile: payload.new as UserProfile });
//                 }
//             )
//             .subscribe();
//     }

//     return userInfo;
// }