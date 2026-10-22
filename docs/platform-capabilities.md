# Platform capability and launch matrix

Implementation date: 22 October 2026. All live provider functionality still requires developer credentials, approved permissions and tests on real accounts.

| Feature                      | Instagram                                           | TikTok                                        |
| ---------------------------- | --------------------------------------------------- | --------------------------------------------- |
| Connected profile            | Conditional: professional account + Instagram Login | Conditional: Login Kit / Display API approval |
| Connected media              | Conditional: approved basic scope                   | Conditional: `video.list`                     |
| Follower count               | Conditional: available approved fields              | Conditional: `user.info.stats`                |
| Bio comparison               | Conditional: available profile field                | Conditional: `user.info.profile`              |
| Public profile by username   | Link only; automated retrieval disabled             | Link only; automated retrieval disabled       |
| Stories                      | Disabled                                            | Disabled                                      |
| Full follower lists          | Excluded                                            | Excluded                                      |
| Private messages/activity    | Excluded                                            | Excluded                                      |
| Downloads without watermark  | Excluded                                            | Excluded                                      |
| Posting, liking or messaging | Excluded                                            | Excluded                                      |

TikTok scopes requested: `user.info.basic,user.info.profile,user.info.stats,video.list`. Any declined scope can prevent initial sync; the UI reports connection failure rather than pretending missing fields are empty. Refine partial-scope support after approval tests.

Instagram uses `instagram_business_basic` for the Instagram Login route and targets creator/business accounts. Personal accounts do not get equivalent support. The API version is a server configuration value and must be verified against the registered app before launch.

## Evidence and implementation rules

- The baseline suppresses historical posts. A persistent baseline timestamp filters older content first seen later.
- Known post IDs suppress duplicate alerts even when recent windows shift.
- The stored detected timestamp is separate from the source publication timestamp.
- A failed HTTP response never becomes an empty successful snapshot.
- Missing media are not labeled deleted. Image URL changes are not labeled picture changes.
- Count changes never name who followed or unfollowed.
- Saved profiles cannot enable unsupported monitoring.
- Retained history belongs to one user; child records have composite ownership foreign keys.

## Official references

- [TikTok Display API](https://developers.tiktok.com/docs/en/display-api-overview)
- [TikTok scopes](https://developers.tiktok.com/doc/tiktok-api-scopes/)
- [Instagram Platform](https://developers.facebook.com/docs/instagram-platform/)
- [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)

Before launch: verify account eligibility, all fields and scopes, app review requirements, quotas, polling permission, data retention, token rotation, deauthorization callbacks and deletion requirements for the intended commercial use. Do not substitute research endpoints or scraping for missing access.
