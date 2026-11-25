# Security Specification & Payload-First TDD

## Data Invariants
1. `site_state/{stateId}`: Only verified Primary Admins (`rajib.matador@gmail.com` or `rajibshahani9@gmail.com` with `email_verified == true`, or a document in `admins/{uid}`) may create, update, or delete `site_state` documents. Co-Admins NEVER have write access to `site_state/main`. `updatedBy` must equal `request.auth.uid`, and `updatedAt` must equal `request.time`. Public `get` is permitted on valid IDs (`isValidId`) while collection `list` is forbidden.
2. `clone_states/{cloneId}`: Isolated clone workspaces. Public `get` is allowed on valid IDs (`list` forbidden). Writes require `email_verified == true`. Once `ownerUid` is claimed by a Google-authenticated Co-Admin, `ownerUid` becomes immutable and only that exact `ownerUid` (or a Primary Admin) may update or delete that clone workspace. Contains NO PII.
3. `co_admins/{coAdminId}`: PII-isolated directory storing Co-Admin emails + SHA-256 token hashes. `get`, `list`, `create`, `update`, and `delete` are strictly restricted to Primary Admins (`isAdmin()`).
4. `co_admin_tokens/{tokenHash}`: PII-free SHA-256 lookup keyed by `sha256(email + "::" + password)`. `list` is forbidden; single-doc `get` is allowed on exact valid hash ID; all writes are restricted to Primary Admins (`isAdmin()`).
5. `co_admin_sync/{uid}`: PII-isolated Google Cloud Sync record keyed by the Co-Admin's Firebase Auth UID. Readable/writable ONLY by the matching verified user (`request.auth.uid == uid`) or readable/deletable by Primary Admin.
6. `comments/{commentId}`, `page_likes/{pageId}`, `admins/{uid}`: Maintained with strict owner/admin bounds.
7. `blogs/{blogId}`: Published blogs (`published == true`) are publicly readable (`get` and `list` filtered by `resource.data.published == true`), while unpublished drafts and all `create`, `update`, `delete` writes are strictly restricted to verified Primary Admins (`isAdmin()`) with immutable `id`, `authorUid`, and `createdAt`.

## Dirty Dozen Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated write to `site_state/main`, `clone_states/{cloneId}`, or `blogs/{blogId}`.
2. Co-Admin verified Google user attempting to write `site_state/main` or `blogs/{blogId}`.
3. Non-owner verified user attempting to update a `clone_states/{cloneId}` document already claimed by another `ownerUid`.
4. Attacker attempting to reassign `ownerUid` on an already-claimed `clone_states/{cloneId}` document.
5. Any Co-Admin or public user attempting to `get` or `list` `/co_admins`.
6. Any user attempting to `list` `/co_admin_tokens` or `/clone_states` or unpublished `/blogs`.
7. Unverified email spoofed as admin (`email_verified: false`) writing to any collection.
8. Admin `site_state/main`, `clone_states/{cloneId}`, or `blogs/{blogId}` update containing an unauthorized shadow field.
9. Client-forged `updatedAt` timestamp not equal to `request.time`.
10. Spoofed `updatedBy`, `authorUid`, or `createdBy` UID not equal to `request.auth.uid`.
11. Co-Admin B reading `/co_admin_sync/{uidA}`.
12. Client attempt to write to `admins/{uid}`.
