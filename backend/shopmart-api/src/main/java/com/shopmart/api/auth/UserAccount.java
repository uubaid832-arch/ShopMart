package com.shopmart.api.auth;

import java.util.UUID;
import jakarta.persistence.*;

@Entity
@Table(name = "users", schema = "public")
public class UserAccount {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @Column(nullable = false, length = 150)
  private String name;

  @Column(nullable = false, unique = true, length = 254)
  private String email;

  @Column(name = "password_hash", nullable = false, length = 255)
  private String passwordHash;

  @Column(length = 32)
  private String phone;

  @Column(nullable = false, length = 20)
  private String role = "CUSTOMER";

  @Column(nullable = false)
  private boolean enabled = true;

  @Version
  private long version;

  protected UserAccount() {
  }

  public UserAccount(String name, String email, String passwordHash) {
    this.name = name;
    this.email = email;
    this.passwordHash = passwordHash;
  }

  public UUID getId() {
    return id;
  }

  public String getName() {
    return name;
  }

  public String getEmail() {
    return email;
  }

  public String getPhone() {
    return phone;
  }

  public String getRole() {
    return role;
  }

  public boolean isEnabled() {
    return enabled;
  }

  String getPasswordHash() {
    return passwordHash;
  }

  void updateProfile(String name, String phone) {
    this.name = name;
    this.phone = phone;
  }

  void changePasswordHash(String passwordHash) {
    this.passwordHash = passwordHash;
  }
}