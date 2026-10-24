package com.shopmart.api.auth;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RefreshSessionRepository
        extends JpaRepository<RefreshSession, UUID> {

    Optional<RefreshSession> findByTokenHash(String tokenHash);

    @Modifying(flushAutomatically = true)
    @Query("""
            update RefreshSession session
            set session.revokedAt = :now
            where session.userId = :userId
              and session.revokedAt is null
            """)
    int revokeAllForUser(
            @Param("userId") UUID userId,
            @Param("now") Instant now);

    @Query("""
            select session.userId
            from RefreshSession session
            where session.tokenHash = :hash
            """)
    Optional<UUID> findUserIdByTokenHash(@Param("hash") String hash);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update RefreshSession session
            set session.revokedAt = :now
            where session.familyId = :familyId
              and session.revokedAt is null
            """)
    int revokeFamily(
            @Param("familyId") UUID familyId,
            @Param("now") Instant now);
}