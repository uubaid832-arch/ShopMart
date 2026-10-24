package com.shopmart.api.auth;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.*;

@Entity
@Table(name = "refresh_sessions", schema = "public")
public class RefreshSession {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @Column(name = "family_id", nullable = false)
  private UUID familyId;

  @Column(name = "token_hash", nullable = false, unique = true, length = 64)
  private String tokenHash;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "expires_at", nullable = false)
  private Instant expiresAt;

  @Column(name = "revoked_at")
  private Instant revokedAt;

  @Column(name = "replaced_by")
  private UUID replacedBy;

  protected RefreshSession() {
  }

  public RefreshSession(
      UUID userId,
      UUID familyId,
      String tokenHash,
      Instant createdAt,
      Instant expiresAt) {
    this.userId = userId;
    this.familyId = familyId;
    this.tokenHash = tokenHash;
    this.createdAt = createdAt;
    this.expiresAt = expiresAt;
  }

  public UUID getId() {
    return id;
  }

  public UUID getUserId() {
    return userId;
  }

  public UUID getFamilyId() {
    return familyId;
  }

  public Instant getExpiresAt() {
    return expiresAt;
  }

  public Instant getRevokedAt() {
    return revokedAt;
  }

  public void replaceWith(UUID replacementId, Instant now) {
    this.revokedAt = now;
    this.replacedBy = replacementId;
  }
}