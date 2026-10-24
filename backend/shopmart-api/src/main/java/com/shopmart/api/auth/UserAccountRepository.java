package com.shopmart.api.auth;

import java.util.Optional;
import java.util.UUID;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserAccountRepository
    extends JpaRepository<UserAccount, UUID> {

  boolean existsByEmail(String email);

  Optional<UserAccount> findByEmail(String email);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select account from UserAccount account where account.id = :id")
  Optional<UserAccount> lockById(@Param("id") UUID id);
}